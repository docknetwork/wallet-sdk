const {chromium} = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../public');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.json': 'application/json',
};

function createServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(
        publicDir,
        req.url === '/' ? 'index.html' : req.url,
      );
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, {'Content-Type': contentType});
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

(async () => {
  const server = await createServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();

  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning') {
      warnings.push(text);
    }
  });

  page.on('pageerror', err => {
    errors.push(err.stack || err.message);
  });

  console.log(`Serving ${publicDir} at ${url}\n`);

  try {
    await page.goto(url, {waitUntil: 'load', timeout: 30000});
    await page.waitForTimeout(3000);

    // Check if the app is actually functional despite WASM warnings
    const appState = await page.evaluate(() => {
      return {
        hasErrors: typeof window.__WALLET_SDK_ERROR__ !== 'undefined',
        windowKeys: Object.keys(window)
          .filter(
            k =>
              k.includes('sodium') ||
              k.includes('Sodium') ||
              k.includes('wallet') ||
              k.includes('Wallet'),
          )
          .slice(0, 10),
      };
    });
    console.log('\nApp state:', JSON.stringify(appState, null, 2));
  } catch (e) {
    errors.push(`Page load failed: ${e.message}`);
  }

  if (errors.length) {
    console.log(`--- ERRORS (${errors.length}) ---`);
    errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
  } else {
    console.log('No errors found!');
  }

  if (warnings.length) {
    console.log(`\n--- WARNINGS (${warnings.length}) ---`);
    warnings.forEach((w, i) => console.log(`${i + 1}. ${w}`));
  }

  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})();
