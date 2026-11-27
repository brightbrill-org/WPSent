'use strict';

const landingHTML = require('../views/landing');
const docsHTML = require('../views/docs');

module.exports = function registerPages(router) {
  router.get('/', (req, res) => res.send(landingHTML()));

  router.get('/docs', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    res.send(docsHTML(host));
  });
};
