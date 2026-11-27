'use strict';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;

const CONFIG = {
  GITHUB_URL:    'https://github.com/YOUR_USERNAME/wpsent',
  INSTAGRAM_URL: 'https://instagram.com/YOUR_INSTAGRAM',
  EMAIL:         'your@email.com',
  SITE_URL:      'https://wpsent.xyz',
  SINGLE_USER:   process.env.SINGLE_USER === 'true' || false,
};

module.exports = { CONFIG, MAX_ATTEMPTS, LOCKOUT_MS };
