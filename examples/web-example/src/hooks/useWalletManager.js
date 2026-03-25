import { useState, useEffect, useCallback } from 'react';
import { generateCloudWalletMasterKey, initializeCloudWallet } from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';
import { createDataStore } from '@docknetwork/wallet-sdk-data-store-web/lib/index';
import { setLocalStorageImpl } from '@docknetwork/wallet-sdk-data-store-web/lib/localStorageJSON';

const WALLET_PROFILES_KEY = 'walletProfiles';
const ACTIVE_WALLET_ID_KEY = 'activeWalletId';
const EDV_URL = 'https://edv.dock.io';
const EDV_AUTH_KEY = 'DOCKWALLET-TEST';

function normalizeWalletKeys(rawKeys) {
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

function serializeWalletKeys(keys) {
  return {
    masterKey: Array.from(keys.masterKey || []),
    mnemonic: keys.mnemonic,
  };
}

function createWalletProfile(keys, index = 1) {
  return {
    id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Wallet ${index}`,
    createdAt: new Date().toISOString(),
    keys,
  };
}

function createScopedLocalStorage(scope) {
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

function applyWalletStorageScope(walletId) {
  setLocalStorageImpl(createScopedLocalStorage(walletId || 'default'));
}

function clearScopedWalletStorage(walletId) {
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

export function useWalletManager() {
  const [loading, setLoading] = useState(false);
  const [walletProfiles, setWalletProfiles] = useState([]);
  const [activeWalletId, setActiveWalletId] = useState(null);
  const [walletKeys, setWalletKeys] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [walletToast, setWalletToast] = useState({
    open: false,
    severity: 'success',
    message: '',
  });

  const persistWalletProfiles = useCallback((profiles, nextActiveWalletId) => {
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
  }, []);

  // Initialize wallets from localStorage
  useEffect(() => {
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
          const resolvedActiveWalletId = normalizedProfiles.some((profile) => profile.id === storedActiveWalletId)
            ? storedActiveWalletId
            : normalizedProfiles[0].id;
          const activeProfile = normalizedProfiles.find((profile) => profile.id === resolvedActiveWalletId);

          applyWalletStorageScope(resolvedActiveWalletId);
          setWalletProfiles(normalizedProfiles);
          setActiveWalletId(resolvedActiveWalletId);
          setWalletKeys(activeProfile?.keys || null);
          return;
        }
      }

      const legacyKeys = localStorage.getItem('keys');
      if (legacyKeys) {
        const normalizedKeys = normalizeWalletKeys(JSON.parse(legacyKeys));
        const migratedProfiles = [createWalletProfile(normalizedKeys, 1)];

        applyWalletStorageScope(migratedProfiles[0].id);
        setWalletProfiles(migratedProfiles);
        setActiveWalletId(migratedProfiles[0].id);
        setWalletKeys(migratedProfiles[0].keys);
        persistWalletProfiles(migratedProfiles, migratedProfiles[0].id);
      } else {
        applyWalletStorageScope('default');
      }
    } catch (err) {
      console.error('Error fetching wallet keys:', err);
    }
  }, [persistWalletProfiles]);

  const handleWalletKeyUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const normalizedKeys = normalizeWalletKeys(JSON.parse(e.target.result));
          const newProfile = createWalletProfile(normalizedKeys, walletProfiles.length + 1);
          const updatedProfiles = [...walletProfiles, newProfile];

          applyWalletStorageScope(newProfile.id);
          setWalletProfiles(updatedProfiles);
          setActiveWalletId(newProfile.id);
          setWalletKeys(newProfile.keys);
          persistWalletProfiles(updatedProfiles, newProfile.id);
          setLoading(false);
          setUploadError(null);
        } catch (error) {
          console.error('Error parsing wallet keys:', error);
          setUploadError('Invalid wallet key file.');
          setLoading(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      const generatedKeys = await generateCloudWalletMasterKey();
      const normalizedKeys = normalizeWalletKeys(generatedKeys);
      const newProfile = createWalletProfile(normalizedKeys, walletProfiles.length + 1);
      const updatedProfiles = [...walletProfiles, newProfile];

      console.log('generated new keys for the wallet');
      applyWalletStorageScope(newProfile.id);
      setWalletProfiles(updatedProfiles);
      setActiveWalletId(newProfile.id);
      setWalletKeys(newProfile.keys);
      persistWalletProfiles(updatedProfiles, newProfile.id);
    } catch (err) {
      console.error('Error generating keys', err);
    }
    setLoading(false);
  };

  const handleSwitchWallet = (walletId) => {
    const targetProfile = walletProfiles.find((profile) => profile.id === walletId);
    if (!targetProfile) {
      return;
    }

    applyWalletStorageScope(walletId);
    setActiveWalletId(walletId);
    setWalletKeys(targetProfile.keys);
    persistWalletProfiles(walletProfiles, walletId);
  };

  const handleRenameWallet = (walletId) => {
    const profile = walletProfiles.find((item) => item.id === walletId);
    if (!profile) {
      return;
    }

    const nextName = window.prompt('Set wallet nickname', profile.name)?.trim();
    if (!nextName || nextName === profile.name) {
      return;
    }

    const updatedProfiles = walletProfiles.map((item) =>
      item.id === walletId ? { ...item, name: nextName } : item
    );

    setWalletProfiles(updatedProfiles);
    persistWalletProfiles(updatedProfiles, activeWalletId);
    setWalletToast({
      open: true,
      severity: 'success',
      message: `Renamed wallet to "${nextName}".`,
    });
  };

  const clearWalletEdvForProfile = async (profile) => {
    const previousScope = activeWalletId || 'default';

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
  };

  const handleDeleteWallet = async (walletId) => {
    const profile = walletProfiles.find((item) => item.id === walletId);
    if (!profile) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${profile.name}"? This will remove its local data and clear its EDV documents.`
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      await clearWalletEdvForProfile(profile);
    } catch (err) {
      console.error('Error clearing EDV for wallet', err);
      setWalletToast({
        open: true,
        severity: 'error',
        message: `Failed to clear EDV for ${profile.name}. Wallet was not deleted.`,
      });
      setLoading(false);
      return;
    }

    clearScopedWalletStorage(profile.id);
    const updatedProfiles = walletProfiles.filter((item) => item.id !== walletId);

    if (!updatedProfiles.length) {
      setWalletProfiles([]);
      setActiveWalletId(null);
      setWalletKeys(null);
      localStorage.removeItem(WALLET_PROFILES_KEY);
      localStorage.removeItem(ACTIVE_WALLET_ID_KEY);
      localStorage.removeItem('keys');
      applyWalletStorageScope('default');
    } else {
      const nextActiveId = walletId === activeWalletId ? updatedProfiles[0].id : activeWalletId;
      const nextActiveProfile = updatedProfiles.find((item) => item.id === nextActiveId) || updatedProfiles[0];

      applyWalletStorageScope(nextActiveProfile.id);
      setWalletProfiles(updatedProfiles);
      setActiveWalletId(nextActiveProfile.id);
      setWalletKeys(nextActiveProfile.keys);
      persistWalletProfiles(updatedProfiles, nextActiveProfile.id);
    }

    setWalletToast({
      open: true,
      severity: 'success',
      message: `Deleted wallet "${profile.name}" and cleared its EDV documents.`,
    });
    setLoading(false);
  };

  const handleClearWallet = () => {
    const currentProfiles = walletProfiles;
    const currentActiveWalletId = activeWalletId;
    localStorage.clear();
    if (currentProfiles.length) {
      persistWalletProfiles(currentProfiles, currentActiveWalletId);
    }
    window.location.reload();
  };

  return {
    // State
    loading,
    walletProfiles,
    activeWalletId,
    walletKeys,
    uploadError,
    walletToast,
    // Setters
    setWalletToast,
    // Handlers
    handleWalletKeyUpload,
    handleCreateWallet,
    handleSwitchWallet,
    handleRenameWallet,
    handleDeleteWallet,
    handleClearWallet,
  };
}
