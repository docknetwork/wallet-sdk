#!/usr/bin/env node
/*
 * Installs the packed workspace packages into a clean project outside the
 * monorepo and checks that they load the way a customer would get them: no
 * root `overrides`, no Jest transforms.
 *
 * Fails if the legacy `esm` loader is anywhere in the installed tree, or if
 * any entry point throws when required.
 *
 * Usage:
 *   node scripts/test-packed-install.js --pack [dir]  # pack built packages into dir
 *   node scripts/test-packed-install.js [dir]         # install from dir and check
 *
 * Packages must be built first (`npm run build`).
 */
const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES = ['dids', 'data-store', 'wasm', 'core', 'relay-service'];
const ENTRY_POINTS = [
  '@docknetwork/wallet-sdk-dids',
  '@docknetwork/wallet-sdk-data-store/lib/index',
  '@docknetwork/wallet-sdk-wasm/lib/services/index',
  '@docknetwork/wallet-sdk-wasm/lib/services/relay-service/service',
  '@docknetwork/wallet-sdk-core/lib/wallet',
  '@docknetwork/wallet-sdk-core/lib/credential-provider',
  '@docknetwork/wallet-sdk-core/lib/did-provider',
  '@docknetwork/wallet-sdk-core/lib/message-provider',
  '@docknetwork/wallet-sdk-core/lib/cloud-wallet',
  '@docknetwork/wallet-sdk-relay-service/lib/index',
  '@docknetwork/wallet-sdk-relay-service/lib/didcomm',
];

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {encoding: 'utf8', stdio: 'pipe', ...opts});

function pack(dir) {
  fs.mkdirSync(dir, {recursive: true});
  for (const name of PACKAGES) {
    const out = run(
      'npm',
      ['pack', `./packages/${name}`, '--pack-destination', dir, '--json'],
      {cwd: ROOT},
    );
    const [{filename}] = JSON.parse(out);
    console.log(`packed ${filename}`);
  }
}

function check(dir) {
  const tarballs = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.tgz'))
    .map(f => path.join(dir, f));
  if (tarballs.length !== PACKAGES.length) {
    throw new Error(
      `Expected ${PACKAGES.length} tarballs in ${dir}, found ${tarballs.length}`,
    );
  }

  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-sdk-packed-'));
  fs.writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({
      name: 'packed-install-check',
      version: '1.0.0',
      private: true,
    }),
  );

  console.log(`Node ${process.version}, installing into ${project}`);
  run('npm', ['install', '--no-audit', '--no-fund', ...tarballs], {
    cwd: project,
    stdio: 'inherit',
  });

  let failed = false;

  // `npm ls` exits non-zero when nothing matches, and prints the tree when it does.
  let esmTree = '';
  try {
    esmTree = run('npm', ['ls', 'esm', '--all'], {cwd: project});
  } catch (e) {
    esmTree = e.stdout || '';
  }
  if (/\besm@/.test(esmTree)) {
    console.error(`FAIL the legacy esm loader is installed:\n${esmTree}`);
    failed = true;
  } else {
    console.log('OK   no esm package in the installed tree');
  }

  // Load each entry point in its own process so one crash doesn't mask the rest.
  // The child prints only the error's name and message: Node's default crash
  // output includes the offending source line, which for the minified esm
  // loader is ~300KB and gets cut off before the message.
  for (const entry of ENTRY_POINTS) {
    const script = `
      try {
        require(${JSON.stringify(entry)});
        process.exit(0);
      } catch (e) {
        process.stderr.write(String((e && e.name) + ': ' + (e && e.message)));
        process.exit(1);
      }`;
    try {
      run(process.execPath, ['-e', script], {cwd: project, timeout: 120000});
      console.log(`OK   ${entry}`);
    } catch (e) {
      const reason = String(e.stderr || e.message)
        .trim()
        .slice(0, 300);
      console.error(`FAIL ${entry}\n     ${reason}`);
      failed = true;
    }
  }

  fs.rmSync(project, {recursive: true, force: true});
  if (failed) {
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--pack') {
  pack(path.resolve(args[1] || path.join(ROOT, 'packed')));
} else {
  check(path.resolve(args[0] || path.join(ROOT, 'packed')));
}
