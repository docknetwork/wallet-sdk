const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const universityDegree = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../integration-tests/data/default-presentation-tests/university-degree.json'),
    'utf-8',
  ),
);
const universityDegree2 = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../integration-tests/data/default-presentation-tests/university-degree-2.json'),
    'utf-8',
  ),
);
const equinetCreditScore = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../integration-tests/data/default-presentation-tests/equinet-credit-score.json'),
    'utf-8',
  ),
);

const TEST_CONFIG = {
  edvUrl: 'https://edv.dock.io',
  edvAuthKey: process.env.TEST_EDV_AUTH_KEY,
  networkId: 'testnet',
};

const certsApiUrl = process.env.TESTING_API_URL || 'https://api-staging.dock.io';
const certsApiKey = process.env.CERTS_API_KEY;

// Template IDs (same as integration tests)
const template1 = '91138d81-1b54-4955-a5bc-4e2d90d8f7b1'; // university degree
const template2 = 'a7786f42-03ee-4f49-80b8-ce3027b5a903'; // 1 range proof (creditScore > 50)
const template3 = 'a3e775bb-aaab-4489-b31b-746dc74f76c5'; // any credential with dateOfBirth
const template4 = '9b434ed1-3b65-4b7c-b678-afc7e218f063'; // 2 range proofs

// Performance report collected across all tests
const perfReport = [];

async function createProofRequest(templateId, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(
      `${certsApiUrl}/proof-templates/${templateId}/request`,
      {
        method: 'POST',
        headers: {
          'DOCK-API-TOKEN': certsApiKey,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );

    if (response.status === 429 || response.status >= 500) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000 * attempt));
        continue;
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Proof request failed (${response.status}): ${JSON.stringify(data)}`);
    }

    if (data.request && !data.request.id) {
      data.request.id = data.id;
    }
    return data;
  }
}

test.describe('Default presentation e2e', () => {
  // Increase timeout for blockchain operations
  // Retries handle occasional accumulator proof flakiness when tests run in quick succession
  test.setTimeout(180_000);
  test.describe.configure({retries: 2});

  let walletHandle;

  test.beforeAll(async ({browser}) => {
    const page = await browser.newPage();
    await page.goto('http://localhost:8686/test/test-page.html');
    await page.waitForSelector('#status:has-text("Ready")', {timeout: 60_000});

    // Initialize wallet and add credentials in the browser
    const result = await page.evaluate(
      async ({config, credentials}) => {
        try {
          const initStart = Date.now();
          const {mnemonic} =
            await window.TruveraWebWallet.generateCloudWalletMasterKey();

          const wallet = await window.TruveraWebWallet.initialize({
            edvUrl: config.edvUrl,
            edvAuthKey: config.edvAuthKey,
            mnemonic,
            networkId: config.networkId,
            databasePath: 'test-default-presentation-' + Date.now(),
          });
          const initDuration = Date.now() - initStart;

          // Add test credentials via credentialProvider
          const addStart = Date.now();
          for (const cred of credentials) {
            await wallet.credentialProvider.addCredential(cred);
          }
          const addDuration = Date.now() - addStart;

          const allCredentials = await wallet.getCredentials();

          // Store wallet on window for subsequent tests
          window.__testWallet = wallet;

          return {
            success: true,
            credentialsCount: allCredentials.length,
            perf: {initDuration, addDuration},
          };
        } catch (error) {
          return {success: false, error: error.message, stack: error.stack};
        }
      },
      {
        config: TEST_CONFIG,
        credentials: [universityDegree, universityDegree2, equinetCreditScore],
      },
    );

    expect(result.success).toBe(true);
    expect(result.credentialsCount).toBe(3);

    perfReport.push({
      step: 'Setup',
      walletInit: `${result.perf.initDuration}ms`,
      addCredentials: `${result.perf.addDuration}ms`,
    });
    console.log(`[PERF] Wallet init: ${result.perf.initDuration}ms | Add 3 credentials: ${result.perf.addDuration}ms`);

    // Keep the page alive for all tests
    walletHandle = page;
  });

  test.afterAll(async () => {
    // Print performance report
    console.log('\n========== PERFORMANCE REPORT ==========');
    console.log('| Template | Create Presentation | Submit | Total |');
    console.log('|----------|-------------------|--------|-------|');
    for (const entry of perfReport) {
      if (entry.template) {
        console.log(`| ${entry.template} | ${entry.createMs}ms | ${entry.submitMs}ms | ${entry.totalMs}ms |`);
      }
    }
    console.log('=========================================\n');

    // Write report to file
    const reportPath = path.resolve(__dirname, '../perf-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(perfReport, null, 2));
    console.log(`Performance report saved to: ${reportPath}`);

    if (walletHandle) {
      await walletHandle.close();
    }
  });

  test('template 1: university degree', async () => {
    const proofRequest = await createProofRequest(template1);

    const result = await walletHandle.evaluate(async proofReq => {
      try {
        const wallet = window.__testWallet;

        const createStart = Date.now();
        const {presentation, submit} = await wallet.createPresentation({
          proofRequest: proofReq,
        });
        const createMs = Date.now() - createStart;

        const submitStart = Date.now();
        const submitResult = await submit();
        const submitMs = Date.now() - submitStart;

        return {
          success: true,
          hasPresentation: !!presentation,
          type: presentation?.type,
          credentialCount: presentation?.verifiableCredential?.length,
          verified: submitResult?.verified,
          perf: {createMs, submitMs, totalMs: createMs + submitMs},
        };
      } catch (error) {
        return {success: false, error: error.message, stack: error.stack};
      }
    }, proofRequest);

    if (result.perf) {
      perfReport.push({template: 'T1: University degree', ...result.perf});
      console.log(`[PERF] T1 | Create: ${result.perf.createMs}ms | Submit: ${result.perf.submitMs}ms | Total: ${result.perf.totalMs}ms`);
    }

    expect(result.success).toBe(true);
    expect(result.hasPresentation).toBe(true);
    expect(result.type).toEqual(['VerifiablePresentation']);
    expect(result.credentialCount).toBe(1);
    expect(result.verified).toBe(true);
  });

  test('template 2: range proof (creditScore > 50)', async () => {
    const proofRequest = await createProofRequest(template2);

    const result = await walletHandle.evaluate(async proofReq => {
      try {
        const wallet = window.__testWallet;

        const createStart = Date.now();
        const {presentation, submit} = await wallet.createPresentation({
          proofRequest: proofReq,
        });
        const createMs = Date.now() - createStart;

        const submitStart = Date.now();
        const submitResult = await submit();
        const submitMs = Date.now() - submitStart;

        return {
          success: true,
          hasPresentation: !!presentation,
          type: presentation?.type,
          credentialCount: presentation?.verifiableCredential?.length,
          verified: submitResult?.verified,
          perf: {createMs, submitMs, totalMs: createMs + submitMs},
        };
      } catch (error) {
        return {success: false, error: error.message, stack: error.stack};
      }
    }, proofRequest);

    if (result.perf) {
      perfReport.push({template: 'T2: Range proof (creditScore)', ...result.perf});
      console.log(`[PERF] T2 | Create: ${result.perf.createMs}ms | Submit: ${result.perf.submitMs}ms | Total: ${result.perf.totalMs}ms`);
    }

    expect(result.success).toBe(true);
    expect(result.hasPresentation).toBe(true);
    expect(result.type).toEqual(['VerifiablePresentation']);
    expect(result.credentialCount).toBe(1);
    expect(result.verified).toBe(true);
  });

  test('template 3: any credential with dateOfBirth', async () => {
    const proofRequest = await createProofRequest(template3);

    const result = await walletHandle.evaluate(async proofReq => {
      try {
        const wallet = window.__testWallet;

        const createStart = Date.now();
        const {presentation, submit} = await wallet.createPresentation({
          proofRequest: proofReq,
        });
        const createMs = Date.now() - createStart;

        const submitStart = Date.now();
        const submitResult = await submit();
        const submitMs = Date.now() - submitStart;

        return {
          success: true,
          hasPresentation: !!presentation,
          type: presentation?.type,
          credentialCount: presentation?.verifiableCredential?.length,
          verified: submitResult?.verified,
          perf: {createMs, submitMs, totalMs: createMs + submitMs},
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack,
          responseData: error.response?.data,
        };
      }
    }, proofRequest);

    if (!result.success) {
      console.error('Template 3 error:', result.error, result.responseData);
    }
    if (result.perf) {
      perfReport.push({template: 'T3: Any cred with dateOfBirth', ...result.perf});
      console.log(`[PERF] T3 | Create: ${result.perf.createMs}ms | Submit: ${result.perf.submitMs}ms | Total: ${result.perf.totalMs}ms`);
    }

    expect(result.success).toBe(true);
    expect(result.hasPresentation).toBe(true);
    expect(result.type).toEqual(['VerifiablePresentation']);
    expect(result.credentialCount).toBe(1);
    expect(result.verified).toBe(true);
  });

  test('template 4: 2 range proofs', async () => {
    const proofRequest = await createProofRequest(template4);

    const result = await walletHandle.evaluate(async proofReq => {
      try {
        const wallet = window.__testWallet;

        const createStart = Date.now();
        const {presentation, submit} = await wallet.createPresentation({
          proofRequest: proofReq,
        });
        const createMs = Date.now() - createStart;

        const submitStart = Date.now();
        const submitResult = await submit();
        const submitMs = Date.now() - submitStart;

        return {
          success: true,
          hasPresentation: !!presentation,
          type: presentation?.type,
          credentialCount: presentation?.verifiableCredential?.length,
          verified: submitResult?.verified,
          perf: {createMs, submitMs, totalMs: createMs + submitMs},
        };
      } catch (error) {
        return {success: false, error: error.message, stack: error.stack};
      }
    }, proofRequest);

    if (result.perf) {
      perfReport.push({template: 'T4: 2 range proofs', ...result.perf});
      console.log(`[PERF] T4 | Create: ${result.perf.createMs}ms | Submit: ${result.perf.submitMs}ms | Total: ${result.perf.totalMs}ms`);
    }

    expect(result.success).toBe(true);
    expect(result.hasPresentation).toBe(true);
    expect(result.type).toEqual(['VerifiablePresentation']);
    expect(result.credentialCount).toBeGreaterThanOrEqual(1);
    expect(result.verified).toBe(true);
  });
});
