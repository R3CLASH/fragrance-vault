# strapi-plugin-stockroom

Companion plugin for the **Stockroom** mobile app. It sends push notifications to your phone when an order is **created**, **cancelled/refunded** or **completed**, even when the app is closed.

Works with Strapi 4 and 5. It has no admin UI and doesn't change your content types.

## Install

1. Copy this folder into your Strapi project, for example at `src/plugins/stockroom`. You can also publish it to npm and `npm i strapi-plugin-stockroom`.
2. Enable it in `config/plugins.js` (or `.ts`):

```js
module.exports = () => ({
  stockroom: {
    enabled: true,
    resolve: './src/plugins/stockroom', // leave out if installed from npm
    config: {
      currency: 'Rs.',            // shown in notification text
      // Optional — only if auto-detection picks the wrong thing:
      // orderUid: 'api::order.order',
      // statusField: 'orderStatus',
      // numberField: 'orderNumber',
      // totalField: 'total',
    },
  },
});
```

3. Restart Strapi. In the app, go to **Menu → Alerts & push → Enable on this phone**.

## What it adds

| Route (admin-authenticated) | Purpose |
|---|---|
| `GET /stockroom/status` | Plugin version, detected order model, and the number of phones registered |
| `POST /stockroom/devices` | Register this phone's Expo push token and which alerts it wants |
| `POST /stockroom/devices/remove` | Unregister a phone |
| `POST /stockroom/test` | Send a test notification |

Push tokens are stored in Strapi's core store, tied to the admin user who registered them. Notifications go out through Expo's push service (`exp.host`), so your Strapi server needs outbound internet access.
