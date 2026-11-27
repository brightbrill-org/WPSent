'use strict';

// Timeouts reject the caller; they cannot cancel an already-issued CDP command.
// Never retry attachment on the same page: partial listeners may already exist.
function deadline(work, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve().then(work),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(label + ' timed out after ' + ms + 'ms');
        error.code = 'WA_READY_TIMEOUT';
        reject(error);
      }, ms);
    })
  ]).finally(() => clearTimeout(timer));
}
function positiveInt(raw, fallback, min, max) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : fallback;
}
function createWatchdog({ timeoutMs, onTimeout, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  let active = false;
  return {
    start() {
      if (active) return;
      active = true;
      timer = setTimer(() => {
        active = false;
        timer = null;
        onTimeout();
      }, timeoutMs);
    },
    stop() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      active = false;
    }
  };
}
function retryDelay(attempt, baseMs, maxMs = 300000) {
  return Math.min(baseMs * 2 ** Math.max(0, attempt - 1), maxMs);
}

// Instrument this client's attachment, not the shared library prototype.
// A failure must propagate; skipping optional callbacks would falsely signal Ready.
function instrumentAttachment(client, { timeoutMs, log, onFailure }) {
  const original = client.attachEventListeners;
  if (typeof original !== 'function') return;
  let inFlight = null;
  client.attachEventListeners = function (...args) {
    if (inFlight) return inFlight;
    const page = this.pupPage;
    const evaluate = page.evaluate;
    const expose = page.exposeFunction;
    let sequence = 0;
    const run = async (stage, fn) => {
      const start = Date.now();
      log('start ' + stage);
      try {
        const value = await deadline(fn, timeoutMs, stage);
        log('complete ' + stage + ' (' + (Date.now() - start) + 'ms)');
        return value;
      } catch (e) {
        log('failed ' + stage + ': ' + (e.message || String(e)));
        throw e;
      }
    };
    // The dependency checks browser binding presence through evaluate(fn, name).
    // Trace these checks and exposeFunction itself; never log argument payloads.
    const wrappedEvaluate = function (fn, ...params) {
      const name = typeof params[0] === 'string' && /^on[A-Za-z]+$/.test(params[0])
        ? 'check ' + params[0] : 'evaluate #' + (++sequence);
      return run(name, () => evaluate.call(this, fn, ...params));
    };
    const wrappedExpose = function (name, fn) {
      return run('expose ' + name, () => expose.call(this, name, fn));
    };
    page.evaluate = wrappedEvaluate;
    page.exposeFunction = wrappedExpose;
    inFlight = Promise.resolve().then(() => original.apply(this, args))
      .catch(error => {
        onFailure(error);
        throw error;
      }).finally(() => {
        if (page.evaluate === wrappedEvaluate) page.evaluate = evaluate;
        if (page.exposeFunction === wrappedExpose) page.exposeFunction = expose;
        inFlight = null;
      });
    return inFlight;
  };
}

module.exports = { deadline, positiveInt, createWatchdog, retryDelay, instrumentAttachment };
