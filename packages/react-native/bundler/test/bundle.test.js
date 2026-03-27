/* global globalThis */
const {test, expect} = require('@playwright/test');

const BASE_URL = 'http://localhost:8787';

test.describe('React Native WebView Bundle', () => {
  test('bundle.js should load without JavaScript errors', async ({page}) => {
    const errors = [];
    const consoleErrors = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      errors.push(err.message || err.toString());
    });

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the test page that loads bundle.js
    await page.goto(`${BASE_URL}/bundler/test/test-page.html`, {
      waitUntil: 'load',
      timeout: 60000,
    });

    // Wait for the bundle to finish initializing
    await page.waitForTimeout(5000);

    // Check page status
    const status = await page.locator('#status').textContent();

    // Get any errors captured by the page itself
    const pageErrors = await page.evaluate(() => window.__bundleErrors || []);

    // Log for debugging
    if (errors.length > 0) {
      console.log('Page errors:', errors);
    }
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
    if (pageErrors.length > 0) {
      console.log('Bundle errors:', pageErrors);
    }

    // The bundle should load without critical errors
    expect(status).toBe('Ready');
    expect(pageErrors.length).toBe(0);
  });

  test('bundle.js should define expected globals', async ({page}) => {
    page.on('pageerror', () => {}); // suppress for this test

    await page.goto(`${BASE_URL}/bundler/test/test-page.html`, {
      waitUntil: 'load',
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    // Check that key globals are set by the banner and polyfills
    const globals = await page.evaluate(() => {
      return {
        hasProcess: typeof globalThis.process !== 'undefined',
        processType:
          typeof globalThis.process !== 'undefined'
            ? globalThis.process.type
            : null,
        jsSha256NoNodeJs: window.JS_SHA256_NO_NODE_JS,
      };
    });

    expect(globals.hasProcess).toBe(true);
    expect(globals.processType).toBe('renderer');
    expect(globals.jsSha256NoNodeJs).toBe(true);
  });

  test('bundle.js should not have unhandled promise rejections', async ({
    page,
  }) => {
    const rejections = [];

    page.on('pageerror', err => {
      rejections.push(err.message || err.toString());
    });

    await page.goto(`${BASE_URL}/bundler/test/test-page.html`, {
      waitUntil: 'load',
      timeout: 60000,
    });

    // Give time for async initialization
    await page.waitForTimeout(5000);

    const pageErrors = await page.evaluate(() => {
      return (window.__bundleErrors || []).filter(
        e => e.message && e.message.includes('Unhandled rejection'),
      );
    });

    expect(pageErrors.length).toBe(0);
  });
});

test.describe('React Native Sandbox Bundle', () => {
  test('sandbox.js should load without JavaScript errors', async ({page}) => {
    const errors = [];

    page.on('pageerror', err => {
      errors.push(err.message || err.toString());
    });

    await page.goto(`${BASE_URL}/bundler/test/sandbox-test-page.html`, {
      waitUntil: 'load',
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    const status = await page.locator('#status').textContent();
    const pageErrors = await page.evaluate(() => window.__bundleErrors || []);

    if (errors.length > 0) {
      console.log('Sandbox page errors:', errors);
    }
    if (pageErrors.length > 0) {
      console.log('Sandbox bundle errors:', pageErrors);
    }

    expect(status).toBe('Ready');
    expect(pageErrors.length).toBe(0);
  });
});
