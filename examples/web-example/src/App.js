import React, { useState, useEffect, useCallback } from "react";
import { Alert, Box, Button, CircularProgress, Divider, FormControlLabel, Menu, MenuItem, Modal, Snackbar, Switch, TextField } from "@mui/material";
import "./App.css";
import { createVerificationController } from "@docknetwork/wallet-sdk-core/lib/verification-controller";
import { getVCData } from "@docknetwork/prettyvc";
import axios from "axios";
import { setLocalStorageImpl } from "@docknetwork/wallet-sdk-data-store-web/lib/localStorageJSON";
import { createDataStore } from "@docknetwork/wallet-sdk-data-store-web/lib/index";

import useCloudWallet from './hooks/useCloudWallet';
import { generateCloudWalletMasterKey, initializeCloudWallet } from "@docknetwork/wallet-sdk-core/lib/cloud-wallet";
import ActionButtons from "./components/ActionButtons";
import DidSection from "./components/DidSection";
import CredentialsSection from "./components/CredentialsSection";
import ImportCredentialModal from "./components/ImportCredentialModal";
import VerifyCredentialModal from "./components/VerifyCredentialModal";
import { useImportFlow, useVerifyFlow } from "./hooks/useModalFlows";


setLocalStorageImpl(global.localStorage);

const WALLET_PROFILES_KEY = "walletProfiles";
const ACTIVE_WALLET_ID_KEY = "activeWalletId";
const EDV_URL = "https://edv.dock.io";
const EDV_AUTH_KEY = "DOCKWALLET-TEST";

function normalizeWalletKeys(rawKeys) {
  if (!rawKeys) {
    throw new Error("Missing wallet keys");
  }

  let masterKeyArray;
  if (rawKeys.masterKey instanceof Uint8Array) {
    masterKeyArray = Array.from(rawKeys.masterKey);
  } else if (Array.isArray(rawKeys.masterKey)) {
    masterKeyArray = rawKeys.masterKey;
  } else if (rawKeys.masterKey && typeof rawKeys.masterKey === 'object') {
    masterKeyArray = Object.values(rawKeys.masterKey);
  } else {
    throw new Error("Invalid master key format");
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



function App() {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [formattedCredentials, setFormattedCredentials] = useState([]);
  const [walletToast, setWalletToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });
  const [walletKeys, setWalletKeys] = useState(null);
  const [walletProfiles, setWalletProfiles] = useState([]);
  const [activeWalletId, setActiveWalletId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);
  const [autoCheckMessages, setAutoCheckMessages] = useState(false);
  const [deletingCredentialId, setDeletingCredentialId] = useState(null);

  // Styles for the modals
  const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",
    boxShadow: 24,
    p: 4,
  };

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
        localStorage.setItem("keys", JSON.stringify(serializeWalletKeys(activeProfile.keys)));
      }
    }
  }, []);

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
              console.error("Invalid stored wallet profile", profile, err);
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

      const legacyKeys = localStorage.getItem("keys");
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
      console.error("Error fetching wallet keys:", err);
    }
  }, [persistWalletProfiles]);

  const {
    loading: cloudWalletLoading,
    cloudWallet,
    wallet,
    credentialProvider,
    didProvider,
    defaultDID,
    messageProvider,
    provisionNewWallet,
  } = useCloudWallet(walletKeys, activeWalletId);

  const refreshDocuments = useCallback(async () => {
    if (!credentialProvider) {
      return;
    }

    const creds = await credentialProvider.getCredentials();
    setFormattedCredentials(
      await Promise.all(
        creds.map((c) =>
          getVCData(c, {
            generateImages: false,
            generateQRImage: false,
          }).catch((err) => c)
        )
      )
    );
    setDocuments(creds);
  }, [credentialProvider]);

  // Extract modal flows using custom hooks
  const importFlow = useImportFlow(credentialProvider, didProvider, refreshDocuments);
  const verifyFlow = useVerifyFlow(wallet, credentialProvider, didProvider);

  const settingsMenuOpen = Boolean(settingsAnchorEl);
  const handleOpenSettingsMenu = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleCloseSettingsMenu = () => {
    setSettingsAnchorEl(null);
  };

  const waitForCloudWalletSync = useCallback(async () => {
    if (!cloudWallet || typeof cloudWallet.waitForEdvIdle !== 'function') {
      throw new Error('Cloud wallet connection is required to safely delete credentials.');
    }

    await cloudWallet.waitForEdvIdle();
  }, [cloudWallet]);

  const hasCredentialArtifacts = useCallback(async (credentialId) => {
    if (!wallet || !credentialId) {
      return false;
    }

    const candidateIds = [credentialId, `${credentialId}#witness`, `${credentialId}#status`];
    const docs = await Promise.all(candidateIds.map((id) => wallet.getDocumentById(id)));
    return docs.some(Boolean);
  }, [wallet]);

  const removeCredentialArtifactsFromWallet = useCallback(async (credentialId) => {
    if (!wallet || !credentialId) {
      return;
    }

    const candidateIds = [credentialId, `${credentialId}#witness`, `${credentialId}#status`];
    for (const id of candidateIds) {
      const existingDoc = await wallet.getDocumentById(id);
      if (existingDoc) {
        await wallet.removeDocument(id);
      }
    }
  }, [wallet]);

  const handleDeleteCredential = useCallback(async (credentialId) => {
    if (!credentialProvider || !wallet || !credentialId) {
      return;
    }

    const credential = documents.find((doc) => doc?.id === credentialId);
    const credentialLabel = credential?.id || credentialId;
    const confirmed = window.confirm(
      `Delete this credential? This will remove it from local wallet storage and EDV.\n\n${credentialLabel}`
    );

    if (!confirmed) {
      return;
    }

    setDeletingCredentialId(credentialId);

    try {
      if (!cloudWallet || typeof cloudWallet.pullDocuments !== 'function') {
        throw new Error('Cloud wallet is unavailable, so EDV deletion cannot be confirmed.');
      }

      await credentialProvider.removeCredential(credentialId);
      await waitForCloudWalletSync();

      // Re-pull from EDV and re-check local state to confirm the delete propagated to cloud.
      await cloudWallet.pullDocuments();
      await waitForCloudWalletSync();

      if (await hasCredentialArtifacts(credentialId)) {
        await removeCredentialArtifactsFromWallet(credentialId);
        await waitForCloudWalletSync();
        await cloudWallet.pullDocuments();
        await waitForCloudWalletSync();
      }

      if (await hasCredentialArtifacts(credentialId)) {
        throw new Error('Credential still exists after synchronization with EDV.');
      }

      if (selectedCredential?.id === credentialId) {
        setSelectedCredential(null);
      }

      await refreshDocuments();
      setImportToast({
        open: true,
        severity: 'success',
        message: 'Credential deleted from local wallet and EDV.',
      });
    } catch (err) {
      console.error('Error deleting credential', err);
      setImportToast({
        open: true,
        severity: 'error',
        message: `Delete failed: ${err?.message || 'Unable to delete credential.'}`,
      });
    } finally {
      setDeletingCredentialId(null);
    }
  }, [
    cloudWallet,
    credentialProvider,
    documents,
    hasCredentialArtifacts,
    refreshDocuments,
    removeCredentialArtifactsFromWallet,
    selectedCredential?.id,
    waitForCloudWalletSync,
    wallet,
  ]);

  const handleFetchMessages = useCallback(async () => {
    if (!messageProvider) {
      return;
    }

    await messageProvider.fetchMessages();
    await messageProvider.processDIDCommMessages();
  }, [messageProvider]);

  useEffect(() => {
    if (credentialProvider) {
      refreshDocuments();
    }
  }, [credentialProvider, refreshDocuments]);

  useEffect(() => {
    if (!messageProvider || !credentialProvider) {
      return;
    }

    const unsubscribe = messageProvider.addMessageListener(async (message) => {
      console.log("Message received", message);

      const incomingCredentials = Array.isArray(message?.body?.credentials)
        ? message.body.credentials
        : [];

      if (incomingCredentials.length) {
        console.log("adding credential to the wallet");
        await Promise.all(
          incomingCredentials.map((credential) => credentialProvider.addCredential(credential))
        );
        await refreshDocuments();
        importFlow.setImportToast({
          open: true,
          severity: "success",
          message: `Imported ${incomingCredentials.length} credential${incomingCredentials.length === 1 ? "" : "s"} from messages.`,
        });
      }
    });

    return () => unsubscribe && unsubscribe();
  }, [messageProvider, credentialProvider, refreshDocuments]);

  useEffect(() => {
    if (!autoCheckMessages || !defaultDID || !messageProvider) {
      return;
    }

    void handleFetchMessages();

    const intervalId = window.setInterval(() => {
      void handleFetchMessages();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [autoCheckMessages, defaultDID, messageProvider, handleFetchMessages]);

  const matchingCredentials = formattedCredentials
    .map((document, idx) => ({
      document,
      rawDocument: documents[idx],
    }))
    .filter((item) => item.rawDocument && verifyFlow.matchingCredentialIds.includes(item.rawDocument.id));

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
          console.error("Error parsing wallet keys:", error);
          setUploadError("Invalid wallet key file.");
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

      console.log("generated new keys for the wallet");
      applyWalletStorageScope(newProfile.id);
      setWalletProfiles(updatedProfiles);
      setActiveWalletId(newProfile.id);
      setWalletKeys(newProfile.keys);
      persistWalletProfiles(updatedProfiles, newProfile.id);
    } catch (err) {
      console.error("Error generating keys", err);
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
    setDocuments([]);
    setFormattedCredentials([]);
    setSelectedCredential(null);
    persistWalletProfiles(walletProfiles, walletId);
  };

  const handleRenameWallet = (walletId) => {
    const profile = walletProfiles.find((item) => item.id === walletId);
    if (!profile) {
      return;
    }

    const nextName = window.prompt("Set wallet nickname", profile.name)?.trim();
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
      severity: "success",
      message: `Renamed wallet to \"${nextName}\".`,
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
      `Delete \"${profile.name}\"? This will remove its local data and clear its EDV documents.`
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      await clearWalletEdvForProfile(profile);
    } catch (err) {
      console.error("Error clearing EDV for wallet", err);
      setWalletToast({
        open: true,
        severity: "error",
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
      localStorage.removeItem("keys");
      applyWalletStorageScope('default');
    } else {
      const nextActiveId = walletId === activeWalletId ? updatedProfiles[0].id : activeWalletId;
      const nextActiveProfile = updatedProfiles.find((item) => item.id === nextActiveId) || updatedProfiles[0];

      applyWalletStorageScope(nextActiveProfile.id);
      setWalletProfiles(updatedProfiles);
      setActiveWalletId(nextActiveProfile.id);
      setWalletKeys(nextActiveProfile.keys);
      setDocuments([]);
      setFormattedCredentials([]);
      persistWalletProfiles(updatedProfiles, nextActiveProfile.id);
    }

    setWalletToast({
      open: true,
      severity: "success",
      message: `Deleted wallet \"${profile.name}\" and cleared its EDV documents.`,
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

  const handleClearEdv = () => {
    if (cloudWallet) {
      cloudWallet.clearEdvDocuments();
    }
  };

  console.log({
    walletKeys,
    loading,
    cloudWalletLoading,
    documents,
    formattedCredentials,
  });

  if (cloudWalletLoading || loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!walletKeys) {
    return (
      <div className="App">
        <div className="setup-container">
          <h2>Welcome to the Wallet App</h2>
          <p>Please upload your wallet key file or create a new wallet.</p>
          {uploadError && <div className="error">{uploadError}</div>}
          <div className="setup-buttons">
            <Button variant="contained" component="label" className="btn primary">
              Upload Wallet Key File
              <input
                type="file"
                accept=".json"
                hidden
                onChange={handleWalletKeyUpload}
              />
            </Button>
            <button
              className="btn primary"
              data-testid="create-wallet-button"
              onClick={handleCreateWallet}
            >
              Create New Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="wallet-container">
        <header className="App-header">
          <img
            src="/truveralogoround.png"
            alt="Truvera"
            className="header-logo"
          />
          <h1>Truvera Demo Web Wallet</h1>
        </header>

        {/* Action Buttons */}
        <ActionButtons
          onImportClick={() => {
            importFlow.setImportModalOpen(true);
            importFlow.setCredentialUrl("");
          }}
          onVerifyClick={() => {
            verifyFlow.setVerifyModalOpen(true);
            verifyFlow.setVerifyStep(1);
            verifyFlow.setProofRequestUrl("");
          }}
          onRefreshClick={refreshDocuments}
          onSettingsClick={handleOpenSettingsMenu}
        />
        <Menu
          anchorEl={settingsAnchorEl}
          open={settingsMenuOpen}
          onClose={handleCloseSettingsMenu}
        >
          <MenuItem
            onClick={async () => {
              handleCloseSettingsMenu();
              await handleCreateWallet();
            }}
          >
            Create New Wallet
          </MenuItem>
          {walletProfiles.length > 0 && <Divider />}
          {walletProfiles.length > 0 && (
            <MenuItem disabled>
              Switch Wallet
            </MenuItem>
          )}
          {walletProfiles.map((profile) => (
            <MenuItem
              key={profile.id}
              selected={profile.id === activeWalletId}
              onClick={() => {
                handleCloseSettingsMenu();
                handleSwitchWallet(profile.id);
              }}
            >
              {profile.name}{profile.id === activeWalletId ? " (Current)" : ""}
            </MenuItem>
          ))}
          {walletProfiles.length > 0 && <Divider />}
          {walletProfiles.length > 0 && (
            <MenuItem disabled>
              Rename Wallet
            </MenuItem>
          )}
          {walletProfiles.map((profile) => (
            <MenuItem
              key={`rename-${profile.id}`}
              onClick={() => {
                handleCloseSettingsMenu();
                handleRenameWallet(profile.id);
              }}
            >
              Rename {profile.name}
            </MenuItem>
          ))}
          {walletProfiles.length > 0 && <Divider />}
          {walletProfiles.length > 0 && (
            <MenuItem disabled>
              Delete Wallet
            </MenuItem>
          )}
          {walletProfiles.map((profile) => (
            <MenuItem
              key={`delete-${profile.id}`}
              onClick={async () => {
                handleCloseSettingsMenu();
                await handleDeleteWallet(profile.id);
              }}
            >
              Delete {profile.name}
            </MenuItem>
          ))}
          {(walletProfiles.length > 0) && <Divider />}
          <MenuItem
            onClick={() => {
              handleCloseSettingsMenu();
              handleClearWallet();
            }}
          >
            Clear Wallet
          </MenuItem>
          {cloudWallet && (
            <MenuItem
              onClick={() => {
                handleCloseSettingsMenu();
                handleClearEdv();
              }}
            >
              Clear EDV
            </MenuItem>
          )}
        </Menu>

        {/* DID Management */}
        <DidSection
          defaultDID={defaultDID}
          walletProfiles={walletProfiles}
          activeWalletId={activeWalletId}
          autoCheckMessages={autoCheckMessages}
          onProvisionNewWallet={provisionNewWallet}
          onSwitchWallet={handleSwitchWallet}
          onFetchMessages={handleFetchMessages}
          onAutoCheckToggle={setAutoCheckMessages}
        />

        {/* Credentials List */}
        <CredentialsSection
          formattedCredentials={formattedCredentials}
          documents={documents}
          deletingCredentialId={deletingCredentialId}
          onDeleteCredential={handleDeleteCredential}
        />
      </div>

      {/* Import Credential Modal */}
      <ImportCredentialModal
        open={importFlow.importModalOpen}
        isImporting={importFlow.isImporting}
        credentialUrl={importFlow.credentialUrl}
        onCredentialUrlChange={importFlow.setCredentialUrl}
        onImport={importFlow.handleImportCredential}
        onClose={importFlow.resetImportFlow}
        modalStyle={modalStyle}
      />

      {/* Verify Credential Modal */}
      <VerifyCredentialModal
        open={verifyFlow.verifyModalOpen}
        isVerifying={verifyFlow.isVerifying}
        verifyStep={verifyFlow.verifyStep}
        proofRequestUrl={verifyFlow.proofRequestUrl}
        loadingMatchingCredentials={verifyFlow.loadingMatchingCredentials}
        matchingCredentials={matchingCredentials}
        selectedCredential={verifyFlow.selectedCredential}
        onProofRequestUrlChange={verifyFlow.setProofRequestUrl}
        onLoadMatchingCredentials={verifyFlow.handleLoadMatchingCredentials}
        onVerifyCredential={verifyFlow.handleVerifyCredential}
        onBackStep={() => verifyFlow.setVerifyStep(1)}
        onClose={verifyFlow.resetVerifyFlow}
        onSelectCredential={verifyFlow.setSelectedCredential}
        modalStyle={modalStyle}
      />
      <Snackbar
        open={verifyFlow.verifyToast.open}
        autoHideDuration={4000}
        onClose={() => verifyFlow.setVerifyToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={verifyFlow.verifyToast.severity}
          variant="filled"
          onClose={() => verifyFlow.setVerifyToast((prev) => ({ ...prev, open: false }))}
        >
          {verifyFlow.verifyToast.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={importFlow.importToast.open}
        autoHideDuration={4000}
        onClose={() => importFlow.setImportToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          severity={importFlow.importToast.severity}
          variant="filled"
          onClose={() => importFlow.setImportToast((prev) => ({ ...prev, open: false }))}
        >
          {importFlow.importToast.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={walletToast.open}
        autoHideDuration={4000}
        onClose={() => setWalletToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={walletToast.severity}
          variant="filled"
          onClose={() => setWalletToast((prev) => ({ ...prev, open: false }))}
        >
          {walletToast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default App;
