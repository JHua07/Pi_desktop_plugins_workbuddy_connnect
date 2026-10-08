'use strict';
const { homedir } = require('node:os');
const { resolve, join } = require('node:path');
// Compatibility export used ONLY by vendored modules; never touches DSH state.
function resolveDshHome() {
  return process.env.PI_WORKBUDDY_HOME ? resolve(process.env.PI_WORKBUDDY_HOME) : join(homedir(), '.pi-workbuddy-connect');
}
module.exports = { resolveDshHome };
