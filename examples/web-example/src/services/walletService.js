import { generateCloudWalletMasterKey, initializeCloudWallet } from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';
import { createDataStore } from '@docknetwork/wallet-sdk-data-store-web/lib/index';
import { setLocalStorageImpl } from '@docknetwork/wallet-sdk-data-store-web/lib/localStorageJSON';

export const WALLET_PROFILES_KEY = 'walletProfiles';
export const ACTIVE_WALLET_ID_KEY = 'activeWalletId';
const EDV_URL = 'https://edv.dock.io';
const EDV_AUTH_KEY = 'DOCKWALLET-TEST';

export function normalizeWalletKeys(rawKeys) {
  if (!rawKeys) {
    throw new Error('Missing wallet keys');
  }

  let masterKeyArray;
  if (rawKeys.masterKey instanceof Uint8Array) {
    masterKeyArray = Array.from(rawKeys.masterKey);
  } else if (Array.isArray(rawKeys.masterKey)) {
    masterKeyArray = rawKeys.masterKey;
  } else if (rawKeys.masterKey && typeof rawKeys.masterKey === 'object') {
    masterKeyArray = Object.values(rawKeys.masterKey);
  } else {
    throw new Error('Invalid master key format');
  }

  return {
    masterKey: new Uint8Array(masterKeyArray),
    mnemonic: rawKeys.mnemonic,
  };
}

export function serializeWalletKeys(keys) {
  return {
    masterKey: Array.from(keys.masterKey || []),
    mnemonic: keys.mnemonic,
  };
}

export function createWalletProfile(keys, index = 1) {
  return {
    id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Wallet ${index}`,
    createdAt: new Date().toISOString(),
    keys,
  };
}

export function createScopedLocalStorage(scope) {
  const prefix = `walletScope:${scope}:`;

  return {
    getItem: (key) => localStorage.getItem(`${prefix}${key}`),
    setItem: (key, value) => localStorage.setItem(`${prefix}${key}`, value),
    removeItem: (key) => localStorage.removeItem(`${prefix}${key}`),
    getData: () => {
      const scopedData = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          scopedData[key.replace(prefix, '')] = localStorage.getItem(key);
        }
      }
      return scopedData;
    },
  };
}

export function applyWalletStorageScope(walletId) {
  setLocalStorageImpl(createScopedLocalStorage(walletId || 'default'));
}

export function clearScopedWalletStorage(walletId) {
  const prefix = `walletScope:${walletId}:`;
  const scopedKeys = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      scopedKeys.push(key);
    }
  }

  scopedKeys.forEach((key) => localStorage.removeItem(key));
}

export function persistWalletProfiles(profiles, nextActiveWalletId) {
  const serializedProfiles = profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt,
    keys: serializeWalletKeys(profile.keys),
  }));

  localStorage.setItem(WALLET_PROFILES_KEY, JSON.stringify(serializedProfiles));

  const resolvedActiveWalletId = nextActiveWalletId || profiles[0]?.id;
  if (resolvedActiveWalletId) {
    localStorage.setItem(ACTIVE_WALLET_ID_KEY, resolvedActiveWalletId);
    const activeProfile = profiles.find((profile) => profile.id === resolvedActiveWalletId);
    if (activeProfile) {
      localStorage.setItem('keys', JSON.stringify(serializeWalletKeys(activeProfile.keys)));
    }
  }
}

/**
 * Reads wallet profiles from localStorage, handles legacy key migration,
 * and applies the correct storage scope. Returns the resolved initial state.
 */
export function loadInitialWalletState() {
  try {
    const storedProfiles = localStorage.getItem(WALLET_PROFILES_KEY);
    const storedActiveWalletId = localStorage.getItem(ACTIVE_WALLET_ID_KEY);

    if (storedProfiles) {
      const parsedProfiles = JSON.parse(storedProfiles);
      const normalizedProfiles = parsedProfiles
        .map((profile, index) => {
          try {
            return {
              id: profile.id || `wallet-${index + 1}`,
              name: profile.name || `Wallet ${index + 1}`,
              createdAt: profile.createdAt || new Date().toISOString(),
              keys: normalizeWalletKeys(profile.keys),
            };
          } catch (err) {
            console.error('Invalid stored wallet profile', profile, err);
            return null;
          }
        })
        .filter(Boolean);

      if (normalizedProfiles.length) {
        const activeWalletId = normalizedProfiles.some((p) => p.id === storedActiveWalletId)
          ? storedActiveWalletId
          : normalizedProfiles[0].id;

        applyWalletStorageScope(activeWalletId);
        return { profiles: normalizedProfiles, activeWalletId };
      }
    }

    // Legacy migration: single keys entry, no profiles list yet
    const legacyKeys = localStorage.getItem('keys');
    if (legacyKeys) {
      const normalizedKeys = normalizeWalletKeys(JSON.parse(legacyKeys));
      const migratedProfile = createWalletProfile(normalizedKeys, 1);

      applyWalletStorageScope(migratedProfile.id);
      persistWalletProfiles([migratedProfile], migratedProfile.id);

      return { profiles: [migratedProfile], activeWalletId: migratedProfile.id };
    }

    applyWalletStorageScope('default');
    return { profiles: [], activeWalletId: null };
  } catch (err) {
    console.error('Error loading wallet state:', err);
    return { profiles: [], activeWalletId: null };
  }
}

export async function generateNewWalletKeys() {
  const generatedKeys = await generateCloudWalletMasterKey();
  return normalizeWalletKeys(generatedKeys);
}

export async function clearWalletEdvForProfile(profile, currentActiveWalletId) {
  const previousScope = currentActiveWalletId || 'default';

  try {
    applyWalletStorageScope(profile.id);
    const dataStore = await createDataStore({
      databasePath: `dock-wallet-${profile.id}`,
      defaultNetwork: 'testnet',
    });
    const tempCloudWallet = await initializeCloudWallet({
      dataStore,
      edvUrl: EDV_URL,
      masterKey: profile.keys.masterKey,
      authKey: EDV_AUTH_KEY,
    });
    await tempCloudWallet.clearEdvDocuments();
    if (typeof tempCloudWallet.unsubscribeEventListeners === 'function') {
      tempCloudWallet.unsubscribeEventListeners();
    }
  } finally {
    applyWalletStorageScope(previousScope);
  }
}
