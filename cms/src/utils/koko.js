'use strict';
/**
 * Koko (Buy Now Pay Later) gateway, built from Koko's "Payment Method Integration API v1.06"
 * and "Merchant Order View API v1.0" documents.
 *
 * Flow: the checkout posts a signed form to Koko's orderCreate page → the customer pays on Koko →
 * Koko's server POSTs a signed result to our _responseUrl (the real confirmation) and the customer's
 * browser comes back to _returnUrl, where we also ask Koko's orderView API for the status.
 *
 * Credentials live ONLY in the Koko payment method's private `config` JSON in the Strapi admin:
 *   { "merchantId": "...", "apiKey": "...", "privateKey": "-----BEGIN RSA PRIVATE KEY-----...",
 *     "kokoPublicKey": "-----BEGIN PUBLIC KEY-----...", "testCode": "only-while-testMode-is-on" }
 * The payment method's `testMode` switch picks Koko's QA servers (true) or production (false).
 */
const crypto = require('crypto');

const PLUGIN_NAME = 'customapi';
const PLUGIN_VERSION = '1';
const HOSTS = { qa: 'https://qaapi.paykoko.com', prod: 'https://prodapi.paykoko.com' };

// Koko puts these values into one signed string; a browser silently drops line breaks from hidden
// form fields, so every value is flattened to a single line first (or the signature would not match).
const flat = (v, max = 120) => String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

function base(method) {
  const cfg = (method && method.config) || {};
  if (cfg.baseUrl) return String(cfg.baseUrl).replace(/\/$/, ''); // only for local testing against a mock; leave unset
  return method && method.testMode ? HOSTS.qa : HOSTS.prod;
}

/**
 * Accepts a key pasted in any common form: full PEM with line breaks, PEM squashed onto one line,
 * or just the base64 body. Returns a Node KeyObject, or null if it can't be read.
 */
function readKey(raw, kind) {
  if (!raw || typeof raw !== 'string') return null;
  const body = raw.replace(/-----[A-Z ]+-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!body) return null;
  const der = Buffer.from(body, 'base64');
  const tries = kind === 'private' ? ['pkcs1', 'pkcs8'] : ['spki', 'pkcs1'];
  for (const type of tries) {
    try {
      return kind === 'private'
        ? crypto.createPrivateKey({ key: der, format: 'der', type })
        : crypto.createPublicKey({ key: der, format: 'der', type });
    } catch { /* try the next encoding */ }
  }
  return null;
}

/** Is everything needed to talk to Koko present and readable? */
function credentials(method) {
  const cfg = (method && method.config) || {};
  const privateKey = readKey(cfg.privateKey, 'private');
  const publicKey = readKey(cfg.kokoPublicKey, 'public');
  const ok = !!(cfg.merchantId && cfg.apiKey && privateKey && publicKey);
  return { ok, merchantId: cfg.merchantId ? String(cfg.merchantId).trim() : '', apiKey: cfg.apiKey ? String(cfg.apiKey).trim() : '', privateKey, publicKey, testCode: cfg.testCode ? String(cfg.testCode) : '' };
}

/**
 * Should this checkout use the real Koko gateway?
 *  - production keys (testMode off): yes, for everyone
 *  - QA keys (testMode on): only for someone who opened the secret test link (?kokotest=<testCode>),
 *    so live shoppers are never sent to Koko's test system
 * Otherwise Koko stays the manual "we'll send you a payment link" method.
 */
function useGateway(method, testCode) {
  if (!method || method.type !== 'koko') return false;
  const c = credentials(method);
  if (!c.ok) return false;
  if (!method.testMode) return true;
  if (!c.testCode || typeof testCode !== 'string') return false;
  const a = Buffer.from(testCode), b = Buffer.from(c.testCode);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sign = (key, data) => crypto.sign('sha256', Buffer.from(data, 'utf8'), key).toString('base64');

function verifySig(key, data, signature) {
  try { return crypto.verify('sha256', Buffer.from(data, 'utf8'), key, Buffer.from(String(signature || ''), 'base64')); } catch { return false; }
}

/**
 * Koko signs its results over orderId + trnId + status (the docs), and its sample code appends `desc`
 * (currently always ""). Accept either form so a future non-empty desc doesn't break confirmations.
 */
function verifyResult(method, { orderId, trnId, status, desc, signature }) {
  const c = credentials(method);
  if (!c.publicKey || !signature) return false;
  const core = `${orderId || ''}${trnId || ''}${status || ''}`;
  return verifySig(c.publicKey, core, signature) || (!!desc && verifySig(c.publicKey, core + desc, signature));
}

/** Each payment attempt needs its own unique Koko order id; it always starts with our order number. */
const attemptId = (orderNumber) => `${orderNumber}-K${crypto.randomInt(100000, 999999)}`;
const orderNumberOf = (kokoOrderId) => {
  const s = String(kokoOrderId || '');
  const i = s.lastIndexOf('-K');
  return i > 0 ? s.slice(0, i) : s;
};

/** The auto-submitting form that sends the customer to Koko (orderCreate, docs v1.06). */
function orderForm(method, order, { site, api }) {
  const c = credentials(method);
  if (!c.ok) return null;
  const b = order.billing || {};
  const kokoOrderId = attemptId(order.orderNumber);
  const backTo = `${site}/pay/koko/return?o=${encodeURIComponent(order.orderNumber)}&t=${encodeURIComponent(order.accessToken)}`;
  const count = (order.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0) || 1;
  const v = {
    _mId: c.merchantId,
    _amount: Number(order.total).toFixed(2),
    _currency: order.currency || 'LKR',
    _pluginName: PLUGIN_NAME,
    _pluginVersion: PLUGIN_VERSION,
    _returnUrl: backTo,
    _cancelUrl: `${backTo}&cancelled=1`,
    _orderId: kokoOrderId,
    _reference: order.orderNumber,
    _firstName: flat(b.firstName, 60) || 'Customer',
    _lastName: flat(b.lastName, 60) || '-',
    _email: flat(order.customerEmail, 120),
    _description: `${count} ${count === 1 ? 'product' : 'products'}`,
    api_key: c.apiKey,
    _responseUrl: `${api}/api/payments/koko/notify`,
  };
  // Koko's required order (NOT alphabetical): mId, amount, currency, pluginName, pluginVersion, returnUrl,
  // cancelUrl, orderId, reference, firstName, lastName, email, description, apiKey, responseUrl
  const dataString = v._mId + v._amount + v._currency + v._pluginName + v._pluginVersion + v._returnUrl + v._cancelUrl
    + v._orderId + v._reference + v._firstName + v._lastName + v._email + v._description + v.api_key + v._responseUrl;
  return {
    kokoOrderId,
    redirect: {
      url: `${base(method)}/api/merchants/orderCreate`,
      fields: { ...v, _mobileNo: flat(b.phone || order.customerPhone, 20), dataString, signature: sign(c.privateKey, dataString) },
    },
  };
}

/**
 * Ask Koko for the real status of one payment attempt (orderView, docs v1.0).
 * Returns { status: 'SUCCESS'|'PENDING'|'FAILED'|..., trnId } or null if Koko could not be asked.
 */
async function orderView(method, kokoOrderId) {
  const c = credentials(method);
  if (!c.ok) return null;
  const dataString = c.merchantId + PLUGIN_NAME + PLUGIN_VERSION + kokoOrderId + c.apiKey;
  const body = new URLSearchParams({
    _mId: c.merchantId, api_key: c.apiKey, _orderId: kokoOrderId,
    _pluginName: PLUGIN_NAME, _pluginVersion: PLUGIN_VERSION, signature: sign(c.privateKey, dataString),
  });
  let data;
  try {
    const res = await fetch(`${base(method)}/api/merchants/orderView`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body, signal: AbortSignal.timeout(15000),
    });
    data = await res.json();
  } catch { return null; }
  const r = (data && (data.content || data.data || data)) || {};
  if (!r.status) return null;
  if (r.orderId && String(r.orderId) !== String(kokoOrderId)) return null;
  // the answer came straight from Koko over HTTPS; if Koko also signed it, the signature must check out
  if (r.signature && !verifyResult(method, r)) return null;
  return { status: String(r.status).toUpperCase(), trnId: r.trnId ? String(r.trnId) : '' };
}

const PAID = ['SUCCESS', 'APPROVED', 'COMPLETED'];

module.exports = { useGateway, credentials, orderForm, orderView, verifyResult, orderNumberOf, readKey, sign, PAID, PLUGIN_NAME, PLUGIN_VERSION };
