const path = require("path");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      const wasmExtensionRegExp = /\.wasm$/;
      webpackConfig.resolve.extensions.push(".wasm");

      webpackConfig.devtool = false;

      // Alias jwt-decode to a shim that provides both default (v3) and named (v4) exports
      webpackConfig.resolve.alias["jwt-decode"] = path.resolve(__dirname, "src/jwt-decode-shim.js");

      webpackConfig.module.rules.forEach((rule) => {
        if (rule.oneOf) {
          rule.oneOf.forEach((oneOf) => {
            if (oneOf.loader && oneOf.loader.includes("file-loader")) {
              oneOf.exclude.push(wasmExtensionRegExp);
            }
          });
        }
      });

      const wasmLoader = {
        test: /\.wasm$/,
        type: "javascript/auto",
        use: ["wasm-loader"],
      };

      webpackConfig.module.rules.push(wasmLoader);

      webpackConfig.experiments = {
        asyncWebAssembly: true,
      };

      webpackConfig.plugins.push(
        new NodePolyfillPlugin({
          excludeAliases: ["console"],
        })
      );

      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      });

      // Configure output to put all files in the same directory
      webpackConfig.output.filename = '[name].[contenthash:8].js';
      webpackConfig.output.chunkFilename = '[name].[contenthash:8].chunk.js';
      webpackConfig.output.assetModuleFilename = '[name].[hash][ext]';

      // Override MiniCssExtractPlugin filename to avoid assets folder
      webpackConfig.plugins.forEach(plugin => {
        if (plugin.constructor.name === 'MiniCssExtractPlugin') {
          plugin.options.filename = '[name].[contenthash:8].css';
          plugin.options.chunkFilename = '[name].[contenthash:8].chunk.css';
        }
      });

      return webpackConfig;
    },
  },
};
