'use strict';

const express = require('express');
const registerPages = require('./pages');
const registerAuth = require('./auth');
const registerDashboard = require('./dashboard');
const registerMessages = require('./messages');
const registerWebhooks = require('./webhooks');
const registerContacts = require('./contacts');

const router = express.Router();

// Keep the original route registration order and public URLs.
registerPages(router);
registerAuth(router);
registerDashboard(router);
registerMessages(router);
registerWebhooks(router);
registerContacts(router);

module.exports = router;
