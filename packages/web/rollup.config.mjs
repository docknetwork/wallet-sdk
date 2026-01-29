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
import terser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/wallet-sdk-web.iife.js',
      format: 'iife',
      name: 'TruveraWebWallet',
      sourcemap: false,
      intro: `const global = window;`,
    },
    {
      file: 'dist/wallet-sdk-web.esm.js',
      format: 'es',
      sourcemap: false,
      intro: `const global = window;`,
      exports: 'named',
    },
    {
      file: 'dist/wallet-sdk-web.iife.min.js',
      format: 'iife',
      name: 'TruveraWebWallet',
      sourcemap: false,
      intro: `const global = window;`,
      plugins: [terser()],
    }
  ],
  external: [],
  onwarn(warning, warn) {
    // Suppress warnings for known issues
    if (warning.code === 'UNRESOLVED_IMPORT') return;
    if (warning.code === 'MISSING_GLOBAL_NAME') return;
    warn(warning);
  },
  plugins: [
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

        let replacement;
        if (moduleName === 'crypto') {
          replacement = 'crypto-browserify';
        } else if (moduleName === 'stream') {
          replacement = 'stream-browserify';
        } else if (moduleName === 'util') {
          replacement = 'util';
        } else if (moduleName === 'buffer') {
          // Resolve to absolute path to bypass nodePolyfills plugin
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
        { find: '@cedar-policy/cedar-wasm/nodejs', replacement: path.resolve(__dirname, '../../node_modules/@cedar-policy/cedar-wasm/web/cedar_wasm.js') },
        { find: '@cedar-policy/cedar-wasm', replacement: path.resolve(__dirname, '../../node_modules/@cedar-policy/cedar-wasm/web/cedar_wasm.js') },
      ],
    }),

    // Babel transpilation - modules: false is KEY!
    babel({
      babelHelpers: 'bundled',
      exclude: /node_modules\/(?!@docknetwork|@digitalbazaar|@cheqd)/,
      presets: [
        ['@babel/preset-env', {
          targets: { browsers: '> 0.25%, not dead' },
          modules: false, // Critical: let Rollup handle modules
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

    // Convert CommonJS modules to ES6 BEFORE resolve
    commonjs({
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
      requireReturnsDefault: 'auto',
      esmExternals: false, // Don't treat ESM modules as external
    }),

    // Inject Buffer global
    inject({
      modules: {
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      },
    }),

    // Resolve node_modules with explicit crypto mapping
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
  ],
};
