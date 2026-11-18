const allowedMediaTypes = ['image/*', 'video/*', 'application/pdf'];
const deniedTypes = ['image/svg+xml', 'application/x-msdownload', 'application/x-sh', 'text/x-shellscript'];

module.exports = ({ env }) => ({
  // Push alerts to the Stockroom phone app for new, cancelled and completed orders.
  // Source: github.com/R3CLASH/stockroom (strapi-plugin-stockroom). Needs outbound access to exp.host.
  stockroom: {
    enabled: true,
    resolve: './src/plugins/stockroom',
    config: { currency: 'Rs.', orderUid: 'api::order.order', statusField: 'orderStatus', numberField: 'orderNumber', totalField: 'total' },
  },
  'users-permissions': {
    config: { jwtManagement: 'refresh', sessions: { httpOnly: true } },
  },
  upload: {
    config: {
      sizeLimit: 20 * 1024 * 1024,
      security: { allowedTypes: allowedMediaTypes, deniedTypes },
      breakpoints: { xlarge: 1600, large: 1000, medium: 750, small: 500 },
    },
  },
  // Order emails. Leave SMTP_HOST empty to switch emails off.
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', ''),
        port: env.int('SMTP_PORT', 587),
        secure: env.bool('SMTP_SECURE', false),
        auth: { user: env('SMTP_USERNAME', ''), pass: env('SMTP_PASSWORD', '') },
      },
      settings: { defaultFrom: env('SMTP_FROM', 'orders@fragrancevault.lk'), defaultReplyTo: env('SMTP_REPLY_TO', 'orders@fragrancevault.lk') },
    },
  },
});
