// Compatibility shim for jwt-decode v3/v4
// Some dependencies use default import (v3 style: `import jwtDecode from 'jwt-decode'`)
// while others use named import (v4 style: `import { jwtDecode } from 'jwt-decode'`)
const {jwtDecode, InvalidTokenError} = require('jwt-decode/build/cjs/index.js');

module.exports = jwtDecode;
module.exports.default = jwtDecode;
module.exports.jwtDecode = jwtDecode;
module.exports.InvalidTokenError = InvalidTokenError;
