const {test, expect} = require('@playwright/test');

const allCredentials = [
  {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://ld.truvera.io/credentials/extensions-v1',
      'https://ld.truvera.io/security/bbs23/v1',
      {
        QuotientLoyaltyCard: 'dk:QuotientLoyaltyCard',
        customerID: 'dk:customerID',
        customerName: 'dk:customerName',
        dk: 'https://ld.truvera.io/credentials#',
        loyaltyCardNumber: 'dk:loyaltyCardNumber',
      },
    ],
    credentialStatus: {
      id: 'accumulator:cheqd:testnet:59459883-4e4d-40a0-bb4f-2b7c42405dd3:aac15524-4aff-43bd-b132-1779eb7dcf36',
      type: 'DockVBAccumulator2022',
      revocationCheck: 'membership',
      revocationId: '80',
    },
    id: 'https://creds-testnet.truvera.io/e66ee7ff343b74248d80da9a56e32fb38b6956cdee5534fe738ef6fe44a6913a',
    type: ['VerifiableCredential', 'QuotientLoyaltyCard'],
    credentialSubject: {
      id: 'did:key:z6MkqEFT8w27x18qRqf7SBnd882pNWsBZPLnk5hVZfVP9AqG',
      customerID: 'CIDT2CQ0E',
      customerName: 'Grace Lee',
      loyaltyCardNumber: '6048443734212353276',
    },
    issuanceDate: '2026-03-31T13:05:53.563Z',
    issuer: {
      name: 'Quotient',
      logo: 'https://img.truvera.io/d689827d822056c6da742080ac6c80ba',
      id: 'did:cheqd:testnet:59459883-4e4d-40a0-bb4f-2b7c42405dd3',
    },
    credentialSchema: {
      id: 'https://schema.truvera.io/QuotientLoyaltyCard-V1-1768398982554.json',
      type: 'JsonSchemaValidator2018',
      details:
        '{"jsonSchema":{"$id":"https://schema.truvera.io/QuotientLoyaltyCard-V1-1768398982554.json","$schema":"http://json-schema.org/draft-07/schema#","additionalProperties":true,"description":"Schema to issue loyalty card credentials to Quotient customers","name":"Quotient Loyalty Card","properties":{"@context":{"type":"string"},"credentialSchema":{"properties":{"details":{"type":"string"},"id":{"type":"string"},"type":{"type":"string"},"version":{"type":"string"}},"type":"object"},"credentialStatus":{"properties":{"id":{"type":"string"},"revocationCheck":{"type":"string"},"revocationId":{"type":"string"},"type":{"type":"string"}},"type":"object"},"credentialSubject":{"properties":{"customerID":{"description":"","title":"Customer ID","type":"string"},"customerName":{"title":"Customer Name","type":"string"},"id":{"description":"A unique identifier of the recipient. Example: DID, email address, national ID number, employee ID, student ID etc.","title":"ID","type":"string"},"loyaltyCardNumber":{"title":"Loyalty card number","type":"string"}},"required":["loyaltyCardNumber","customerID","customerName"],"type":"object"},"cryptoVersion":{"type":"string"},"id":{"type":"string"},"issuanceDate":{"format":"date-time","type":"string"},"issuer":{"properties":{"id":{"type":"string"},"logo":{"type":"string"},"name":{"type":"string"}},"type":"object"},"name":{"type":"string"},"proof":{"properties":{"@context":{"items":[{"properties":{"proof":{"properties":{"@container":{"type":"string"},"@id":{"type":"string"},"@type":{"type":"string"}},"type":"object"},"sec":{"type":"string"}},"type":"object"},{"type":"string"}],"type":"array"},"created":{"format":"date-time","type":"string"},"proofPurpose":{"type":"string"},"type":{"type":"string"},"verificationMethod":{"type":"string"}},"type":"object"},"type":{"type":"string"}},"type":"object"},"parsingOptions":{"defaultDecimalPlaces":4,"defaultMinimumDate":-17592186044415,"defaultMinimumInteger":-4294967295,"useDefaults":true}}',
      version: '0.4.0',
    },
    name: 'Quotient Loyalty Card',
    cryptoVersion: '0.6.0',
    proof: {
      '@context': [
        {
          sec: 'https://w3id.org/security#',
          proof: {
            '@id': 'sec:proof',
            '@type': '@id',
            '@container': '@graph',
          },
        },
        'https://ld.truvera.io/security/bbs23/v1',
      ],
      type: 'Bls12381BBSSignatureDock2023',
      created: '2026-03-31T13:05:57Z',
      verificationMethod:
        'did:cheqd:testnet:59459883-4e4d-40a0-bb4f-2b7c42405dd3#keys-2',
      proofPurpose: 'assertionMethod',
      proofValue:
        'z2TZXgpEqiRkAmoB8XRvZZj8KJBpgFv5M9vVj4Nm5uYAj5nw5XwDRN2gYwyVyWtyrwyBtWHbbfhfahWWZN49RwHeedJ7kEuzCrxoSU5HQAKxHPG',
    },
    $$accum__witness$$:
      '{"blockNo":"d10f73a8-8aed-4e5c-be8d-24105cb494ac","witness":"0x935dd2dcf49a488a9aafda317abc477a8cd8c0edcfdf7f79a6fe4f51b0b352cf4d050822e8d44ecb001a8d98c7a618f2"}',
  },
  {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://ld.truvera.io/credentials/extensions-v1',
      'https://ld.truvera.io/security/bbs23/v1',
      {
        QuotientCustomerIdentity: 'dk:QuotientCustomerIdentity',
        address: 'dk:address',
        age: 'dk:age',
        customerID: 'dk:customerID',
        dateOfBirth: 'dk:dateOfBirth',
        dk: 'https://ld.truvera.io/credentials#',
        fullName: 'dk:fullName',
        phoneNumber: 'dk:phoneNumber',
      },
    ],
    credentialStatus: {
      id: 'accumulator:cheqd:testnet:59459883-4e4d-40a0-bb4f-2b7c42405dd3:aac15524-4aff-43bd-b132-1779eb7dcf36',
      type: 'DockVBAccumulator2022',
      revocationCheck: 'membership',
      revocationId: '79',
    },
    id: 'https://creds-testnet.truvera.io/76dd0f26a04b4253ac29faf08555e43a5d6329bdc6659dc35a35ee6645750b91',
    type: ['VerifiableCredential', 'QuotientCustomerIdentity'],
    credentialSubject: {
      id: 'did:key:z6MkqEFT8w27x18qRqf7SBnd882pNWsBZPLnk5hVZfVP9AqG',
      age: 51,
      address: '654 Cedar Ln, Austin, TX 78701',
      fullName: 'Grace Lee',
      customerID: 'CIDT2CQ0E',
      dateOfBirth: '1974-10-17',
      phoneNumber: '+14519037960',
    },
    issuanceDate: '2026-03-31T13:05:53.563Z',
    issuer: {
      name: 'Quotient',
      logo: 'https://img.truvera.io/d689827d822056c6da742080ac6c80ba',
      id: 'did:cheqd:testnet:59459883-4e4d-40a0-bb4f-2b7c42405dd3',
    },
    credentialSchema: {
      id: 'https://schema.truvera.io/QuotientCustomerIdentity-V1-1768398916249.json',
      type: 'JsonSchemaValidator2018',
      details:
        '{"jsonSchema":{"$id":"https://schema.truvera.io/QuotientCustomerIdentity-V1-1768398916249.json","$schema":"http://json-schema.org/draft-07/schema#","additionalProperties":true,"description":"Schema to issue identity credentials for Quotient customers","name":"Quotient Customer Identity","properties":{"@context":{"type":"string"},"credentialSchema":{"properties":{"details":{"type":"string"},"id":{"type":"string"},"type":{"type":"string"},"version":{"type":"string"}},"type":"object"},"credentialStatus":{"properties":{"id":{"type":"string"},"revocationCheck":{"type":"string"},"revocationId":{"type":"string"},"type":{"type":"string"}},"type":"object"},"credentialSubject":{"properties":{"address":{"title":"Address","type":"string"},"age":{"title":"Age","type":"number"},"customerID":{"title":"Customer ID","type":"string"},"dateOfBirth":{"format":"date","title":"Date of birth","type":"string"},"fullName":{"description":"","title":"Full Name","type":"string"},"id":{"description":"A unique identifier of the recipient. Example: DID, email address, national ID number, employee ID, student ID etc.","title":"ID","type":"string"},"phoneNumber":{"title":"Phone number","type":"string"}},"required":["fullName","age","phoneNumber","customerID"],"type":"object"},"cryptoVersion":{"type":"string"},"id":{"type":"string"},"issuanceDate":{"format":"date-time","type":"string"},"issuer":{"properties":{"id":{"type":"string"},"logo":{"type":"string"},"name":{"type":"string"}},"type":"object"},"name":{"type":"string"},"proof":{"properties":{"@context":{"items":[{"properties":{"proof":{"properties":{"@container":{"type":"string"},"@id":{"type":"string"},"@type":{"type":"string"}},"type":"object"},"sec":{"type":"string"}},"type":"object"},{"type":"string"}],"type":"array"},"created":{"format":"date-time","type":"string"},"proofPurpose":{"type":"string"},"type":{"type":"string"},"verificationMethod":{"type":"string"}},"type":"object"},"type":{"type":"string"}},"type":"object"},"parsingOptions":{"defaultDecimalPlaces":4,"defaultMinimumDate":-17592186044415,"defaultMinimumInteger":-4294967295,"useDefaults":true}}',
      version: '0.4.0',
    },
    name: 'Quotient Customer Identity',
    cryptoVersion: '0.6.0',
    proof: {
      '@context': [
        {
          sec: 'https://w3id.org/security#',
          proof: {
            '@id': 'sec:proof',
            '@type': '@id',
            '@container': '@graph',
          },
        },
        'https://ld.truvera.io/security/bbs23/v1',
      ],
      type: 'Bls12381BBSSignatureDock2023',
      created: '2026-03-31T13:05:55Z',
      verificationMethod:
        'did:cheqd:testnet:59459883-4e4d-40a0-bb4f-2b7c42405dd3#keys-2',
      proofPurpose: 'assertionMethod',
      proofValue:
        'z2mhJL8VK9cvvRuBqEkscjqUtXG2nCQ2oLH1NvuUT6uejKMha61Zz7ux61nui1X3cYsjc8nTmQLMgH7T5y4L8PH29eEVykbGtAT5rnxQAUjoxra',
    },
    $$accum__witness$$:
      '{"blockNo":"d10f73a8-8aed-4e5c-be8d-24105cb494ac","witness":"0xb8ff9c2afe1753a7b455315127e402ec7357110dfda15460f8df55b474220ec5f29de9177dd60dc409751ede1d1f66fb"}',
  },
];

const TEST_CONFIG = {
  edvUrl: 'https://edv.dock.io',
  edvAuthKey: process.env.TEST_EDV_AUTH_KEY,
  networkId: 'testnet',
};

const certsApiUrl =
  process.env.CERTS_API_URL ||
  process.env.TESTING_API_URL ||
  'https://api-staging.dock.io';
const certsApiKey = process.env.CERTS_API_KEY;

// Compound proof template: requires both QuotientLoyaltyCard + QuotientCustomerIdentity
const compoundTemplateId = '0dd6f2bc-a035-4d97-b9de-bfa7ccb72b56';

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
      throw new Error(
        `Proof request failed (${response.status}): ${JSON.stringify(data)}`,
      );
    }

    if (data.request && !data.request.id) {
      data.request.id = data.id;
    }
    return data;
  }
}

test.describe('Compound presentation e2e', () => {
  test.setTimeout(180_000);
  test.describe.configure({retries: 2});

  let walletHandle;

  test.beforeAll(async ({browser}) => {
    const page = await browser.newPage();
    await page.goto('http://localhost:8686/test/test-page.html');
    await page.waitForSelector('#status:has-text("Ready")', {timeout: 60_000});

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
            databasePath: 'test-compound-presentation-' + Date.now(),
          });
          const initDuration = Date.now() - initStart;

          const addStart = Date.now();
          for (const cred of credentials) {
            await wallet.credentialProvider.addCredential(cred);
          }
          const addDuration = Date.now() - addStart;

          const allCreds = await wallet.getCredentials();

          window.__testWallet = wallet;

          return {
            success: true,
            credentialsCount: allCreds.length,
            perf: {initDuration, addDuration},
          };
        } catch (error) {
          return {success: false, error: error.message, stack: error.stack};
        }
      },
      {
        config: TEST_CONFIG,
        credentials: allCredentials,
      },
    );

    expect(result.success).toBe(true);
    expect(result.credentialsCount).toBe(2);

    console.log(
      `[PERF] Wallet init: ${result.perf.initDuration}ms | Add 2 credentials: ${result.perf.addDuration}ms`,
    );

    walletHandle = page;
  });

  test.afterAll(async () => {
    if (walletHandle) {
      await walletHandle.close();
    }
  });

  test('compound: QuotientLoyaltyCard + QuotientCustomerIdentity', async () => {
    const proofRequest = await createProofRequest(compoundTemplateId);

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
          createMs,
          submitMs,
        };
      } catch (error) {
        return {success: false, error: error.message, stack: error.stack};
      }
    }, proofRequest);

    if (!result.success) {
      console.error('Compound test error:', result.error);
    }
    if (result.createMs) {
      console.log(
        `[PERF] Compound | Create: ${result.createMs}ms | Submit: ${
          result.submitMs
        }ms | Total: ${result.createMs + result.submitMs}ms`,
      );
    }

    expect(result.success).toBe(true);
    expect(result.hasPresentation).toBe(true);
    expect(result.type).toEqual(['VerifiablePresentation']);
    expect(result.credentialCount).toBe(2);
    expect(result.verified).toBe(true);
  });
});
