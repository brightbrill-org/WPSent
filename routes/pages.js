'use strict';

const landingHTML = require('../views/landing');
const docsHTML = require('../views/docs');
const path = require('node:path');

module.exports = function registerPages(router) {
  router.get('/', (req, res) => res.send(landingHTML()));

  router.get('/docs/postman.json', (req, res) => {
    res.download(path.join(__dirname, '../docs/WPSent.postman_collection.json'), 'WPSent.postman_collection.json');
  });

  router.get('/docs', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    res.send(docsHTML(host));
  });
};
