'use strict';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
function webUrl(value, fallback) {
  try { const url = new URL(value || fallback); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : fallback; }
  catch (_) { return fallback; }
}
function email(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9.!#$%&'*+/=?^_{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) ? value : '';
}
const CONFIG = {
  GITHUB_URL: webUrl(process.env.GITHUB_URL, 'https://github.com/brightbrill-org/WPSent'),
  INSTAGRAM_URL: webUrl(process.env.INSTAGRAM_URL, 'https://www.instagram.com/'),
  EMAIL: email(process.env.SUPPORT_EMAIL || process.env.EMAIL),
  CONTRIBUTOR_NAME: (process.env.CONTRIBUTOR_NAME || 'WPSent contributors').slice(0, 150),
  SITE_URL: webUrl(process.env.SITE_URL, 'https://wpsent.xyz').replace(/\/$/, ''),
  SINGLE_USER: process.env.SINGLE_USER === 'true'
};
function escapeHTML(value) { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
const HTML_CONFIG = Object.fromEntries(Object.entries(CONFIG).map(([k,v])=>[k, typeof v==='string'?escapeHTML(v):v]));
module.exports = { CONFIG, HTML_CONFIG, escapeHTML, MAX_ATTEMPTS, LOCKOUT_MS };
