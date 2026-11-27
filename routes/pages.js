'use strict';

const landingHTML = require('../views/landing');
const docsHTML = require('../views/docs');
const collection = require('../docs/WPSent.postman_collection.json');
const { CONFIG } = require('./config');

module.exports = function registerPages(router) {
  router.get('/', (req, res) => res.send(landingHTML()));

  router.get('/docs/postman.json', (req, res) => {
    // Use the deployment's configured public URL, never include credentials.
    const body = { ...collection, variable: collection.variable.map(v => v.key === 'baseUrl' ? { ...v, value: CONFIG.SITE_URL } : v) };
    res.attachment('WPSent.postman_collection.json').type('application/json').send(JSON.stringify(body, null, 2));
  });

  router.get('/docs', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    res.send(docsHTML(host));
  });
};
