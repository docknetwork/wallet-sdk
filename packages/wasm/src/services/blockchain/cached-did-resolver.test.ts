import { CachedDIDResolver } from './cached-did-resolver';
import { storageService } from '../storage';

// jest.mock('../storage', ...) does not intercept this import for this module (the SUT
// keeps a reference to the real singleton regardless), so spy on the real singleton's
// methods instead - it's the same object instance that cached-did-resolver.ts uses.
const mockStorageService = {
  getItem: jest.spyOn(storageService, 'getItem'),
  setItem: jest.spyOn(storageService, 'setItem'),
  removeItem: jest.spyOn(storageService, 'removeItem'),
  getAllKeys: jest.spyOn(storageService, 'getAllKeys'),
};

const mockRouter = {
  resolve: jest.fn(),
  supports: jest.fn(),
};

// JSON.stringify can't be combined with expect.any() matchers (it serializes the matcher
// object literally), so parse the actual stored value and assert on the parsed object.
function expectSetItemCalledWith(key: string, expectedEntry: any) {
  const call = mockStorageService.setItem.mock.calls.find(([k]) => k === key);
  expect(call).toBeDefined();
  expect(JSON.parse(call![1] as string)).toEqual(expectedEntry);
}

describe('CachedDIDResolver', () => {
  let resolver: CachedDIDResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getItem.mockResolvedValue(null);
    mockStorageService.getAllKeys.mockResolvedValue([]);
    resolver = new CachedDIDResolver(mockRouter);
  });

  describe('constructor', () => {
    it('should initialize with default TTL', () => {
      expect(resolver).toBeDefined();
    });

    it('should initialize with custom TTL', () => {
      const customTtl = 60000; // 1 minute
      const resolverWithCustomTtl = new CachedDIDResolver(mockRouter, { ttl: customTtl });
      expect(resolverWithCustomTtl).toBeDefined();
    });
  });

  describe('resolve', () => {
    const testDid = 'did:example:123';
    const testResult = { id: testDid, publicKey: [] };

    it('should resolve DID and cache the result on cache miss', async () => {
      mockRouter.resolve.mockResolvedValue(testResult);
      mockStorageService.getItem.mockResolvedValue(null);

      const result = await resolver.resolve(testDid);

      expect(mockRouter.resolve).toHaveBeenCalledWith(testDid);
      expect(result).toEqual(testResult);
      expectSetItemCalledWith(`did-cache:${testDid}`, {
        value: testResult,
        id: testDid,
        timestamp: expect.any(Number),
      });
    });

    it('should use result.id for cache key instead of input did', async () => {
      const inputDid = 'did:example:input';
      const resultDid = 'did:example:resolved';
      const testResultWithDifferentId = { id: resultDid, publicKey: [] };

      mockRouter.resolve.mockResolvedValue(testResultWithDifferentId);
      mockStorageService.getItem.mockResolvedValue(null);

      const result = await resolver.resolve(inputDid);

      expect(result).toEqual(testResultWithDifferentId);
      // Should use result.id (resultDid) for the cache key, not inputDid
      expectSetItemCalledWith(`did-cache:${resultDid}`, {
        value: testResultWithDifferentId,
        id: resultDid,
        timestamp: expect.any(Number),
      });
    });

    it('should return cached result on cache hit', async () => {
      const cachedData = {
        value: testResult,
        id: testDid,
        timestamp: Date.now(),
      };

      mockStorageService.getItem.mockResolvedValue(JSON.stringify(cachedData));

      const result = await resolver.resolve(testDid);

      expect(result).toEqual(testResult);
      expect(mockRouter.resolve).not.toHaveBeenCalled();
    });

    it('should return stale value immediately and refresh in background when cache entry is expired', async () => {
      const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago (expired)
      const staleResult = { id: testDid, publicKey: [], stale: true };
      const freshResult = { id: testDid, publicKey: [], fresh: true };

      const cachedData = {
        value: staleResult,
        id: testDid,
        timestamp: expiredTimestamp,
      };

      mockStorageService.getItem.mockResolvedValue(JSON.stringify(cachedData));
      mockRouter.resolve.mockResolvedValue(freshResult);

      const result = await resolver.resolve(testDid);

      // Should return stale value immediately
      expect(result).toEqual(staleResult);

      // Background refresh should be triggered (not awaited)
      // Give it time to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRouter.resolve).toHaveBeenCalledWith(testDid);
      expectSetItemCalledWith(`did-cache:${testDid}`, {
        value: freshResult,
        id: testDid,
        timestamp: expect.any(Number),
      });
    });

    it('should handle corrupted cache data gracefully', async () => {
      const testDid = 'did:example:corrupted';
      const testResult = { id: testDid, publicKey: [] };

      // Return invalid JSON from storage
      mockStorageService.getItem.mockResolvedValue('invalid json {');
      mockRouter.resolve.mockResolvedValue(testResult);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await resolver.resolve(testDid);

      expect(consoleSpy).toHaveBeenCalledWith('Error parsing cache entry:', expect.any(Error));
      expect(mockRouter.resolve).toHaveBeenCalledWith(testDid);
      expect(result).toEqual(testResult);

      consoleSpy.mockRestore();
    });
  });

  describe('getCachedDIDs', () => {
    it('should return empty array when no cached DIDs exist', async () => {
      mockStorageService.getAllKeys.mockResolvedValue([]);

      const cachedDIDs = await resolver.getCachedDIDs();

      expect(cachedDIDs).toEqual([]);
      expect(mockStorageService.getAllKeys).toHaveBeenCalled();
    });

    it('should return list of cached DIDs', async () => {
      const allKeys = [
        'did-cache:did:example:123',
        'did-cache:did:example:456',
        'did-cache:did:dock:789',
        'other-key:something',
        'user-preference:theme',
      ];

      mockStorageService.getAllKeys.mockResolvedValue(allKeys);

      const cachedDIDs = await resolver.getCachedDIDs();

      expect(cachedDIDs).toEqual([
        'did:example:123',
        'did:example:456',
        'did:dock:789',
      ]);
      expect(mockStorageService.getAllKeys).toHaveBeenCalled();
    });

    it('should handle empty storage correctly', async () => {
      mockStorageService.getAllKeys.mockResolvedValue([]);

      const cachedDIDs = await resolver.getCachedDIDs();

      expect(cachedDIDs).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear specific DID from cache', async () => {
      const didToRemove = 'did:example:123';

      await resolver.clearCache(didToRemove);

      expect(mockStorageService.removeItem).toHaveBeenCalledWith(`did-cache:${didToRemove}`);
      expect(mockStorageService.removeItem).toHaveBeenCalledTimes(1);
    });

    it('should clear entire cache when no DID specified', async () => {
      const allKeys = [
        'did-cache:did:example:123',
        'did-cache:did:example:456',
        'other-key:something',
      ];

      mockStorageService.getAllKeys.mockResolvedValue(allKeys);

      await resolver.clearCache();

      expect(mockStorageService.getAllKeys).toHaveBeenCalled();
      expect(mockStorageService.removeItem).toHaveBeenCalledWith('did-cache:did:example:123');
      expect(mockStorageService.removeItem).toHaveBeenCalledWith('did-cache:did:example:456');
      expect(mockStorageService.removeItem).not.toHaveBeenCalledWith('other-key:something');
      expect(mockStorageService.removeItem).toHaveBeenCalledTimes(2);
    });

    it('should handle clearing cache when no cached entries exist', async () => {
      mockStorageService.getAllKeys.mockResolvedValue([]);

      await resolver.clearCache();

      expect(mockStorageService.getAllKeys).toHaveBeenCalled();
      expect(mockStorageService.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('supports', () => {
    it('should delegate to router supports method', () => {
      const testId = 'did:example:123';
      mockRouter.supports.mockReturnValue(true);

      const result = resolver.supports(testId);

      expect(mockRouter.supports).toHaveBeenCalledWith(testId);
      expect(result).toBe(true);
    });

    it('should return false when router does not support DID', () => {
      const testId = 'did:unsupported:123';
      mockRouter.supports.mockReturnValue(false);

      const result = resolver.supports(testId);

      expect(mockRouter.supports).toHaveBeenCalledWith(testId);
      expect(result).toBe(false);
    });
  });

  describe('background refresh', () => {
    it('should handle background refresh failure gracefully', async () => {
      const testDid = 'did:example:refresh-fail';
      const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
      const staleResult = { id: testDid, publicKey: [] };

      const cachedData = {
        value: staleResult,
        id: testDid,
        timestamp: expiredTimestamp,
      };

      mockStorageService.getItem.mockResolvedValue(JSON.stringify(cachedData));
      mockRouter.resolve.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await resolver.resolve(testDid);

      expect(result).toEqual(staleResult);

      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Background refresh failed for:',
        testDid,
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});