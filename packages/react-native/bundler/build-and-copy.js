const {build} = require('./index');

async function buildAll() {
  await build({entry: 'sandbox'});
  await build({entry: 'bundle'});

  console.log('Copying assets...');
  require('./copy-rn-assets');
}

buildAll().catch(err => {
  console.error(err);
  process.exit(1);
});
