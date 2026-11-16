#!/usr/bin/env node
// Prints fresh secrets for cms/.env
const c = require('crypto');
const r = () => c.randomBytes(16).toString('base64');
console.log(`APP_KEYS=${[r(), r(), r(), r()].join(',')}
API_TOKEN_SALT=${r()}
ADMIN_JWT_SECRET=${r()}
TRANSFER_TOKEN_SALT=${r()}
JWT_SECRET=${r()}
ENCRYPTION_KEY=${r()}`);
