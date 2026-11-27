'use strict';

const mongoose = require('mongoose');
const loadModels = () => {
  for (const p of ['../models/models.js', '../models/index.js', '../models.js']) {
    try { return require(p); }
    catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !e.message.includes(p.slice(3))) throw e; }
  }
  throw new Error('Models file not found. Put it at ../models/models.js');
};
const lazyModel = (name) => new Proxy({}, {
  get: (_, key) => {
    const exported = loadModels();
    const model = (exported && exported[name]) || (exported && exported.default && exported.default[name]) || (mongoose.models || {})[name];
    if (!model) {
      throw new Error(`Model "${name}" not found. models exports: [${Object.keys(exported || {}).join(', ')}]`);
    }
    const value = model[key];
    return typeof value === 'function' ? value.bind(model) : value;
  }
});
const WpUser = lazyModel('WpUser');
const MessageLog = lazyModel('MessageLog');

module.exports = { WpUser, MessageLog };
