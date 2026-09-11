module.exports = {
  preset: "ts-jest",
  testEnvironment: 'node',
  testTimeout: 30000,
  maxConcurrency: 2,
  testMatch: [
    "<rootDir>/packages/**/!(*.e2e).test.js",
    "<rootDir>/packages/**/!(*.e2e).test.ts",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.rollup.cache/",
    "/bundler/",
    // packages/react-native has its own jest.config.js/environment and intentionally
    // only runs .test.js there; its .test.ts files aren't ready for that package's own suite either.
    "packages/react-native/.*\\.test\\.ts$",
  ],
  // Coverage floors are enforced by Codecov on PRs (see codecov.yml), and as a local circuit
  // breaker below via coverageThreshold (see coverage-thresholds.json). Raise the numbers there
  // by hand after adding tests that improve coverage - never lower them.
  collectCoverageFrom: [
    'packages/*/src/**/*.{js,ts}',
    '!packages/*/src/**/*.test.{js,ts}',
    '!packages/*/src/**/*-example.ts',
    '!packages/cli/**',
  ],
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: require('./coverage-thresholds.json'),
  },
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
  setupFilesAfterEnv: ['<rootDir>/setup-tests.js'],
  globalTeardown: './scripts/test-teardown-globals.js',
  setupFiles: ['jest-localstorage-mock'],
  moduleNameMapper: {
    '@digitalbazaar/minimal-cipher': '@digitalbazaar/minimal-cipher/Cipher',
    '@digitalbazaar/did-method-key': '@digitalbazaar/did-method-key/lib/main',
    '@digitalbazaar/http-client':
      '<rootDir>/node_modules/@digitalbazaar/http-client/dist/cjs/index.cjs',
    '@docknetwork/wallet-sdk-wasm/lib/(.*)':
      '@docknetwork/wallet-sdk-wasm/src/$1',
    '@docknetwork/wallet-sdk-data-store/lib/(.*)':
      '@docknetwork/wallet-sdk-data-store/src/$1',
    '@docknetwork/wallet-sdk-data-store-typeorm/lib/(.*)':
      '@docknetwork/wallet-sdk-data-store-typeorm/src/$1',
    '@docknetwork/wallet-sdk-data-store/lib':
      '@docknetwork/wallet-sdk-data-store/src',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!@babel|@docknetwork|@digitalbazaar|base58-universal|multiformats|p-limit|yocto-queue|@cheqd/ts-proto|ky|did-jwt-cjs|@scure/base)',
  ],
};
