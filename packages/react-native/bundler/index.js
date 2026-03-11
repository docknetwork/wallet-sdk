const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

const getWebpackConfig = ({entry, path, filename}) => ({
  mode: 'development',
  entry,
  output: {
    path,
    filename,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.mjs', '.cjs'],
    alias: {
      '@cheqd/ts-proto': '@cheqd/ts-proto-cjs',
      'stream/web': false,
      'util/types': false,
    },
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert'),
      buffer: require.resolve('buffer'),
      os: require.resolve('os-browserify'),
      process: require.resolve('process'),
      async_hooks: false,
      console: false,
      diagnostics_channel: false,
      net: false,
      perf_hooks: false,
      tls: false,
      worker_threads: false,
      https: false,
      http: false,
      fs: false,
      zlib: false,
      path: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(m|c)?(j|t)s$/,
        exclude: [
          /\/node_modules\/(?!@docknetwork|@digitalbazaar|@cheqd\/ts-proto)/,
        ],
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            rootMode: 'upward',
            presets: ['@babel/preset-env', '@babel/preset-typescript'],
            plugins: [
              '@babel/plugin-transform-async-to-generator',
              '@babel/plugin-syntax-bigint',
              '@babel/plugin-transform-modules-commonjs',
              '@babel/plugin-transform-class-properties',
              '@babel/plugin-transform-private-methods',
              '@babel/plugin-transform-private-property-in-object',
              '@babel/plugin-transform-flow-strip-types',
            ],
          },
        },
      },
    ],
  },
  experiments: {
    syncWebAssembly: true,
    asyncWebAssembly: true,
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
      resource.request = resource.request.replace(/^node:/, '');
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(process.env),
    }),
    new NodePolyfillPlugin({
      excludeAliases: ['console'],
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: require.resolve('process/browser'),
    }),
  ],
});

function build({entry, path, filename, callback}) {
  const compiler = webpack(
    getWebpackConfig({
      entry,
      path,
      filename,
    }),
  );

  compiler.run(function (err, stats) {
    if (err) {
      console.error(err);
    }

    if (stats.compilation.errors.length) {
      console.log(stats.compilation.errors);
      process.exit(1);
    }

    console.log('Build succeeded');

    if (callback) {
      callback();
    }
  });
}

module.exports = {
  getWebpackConfig,
  build,
};
