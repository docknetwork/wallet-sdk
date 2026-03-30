const {build} = require('./index');

build({entry: 'bundle'}).catch(err => {
  console.error(err);
  process.exit(1);
});
