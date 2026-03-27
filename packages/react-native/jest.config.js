module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['<rootDir>/**/!(*.e2e).test.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/bundler/'],
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx|cjs)$': [
      'babel-jest',
      {
        configFile: require.resolve('./babel.config.js'),
      },
    ],
  },
  resetMocks: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  setupFiles: ['jest-localstorage-mock', 'raf/polyfill'],
  moduleNameMapper: {
    '@digitalbazaar/x25519-key-agreement-key-2020':
      '@digitalbazaar/x25519-key-agreement-key-2020/lib/X25519KeyAgreementKey2020',
    '@digitalbazaar/ed25519-verification-key-2020':
      '@digitalbazaar/ed25519-verification-key-2020/lib/Ed25519VerificationKey2020',
    '@digitalbazaar/ed25519-verification-key-2018':
      '@digitalbazaar/ed25519-verification-key-2018/src/Ed25519VerificationKey2018',
    '@digitalbazaar/minimal-cipher': '@digitalbazaar/minimal-cipher/Cipher',
    '@digitalbazaar/did-method-key': '@digitalbazaar/did-method-key/lib/main',
    'ky-universal/node_modules/node-fetch':
      'ky-universal/node_modules/node-fetch/dist/index.cjs',
    'node-fetch': 'node-fetch/dist/index.cjs',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!@babel|@docknetwork|@digitalbazaar|uuid|@juanelas/base64)',
  ],
};
