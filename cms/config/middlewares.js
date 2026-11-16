module.exports = ({ env }) => [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'media-src': ["'self'", 'data:', 'blob:'], upgradeInsecureRequests: null },
      },
    },
  },
  { name: 'strapi::cors', config: { origin: env.array('CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:1337']) } },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
