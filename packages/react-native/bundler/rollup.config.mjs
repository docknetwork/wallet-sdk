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
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const banner = `if(typeof window!=="undefined"){window.JS_SHA256_NO_NODE_JS=true;}if(typeof globalThis!=="undefined"){if(!globalThis.process)globalThis.process={};globalThis.process.type="renderer";}`;

function createConfig(input, outputFile) {
  return {
    input,
    output: {
      file: path.resolve(__dirname, '../public', outputFile),
      format: 'iife',
      name: 'DockWalletSDK',
      sourcemap: false,
      inlineDynamicImports: true,
      intro: `const global = window;\nif (typeof exports === 'undefined') { var exports = {}; }\nif (typeof module === 'undefined') { var module = { exports: exports }; }\nif (typeof require === 'undefined') { var require = function(m) { console.warn('require(' + m + ') is not available in browser'); return {}; }; require.resolve = function(m) { return m; }; require.main = null; }`,
      banner,
    },
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
    plugins: [
      json(),

      wasm({
        sync: ['*'],
        maxFileSize: 10485760, // 10MB
      }),

      replace({
        __dirname: JSON.stringify('/'),
        preventAssignment: true,
      }),

      // Custom resolver for node: protocol, shims, and browser polyfills
      {
        name: 'node-protocol-resolver',
        async resolveId(source, importer, options) {
          // Handle @digitalcredentials/open-badges-context
          if (source === '@digitalcredentials/open-badges-context' || source.includes('@digitalcredentials/open-badges-context?commonjs-external')) {
            const modulePath = path.resolve(__dirname, '../../../node_modules/@digitalcredentials/open-badges-context/js/index.js');
            return { id: modulePath, external: false };
          }

          // Handle ?commonjs-external marker
          if (source.includes('?commonjs-external')) {
            const actualModule = source.split('?')[0].trim();
            const resolved = await this.resolve(actualModule, importer, {
              skipSelf: true,
              ...options,
            });
            if (resolved && !resolved.external) {
              return { ...resolved, external: false };
            }
            return null;
          }

          // Strip node: protocol
          let moduleName = source;
          if (source.startsWith('node:')) {
            moduleName = source.replace('node:', '');
          }

          // Map Node.js modules to browser polyfills or shims
          const shimMap = {
            crypto: 'crypto-browserify',
            assert: 'assert',
            os: 'os-browserify',
          };

          // Modules resolved to local shims
          const localShimMap = {
            process: path.resolve(__dirname, 'process-shim.js'),
            async_hooks: path.resolve(__dirname, 'async-hooks-shim.js'),
            diagnostics_channel: path.resolve(__dirname, 'diagnostics-channel-shim.js'),
            buffer: path.resolve(__dirname, 'buffer-shim.js'),
            winston: path.resolve(__dirname, 'winston-mock.js'),
            module: path.resolve(__dirname, 'empty-module-shim.js'),
          };

          // Handle jsonpath/lib/aesprim.js -> esprima (aesprim patches esprima using fs+Module which doesn't work in browser)
          if (source.endsWith('/aesprim') || source.endsWith('/aesprim.js') || source === 'aesprim') {
            const esprimaPath = path.resolve(__dirname, '../../../node_modules/esprima/dist/esprima.js');
            return { id: esprimaPath, external: false };
          }

          // Modules that should be stubbed (return empty module)
          const falseModules = [
            'net', 'perf_hooks', 'tls', 'worker_threads',
            'https', 'http', 'fs', 'zlib', 'console',
            'stream/web', 'util/types',
          ];

          if (localShimMap[moduleName]) {
            return { id: localShimMap[moduleName], external: false };
          }

          if (falseModules.includes(moduleName)) {
            return { id: path.resolve(__dirname, 'empty-module-shim.js'), external: false };
          }

          if (shimMap[moduleName]) {
            const resolved = await this.resolve(shimMap[moduleName], importer, { skipSelf: true, ...options });
            if (resolved) return resolved;
          }

          return null;
        },
      },

      nodePolyfills({
        include: ['util', 'stream', 'process', 'events'],
        exclude: ['buffer'],
      }),

      alias({
        entries: [
          { find: '@cheqd/ts-proto', replacement: path.resolve(__dirname, '../../../node_modules/@cheqd/ts-proto-cjs') },
          { find: 'buffer-polyfill', replacement: path.resolve(__dirname, '../../../node_modules/buffer/index.js') },
          { find: 'winston', replacement: path.resolve(__dirname, 'winston-mock.js') },
          { find: 'jsonpath', replacement: path.resolve(__dirname, '../../../node_modules/jsonpath/index.js') },
          { find: '@cedar-policy/cedar-wasm/nodejs', replacement: path.resolve(__dirname, '../../../node_modules/@cedar-policy/cedar-wasm/web/cedar_wasm.js') },
          { find: '@cedar-policy/cedar-wasm', replacement: path.resolve(__dirname, '../../../node_modules/@cedar-policy/cedar-wasm/web/cedar_wasm.js') },
        ],
      }),

      babel({
        babelHelpers: 'bundled',
        configFile: false,
        babelrc: false,
        exclude: /node_modules\/(?!@docknetwork\/wallet-sdk|@docknetwork\/dock-blockchain|@digitalbazaar|@cheqd)/,
        presets: [
          ['@babel/preset-env', {
            targets: { browsers: '> 0.25%, not dead' },
            modules: false,
          }],
          '@babel/preset-typescript',
        ],
        plugins: [
          ['@babel/plugin-proposal-class-properties', { loose: false }],
          ['@babel/plugin-proposal-private-methods', { loose: false }],
          ['@babel/plugin-proposal-private-property-in-object', { loose: false }],
          '@babel/plugin-transform-flow-strip-types',
        ],
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
      }),

      // Convert CJS to ESM - handles module.exports -> default export interop
      commonjs({
        transformMixedEsModules: true,
        ignoreDynamicRequires: true,
        requireReturnsDefault: 'auto',
        esmExternals: false,
      }),

      // Resolve node_modules
      resolve({
        browser: true,
        preferBuiltins: false,
        extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx', '.cjs'],
      }),

      inject({
        modules: {
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        },
      }),

      replace({
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env': JSON.stringify({}),
        preventAssignment: true,
      }),
    ],
  };
}

export default function getConfig(env) {
  const entry = env?.entry || 'bundle';

  if (entry === 'sandbox') {
    return createConfig(
      path.resolve(__dirname, 'webview-sandbox.js'),
      'sandbox.js',
    );
  }

  return createConfig(
    path.resolve(__dirname, 'webview-index.js'),
    'bundle.js',
  );
}
