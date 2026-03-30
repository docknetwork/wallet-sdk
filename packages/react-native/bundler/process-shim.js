var process = require('process/browser');

if (!process.versions) {
  process.versions = {};
}
if (!process.versions.node) {
  process.versions.node = '18.0.0';
}
// Signal browser-like environment to libraries that check process.type
// (e.g., libsodium, emscripten) so they use browser code paths
process.type = 'renderer';

module.exports = process;
