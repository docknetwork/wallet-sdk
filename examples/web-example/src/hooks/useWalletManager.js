import { useState, useEffect } from 'react';
import {
  applyWalletStorageScope,
  clearScopedWalletStorage,
  clearWalletEdvForProfile,
  createWalletProfile,
  generateNewWalletKeys,
  loadInitialWalletState,
  normalizeWalletKeys,
  persistWalletProfiles,
  WALLET_PROFILES_KEY,
  ACTIVE_WALLET_ID_KEY,
} from '../services/walletService';

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

  useEffect(() => {
    const { profiles, activeWalletId: resolvedId } = loadInitialWalletState();
    if (profiles.length) {
      setWalletProfiles(profiles);
      setActiveWalletId(resolvedId);
      setWalletKeys(profiles.find((p) => p.id === resolvedId)?.keys || null);
    }
  }, []);

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
      const normalizedKeys = await generateNewWalletKeys();
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
    setWalletToast({ open: true, severity: 'success', message: `Renamed wallet to "${nextName}".` });
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
      await clearWalletEdvForProfile(profile, activeWalletId);
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
