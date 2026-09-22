module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: ['default', 'jest-junit', '<rootDir>/scripts/slack-reporter.js'],
  testTimeout: 240000,
  testMatch: ['<rootDir>/integration-tests/**/*.test.ts'],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)?$': [
      'babel-jest',
      {
        configFile: require.resolve('./babel.config.js'),
      },
    ],
  },
  resetMocks: false,
  setupFilesAfterEnv: ['<rootDir>/setup-integration-tests.js'],
  globalTeardown: './scripts/integration-test-teardown.js',
  setupFiles: ['jest-localstorage-mock'],
  moduleNameMapper: {
    'ky-universal': 'ky',
    '^base58-universal$': '<rootDir>/node_modules/base58-universal/lib/index.js',
    '@digitalbazaar/http-client':
      '<rootDir>/node_modules/@digitalbazaar/http-client/dist/cjs/index.cjs',
    '@docknetwork/wallet-sdk-wasm/lib/(.*)':
      '@docknetwork/wallet-sdk-wasm/src/$1',
    '@docknetwork/wallet-sdk-data-store/lib/(.*)':
      '@docknetwork/wallet-sdk-data-store/src/$1',
    '@docknetwork/wallet-sdk-data-store/lib':
      '@docknetwork/wallet-sdk-data-store/src',
    '^@docknetwork/credential-sdk/vc/contexts$':
      '<rootDir>/node_modules/@docknetwork/credential-sdk/dist/cjs/vc/contexts.cjs',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!@babel|@docknetwork|@digitalbazaar|base58-universal|crypto-ld|multiformats|p-limit|yocto-queue|@cheqd/ts-proto|ky|did-jwt-cjs|@scure/base)',
  ],
};
