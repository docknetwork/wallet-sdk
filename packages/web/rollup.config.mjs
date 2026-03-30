import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import wasm from '@rollup/plugin-wasm';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import inject from '@rollup/plugin-inject';
import alias from '@rollup/plugin-alias';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import terser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getPlugins() {
  return [
    // Import JSON files
    json(),

    // Import WASM files
    wasm({
      sync: ['*'],
      maxFileSize: 10485760, // 10MB
    }),

    // Replace __dirname with empty string/slash
    replace({
      __dirname: JSON.stringify('/'),
      preventAssignment: true,
    }),

    // Custom resolver for node: protocol and crypto mapping
    {
      name: 'node-protocol-resolver',
      async resolveId(source, importer, options) {
        // Force CJS version of libsodium-sumo to prevent duplicate bundling.
        // The ESM version's `var WebAssembly` wasm2js override gets stripped by Rollup,
        // causing native WebAssembly.instantiate to be called with wasm2js binary data.
        if (source.includes('libsodium-sumo') && (source.endsWith('.mjs') || source === 'libsodium-sumo')) {
          const cjsPath = path.resolve(__dirname, '../../node_modules/libsodium-sumo/dist/modules-sumo/libsodium-sumo.js');
          return { id: cjsPath, external: false };
        }

        // Special handling for @digitalcredentials/open-badges-context
        if (source === '@digitalcredentials/open-badges-context' || source.includes('@digitalcredentials/open-badges-context?commonjs-external')) {
          const modulePath = path.resolve(__dirname, '../../node_modules/@digitalcredentials/open-badges-context/js/index.js');
          return { id: modulePath, external: false };
        }

        // Handle the commonjs-external marker - strip it and resolve normally
        if (source.includes('?commonjs-external')) {
          const actualModule = source.split('?')[0].trim();

          // Try to resolve through other plugins
          const resolved = await this.resolve(actualModule, importer, {
            skipSelf: true,
            ...options
          });
          if (resolved && !resolved.external) {
            return { ...resolved, external: false };
          }

          return null;
        }

        // Handle node: protocol imports or standard node modules - resolve browserify versions
        let moduleName = source;
        if (source.startsWith('node:')) {
          moduleName = source.replace('node:', '');
        }

        // Redirect aesprim to esprima (aesprim uses fs.readFileSync + Module which don't work in browser)
        if (source.endsWith('/aesprim') || source.endsWith('/aesprim.js') || source === 'aesprim') {
          const esprimaPath = path.resolve(__dirname, '../../node_modules/esprima/dist/esprima.js');
          return { id: esprimaPath, external: false };
        }

        // Stub Node.js-only modules
        const falseModules = [
          'net', 'perf_hooks', 'tls', 'worker_threads',
          'https', 'http', 'fs', 'zlib', 'console',
          'stream/web', 'util/types', 'async_hooks',
          'diagnostics_channel', 'module',
        ];

        if (falseModules.includes(moduleName)) {
          return { id: path.resolve(__dirname, 'empty-module-shim.js'), external: false };
        }

        let replacement;
        if (moduleName === 'crypto') {
          replacement = 'crypto-browserify';
        } else if (moduleName === 'stream') {
          replacement = 'stream-browserify';
        } else if (moduleName === 'util') {
          replacement = 'util';
        } else if (moduleName === 'buffer') {
          const bufferPath = path.resolve(__dirname, '../../node_modules/buffer/index.js');
          return { id: bufferPath, external: false };
        } else if (moduleName === 'winston') {
          return { id: path.resolve(__dirname, 'winston-mock.js'), external: false };
        }

        if (replacement) {
          const resolved = await this.resolve(replacement, importer, { skipSelf: true, ...options });
          if (resolved) {
            return resolved;
          }
        }
        return null;
      },
      // Fix CJS modules where commonjs plugin can't detect named exports.
      // Read the file, strip `module.exports = api;` and append ESM named exports.
      load(id) {
        if (id.includes('@digitalbazaar/http-signature-header/lib/index.js')) {
          let code = fs.readFileSync(id, 'utf8');
          // Remove 'use strict' (ESM is always strict)
          code = code.replace(/'use strict';?\n?/, '');
          // Convert CJS require() to ESM imports
          code = code.replace("const {assert} = require('./util.js');", "import _util from './util.js';\nconst {assert} = _util;");
          code = code.replace("const HttpSignatureError = require('./HttpSignatureError');", "import HttpSignatureError from './HttpSignatureError';");
          // Remove CJS module.exports
          code = code.replace(/module\.exports\s*=\s*api;?/, '');
          // Append ESM named exports
          // Note: parseSignatureHeader, extractPseudoHeaders, HttpSignatureError are
          // already declared as local identifiers, so export them directly.
          // createAuthzHeader, createSignatureString, parseRequest are only on the api object.
          code += `
export const createAuthzHeader = api.createAuthzHeader;
export const createSignatureString = api.createSignatureString;
export const parseRequest = api.parseRequest;
export { parseSignatureHeader, extractPseudoHeaders, HttpSignatureError };
export default api;
`;
          return code;
        }
        return null;
      },
    },

    // Node.js polyfills - provides crypto, util, etc
    nodePolyfills({
      include: ['util', 'stream', 'process', 'events'],
      exclude: ['buffer'],
    }),

    // Alias winston to mock and cedar-wasm to web version
    alias({
      entries: [
        { find: 'winston', replacement: path.resolve(__dirname, 'winston-mock.js') },
        { find: 'jsonpath', replacement: path.resolve(__dirname, '../../node_modules/jsonpath/index.js') },
        { find: '@cedar-policy/cedar-wasm/nodejs', replacement: path.resolve(__dirname, '../../node_modules/@cedar-policy/cedar-wasm/web/cedar_wasm.js') },
        { find: '@cedar-policy/cedar-wasm', replacement: path.resolve(__dirname, '../../node_modules/@cedar-policy/cedar-wasm/web/cedar_wasm.js') },
      ],
    }),

    // Babel transpilation
    babel({
      babelHelpers: 'bundled',
      configFile: false,
      babelrc: false,
      exclude: /node_modules\/(?!@docknetwork\/wallet-sdk|@docknetwork\/dock-blockchain|@digitalbazaar|@cheqd\/sdk)/,
      presets: [
        ['@babel/preset-env', {
          targets: { browsers: '> 0.25%, not dead' },
          modules: false,
        }],
        '@babel/preset-typescript'
      ],
      plugins: [
        ['@babel/plugin-proposal-class-properties', { loose: false }],
        ['@babel/plugin-proposal-private-methods', { loose: false }],
        ['@babel/plugin-proposal-private-property-in-object', { loose: false }],
        '@babel/plugin-transform-flow-strip-types',
      ],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    }),

    // Convert CommonJS modules to ES6
    commonjs({
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
      requireReturnsDefault: 'auto',
      esmExternals: false,
    }),

    // Inject Buffer global
    inject({
      modules: {
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      },
    }),

    // Resolve node_modules
    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
    }),

    // Environment variables
    replace({
      'process.env.NODE_ENV': JSON.stringify('development'),
      preventAssignment: true,
    }),

  ];
}

const sharedConfig = {
  external: [],
  shimMissingExports: true,
  onwarn(warning, warn) {
    if (warning.code === 'UNRESOLVED_IMPORT') return;
    if (warning.code === 'MISSING_GLOBAL_NAME') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    if (warning.code === 'MISSING_EXPORT') return;
    if (warning.code === 'SOURCEMAP_ERROR') return;
    if (warning.code === 'EVAL') return;
    if (warning.code === 'SHIMMED_EXPORT') return;
    warn(warning);
  },
};

const iifeIntro = `const global = window;\nif (typeof exports === 'undefined') { var exports = {}; }\nif (typeof module === 'undefined') { var module = { exports: exports }; }\nif (typeof require === 'undefined') { var require = function(m) { console.warn('require(' + m + ') is not available in browser'); return {}; }; require.resolve = function(m) { return m; }; require.main = null; }`;
const esmIntro = `const global = window;`;

export default [
  {
    input: 'src/index.js',
    output: {
      file: 'dist/wallet-sdk-web.iife.js',
      format: 'iife',
      name: 'TruveraWebWallet',
      sourcemap: false,
      inlineDynamicImports: true,
      intro: iifeIntro,
      exports: 'named',
    },
    ...sharedConfig,
    plugins: getPlugins(),
  },
  {
    input: 'src/index.js',
    output: {
      file: 'dist/wallet-sdk-web.esm.js',
      format: 'es',
      sourcemap: false,
      inlineDynamicImports: true,
      intro: esmIntro,
      exports: 'named',
    },
    ...sharedConfig,
    plugins: getPlugins(),
  },
  {
    input: 'src/index.js',
    output: {
      file: 'dist/wallet-sdk-web.iife.min.js',
      format: 'iife',
      name: 'TruveraWebWallet',
      sourcemap: false,
      inlineDynamicImports: true,
      intro: iifeIntro,
      exports: 'named',
      plugins: [terser()],
    },
    ...sharedConfig,
    plugins: getPlugins(),
  },
];
