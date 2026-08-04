// Covers the node-localstorage fallback branch and getAllKeys filtering,
// which index.test.js (native localStorage branch) does not exercise.

async function withFreshService(mockStore, fn) {
  let created;
  let result;
  await new Promise((resolve, reject) => {
    jest.isolateModules(() => {
      jest.doMock('node-localstorage', () => ({
        LocalStorage: jest.fn().mockImplementation(path => {
          created = {path, ...mockStore};
          return created;
        }),
      }));
      const {storageService} = require('./service');
      Promise.resolve(fn(storageService))
        .then(r => {
          result = r;
          resolve();
        })
        .catch(reject);
    });
  });
  return {created, result};
}

describe('StorageService node fallback', () => {
  const nativeLocalStorage = global.localStorage;

  afterEach(() => {
    delete process.env.LOCAL_STORAGE_PATH;
    global.localStorage = nativeLocalStorage;
    jest.resetModules();
  });

  it('falls back to node-localstorage when no global.localStorage', async () => {
    delete global.localStorage;
    const setItem = jest.fn();
    const {created} = await withFreshService({setItem}, s =>
      s.setItem('k', 'v'),
    );
    expect(setItem).toBeCalledWith('k', 'v');
    expect(created.path).toBe('./local-storage');
  });

  it('honors LOCAL_STORAGE_PATH override', async () => {
    delete global.localStorage;
    process.env.LOCAL_STORAGE_PATH = '/tmp/custom-store';
    const {created} = await withFreshService({setItem: jest.fn()}, s =>
      s.setItem('k', 'v'),
    );
    expect(created.path).toBe('/tmp/custom-store');
  });

  it('getAllKeys filters non-string keys', async () => {
    global.localStorage = {
      length: 4,
      key: i => [null, 'a', undefined, 'b'][i],
    };
    const {result} = await withFreshService({}, s => s.getAllKeys());
    expect(result).toEqual(['a', 'b']);
  });
});
