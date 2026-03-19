/**
 * Rollup-based bundler for the React Native WebView SDK.
 * Replaces the previous webpack-based bundler.
 *
 * Usage:
 *   node bundler/build.js         - Build bundle.js
 *   node bundler/build-and-copy.js - Build all bundles and copy to RN assets
 *   node bundler/server.js         - Start dev server
 */

async function build({entry = 'bundle', callback} = {}) {
  const { rollup } = await import('rollup');
  const { default: getConfig } = await import('./rollup.config.mjs');

  const entryName = entry === 'sandbox' ? 'sandbox' : 'bundle';
  const config = getConfig({ entry: entryName });

  console.log(`Building ${entryName}.js with rollup...`);
  const bundle = await rollup(config);
  await bundle.write(config.output);
  await bundle.close();
  console.log(`Build succeeded: ${entryName}.js`);

  if (callback) {
    callback();
  }
}

module.exports = { build };
