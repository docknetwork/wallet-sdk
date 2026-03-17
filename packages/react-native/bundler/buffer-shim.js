// The actual buffer polyfill path is injected via webpack.DefinePlugin as BUFFER_POLYFILL_PATH
// We re-export everything from the polyfill plus browser-native Blob/File
var buffer = require('buffer-polyfill');

var _Blob = (typeof Blob !== 'undefined') ? Blob : undefined;
var _File = (typeof File !== 'undefined') ? File : undefined;

module.exports = {
  Buffer: buffer.Buffer,
  SlowBuffer: buffer.SlowBuffer,
  INSPECT_MAX_BYTES: buffer.INSPECT_MAX_BYTES,
  kMaxLength: buffer.kMaxLength,
  Blob: _Blob,
  File: _File,
};
