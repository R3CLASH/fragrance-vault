# Fragrance Vault — Next.js + Strapi + PostgreSQL

The new fragrancevault.lk: the "vault" storefront (scroll-driven 3D tunnel, iris transitions, drawers, combination dial, particle bottles) on **Next.js 15**, with every product, page, setting and order managed in **Strapi 5** on **PostgreSQL**.

```
fragrance-vault/
├── web/                 Next.js storefront (shop, product pages, cart, checkout, order tracking)
├── cms/                 Strapi CMS (catalogue, orders, coupons, payments, delivery, pages, settings)
│   ├── src/utils/store.js           the store engine: prices, stock, coupons, fees, orders, PayHere
│   ├── scripts/import-woocommerce.js   pulls everything from the current WordPress site
│   └── seed/                        first-run catalogue (75 products from the live store)
├── docker-compose.yml   Postgres + Strapi + Next in one command
└── .env.example
```

---

## 1. Run it on your Mac (development)

You need **Node 22** and **PostgreSQL 16** (`brew install node@22 postgresql@16 && brew services start postgresql@16`).

```bash
# database
createuser -s fragrancevault
createdb -O fragrancevault fragrancevault
psql -c "ALTER USER fragrancevault WITH PASSWORD 'change-me';"

# CMS
cd cms
cp .env.example .env
node scripts/generate-secrets.js     # paste the output into .env, replacing the change-me secrets
npm install
npm run develop                      # http://localhost:1337/admin  → create your admin login
```

On the first start the empty database is filled with the 75 live products (with prices, brands and ranges), the payment methods, delivery method, pages and homepage text.

```bash
# storefront (new terminal)
cd web
cp .env.example .env.local
npm install
npm run dev                          # http://localhost:3000
```

### Bring over everything from the WordPress site

```bash
cd cms
npm run import:woo
```

This reads fragrancevault.lk and creates or updates every product with its **real photos, descriptions, prices, sale prices, categories and brands**, plus the WordPress pages (About, Contact, policies). It is safe to run again.

To also import **exact stock levels, coupons and past orders**, create a read-only REST key in WordPress (*WooCommerce → Settings → Advanced → REST API*) and run:

```bash
WC_KEY=ck_xxx WC_SECRET=cs_xxx npm run import:woo
```

---

## 2. Run it on a server (production)

**Docker (simplest).** On a VPS with Docker:

```bash
cp .env.example .env                 # set DATABASE_PASSWORD, SITE_URL, REVALIDATE_SECRET
cp cms/.env.example cms/.env         # set the secrets, PUBLIC_URL=https://cms.fragrancevault.lk, STOREFRONT_URL=https://fragrancevault.lk
docker compose up -d --build
```

Put Nginx or Caddy in front with HTTPS:
`fragrancevault.lk → localhost:3000`, `cms.fragrancevault.lk → localhost:1337`, and set `IS_PROXIED=true` in `cms/.env`.

**Without Docker:** run `npm run build && npm run start` in `cms/` and `web/` with PM2, pointing at a managed Postgres.

**Instant updates.** Pages refresh from Strapi every 30–60 seconds on their own. For instant updates, add a webhook in *Strapi → Settings → Webhooks* to `https://fragrancevault.lk/api/revalidate?secret=YOUR_REVALIDATE_SECRET` for entry create, update, publish and delete.

---

## 3. Running the shop in Strapi (your WooCommerce equivalents)

| WooCommerce | Strapi (Content Manager) |
|---|---|
| Products → Add new | **Product**: name, prices, sale price and sale dates, photos, brand, ranges, For Him / For Her / Unisex, top-heart-base notes, accent colour, stock, size variants, related products, SEO. Draft → Publish. |
| Product categories / brands | **Category** (ranges like For Him, Rasasi Hawas) and **Brand** |
| Orders | **Order**: newest first with status, payment, total and customer. Open one to see items, addresses, notes and the full history. |
| Coupons | **Coupon**: percentage, fixed or free delivery; minimum spend, cap, usage limits, per-customer limit, start and expiry dates, specific products, exclude sale items |
| Payments | **Payment method**: bank transfer, card (PayHere), Koko, Payzy, cash on delivery; fee % or fixed fee, min/max order, on/off, order |
| Shipping | **Shipping method**: rate, free over an amount, delivery time |
| Pages | **Page**: About, Contact, policies, anything else (shows at `/slug`) |
| Customise / homepage | **Homepage**: every line of hero text, the three note steps, featured bottle, deposit boxes, marquee words |
| Settings | **Site settings**: logo, announcement bar, contact, WhatsApp, socials, order email addresses |

### Order statuses (same flow as WooCommerce)

- **Pending payment**: card payment started but not confirmed yet.
- **On hold**: bank transfer, Koko or Payzy; waiting for the money. Check the slip, then set **Processing**.
- **Processing**: paid (or cash on delivery); pack it.
- **Shipped**: add the courier and tracking number first; the customer sees them on their order page.
- **Completed**, **Cancelled**, **Refunded**, **Failed**.

What happens automatically when you change a status: stock is **put back** on Cancelled, Failed or Refunded (and taken off again if you re-open the order); a line is added to the order history; the customer gets an email (when SMTP is set up).

Stock is reduced when the order is placed, and checked again at that moment, so two people cannot buy the last bottle.

### Card payments with PayHere

1. In *Payment method → Credit / debit card*, open **config** and enter `{"merchantId": "YOUR_ID", "merchantSecret": "YOUR_SECRET"}`.
2. Leave **testMode** on while testing with PayHere sandbox details; switch it off to go live.
3. In your PayHere account, allow the domain `fragrancevault.lk`.
4. `PUBLIC_URL` in `cms/.env` must be the public address of the CMS: PayHere sends the payment confirmation to `PUBLIC_URL/api/payments/payhere/notify`. Each confirmation is signature-checked before an order is marked paid.

Fees match the live site: bank transfer 0%, card +5%, Koko and Payzy +10%. Change them any time.

**Koko and Payzy** currently work the way your live site handles them manually: the order is placed **On hold** with your instructions and you send the customer a payment link. Their direct APIs need merchant onboarding with each provider; the payment methods are built so an integration can be added later.

### Emails

Set the `SMTP_*` values in `cms/.env` (Gmail/Google Workspace, Zoho or any SMTP). Customers then get "order received" and status-change emails. Set **Site settings → Order notification email** to receive a copy of every new order.

### Managing from your iPhone

The Strapi admin works in Safari on iPhone. Open `https://cms.fragrancevault.lk/admin`, tap **Share → Add to Home Screen**, and you can update stock, prices and order statuses from your phone.

---

## 4. What's included, and what isn't yet

**Included:** catalogue with brands, ranges, variants, sale scheduling and stock; cart (saved on the device); checkout with live totals, coupons, delivery and payment fees; order confirmation page with payment instructions; order tracking by order number and email; PayHere card payments; order management with statuses, history, restock and emails; CMS pages, homepage and site settings; WordPress/WooCommerce importer; SEO titles and descriptions, product structured data, sitemap.xml and robots.txt.

**Not included yet (WooCommerce has them):** customer accounts and login, product reviews, wishlists, tax rules, sales reports and analytics dashboards, abandoned-cart emails, automatic refunds through the gateway (refund in PayHere, then set the order to Refunded), and direct Koko/Payzy API checkout.

---

## 5. Security notes

- Prices, stock, coupons and fees are always worked out on the server. The browser only sends product IDs and quantities.
- Orders are not exposed through Strapi's public API. Customers can only see an order with its private link or with the matching email address.
- PayHere confirmations are rejected unless their signature and amount match.
- Generate your own secrets (`node cms/scripts/generate-secrets.js`) and never commit `.env` files.
