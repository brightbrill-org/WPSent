'use strict';

const express = require('express');
const registerPages = require('./pages');
const registerAuth = require('./auth');
const registerDashboard = require('./dashboard');
const registerMessages = require('./messages');
const registerWebhooks = require('./webhooks');
const registerContacts = require('./contacts');
const registerAdmin = require('./admin');
const registerMedia = require('./media');
const registerGroups = require('./groups');

const router = express.Router();

// Keep the original route registration order and public URLs.
registerPages(router);
registerAuth(router);
registerDashboard(router);
registerMessages(router);
registerWebhooks(router);
registerContacts(router);
registerAdmin(router);
registerMedia(router);
registerGroups(router);
require('./polls')(router);

module.exports = router;
