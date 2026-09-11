import { DEFAULT_CONFIGS } from '../configs';

describe('Data store', () => {
  it('should validate regex hostnames correctly', () => {
    const mainnetHostnames = DEFAULT_CONFIGS.networks.find(net => net.id === 'mainnet')?.credentialHostnames || [];
    const testnetHostnames = DEFAULT_CONFIGS.networks.find(net => net.id === 'testnet')?.credentialHostnames || [];

    const mainnetPatterns = mainnetHostnames.filter(host => host instanceof RegExp) as RegExp[];
    const testnetPatterns = testnetHostnames.filter(host => host instanceof RegExp) as RegExp[];


    mainnetPatterns.forEach(regex => {
      expect(regex.test('creds.dock.io')).toBe(true);
      expect(regex.test('creds.example.io')).toBe(true);
      expect(regex.test('invalid.dock.io')).toBe(false);
    });


    testnetPatterns.forEach(regex => {
      expect(regex.test('creds-test.dock.io')).toBe(true);
      expect(regex.test('creds-something.io')).toBe(true);
      expect(regex.test('invalid.io')).toBe(false);
    });
  });
});
