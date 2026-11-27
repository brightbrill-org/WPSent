'use strict';
let tail = Promise.resolve();
// The supported deployment is a single PM2 fork.
function withControlLock(fn) {
  const next = tail.then(fn);
  tail = next.catch(() => {});
  return next;
}
module.exports = { withControlLock };
