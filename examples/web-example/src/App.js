import React, { useState, useEffect, useCallback } from "react";
import { Alert, Box, Button, CircularProgress, Divider, FormControlLabel, Menu, MenuItem, Modal, Snackbar, Switch, TextField } from "@mui/material";
import "./App.css";
import { createVerificationController } from "@docknetwork/wallet-sdk-core/lib/verification-controller";
import { getVCData } from "@docknetwork/prettyvc";
import axios from "axios";
import { setLocalStorageImpl } from "@docknetwork/wallet-sdk-data-store-web/lib/localStorageJSON";
import { createDataStore } from "@docknetwork/wallet-sdk-data-store-web/lib/index";

import useCloudWallet from './hooks/useCloudWallet';
import { useWalletManager } from './hooks/useWalletManager';
import { useCredentialManagement } from './hooks/useCredentialManagement';
import ActionButtons from "./components/ActionButtons";
import DidSection from "./components/DidSection";
import CredentialsSection from "./components/CredentialsSection";
import ImportCredentialModal from "./components/ImportCredentialModal";
import VerifyCredentialModal from "./components/VerifyCredentialModal";
import { useImportFlow, useVerifyFlow } from "./hooks/useModalFlows";


setLocalStorageImpl(global.localStorage);



function App() {
  const [documents, setDocuments] = useState([]);
  const [formattedCredentials, setFormattedCredentials] = useState([]);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);
  const [autoCheckMessages, setAutoCheckMessages] = useState(false);

  // Initialize wallet management
  const walletManager = useWalletManager();

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

  const {
    loading: cloudWalletLoading,
    cloudWallet,
    wallet,
    credentialProvider,
    didProvider,
    defaultDID,
    messageProvider,
    provisionNewWallet,
  } = useCloudWallet(walletManager.walletKeys, walletManager.activeWalletId);

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

  // Extract credential management
  const credentialManagement = useCredentialManagement(
    credentialProvider,
    wallet,
    cloudWallet,
    documents,
    refreshDocuments
  );

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

  const settingsMenuOpen = Boolean(settingsAnchorEl);
  const handleOpenSettingsMenu = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleCloseSettingsMenu = () => {
    setSettingsAnchorEl(null);
  };

  console.log({
    walletKeys: walletManager.walletKeys,
    loading: walletManager.loading,
    cloudWalletLoading,
    documents,
    formattedCredentials,
  });

  if (cloudWalletLoading || walletManager.loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!walletManager.walletKeys) {
    return (
      <div className="App">
        <div className="setup-container">
          <h2>Welcome to the Wallet App</h2>
          <p>Please upload your wallet key file or create a new wallet.</p>
          {walletManager.uploadError && <div className="error">{walletManager.uploadError}</div>}
          <div className="setup-buttons">
            <Button variant="contained" component="label" className="btn primary">
              Upload Wallet Key File
              <input
                type="file"
                accept=".json"
                hidden
                onChange={walletManager.handleWalletKeyUpload}
              />
            </Button>
            <button
              className="btn primary"
              data-testid="create-wallet-button"
              onClick={walletManager.handleCreateWallet}
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
              await walletManager.handleCreateWallet();
            }}
          >
            Create New Wallet
          </MenuItem>
          {walletManager.walletProfiles.length > 0 && <Divider />}
          {walletManager.walletProfiles.length > 0 && (
            <MenuItem disabled>
              Switch Wallet
            </MenuItem>
          )}
          {walletManager.walletProfiles.map((profile) => (
            <MenuItem
              key={profile.id}
              selected={profile.id === walletManager.activeWalletId}
              onClick={() => {
                handleCloseSettingsMenu();
                walletManager.handleSwitchWallet(profile.id);
              }}
            >
              {profile.name}{profile.id === walletManager.activeWalletId ? " (Current)" : ""}
            </MenuItem>
          ))}
          {walletManager.walletProfiles.length > 0 && <Divider />}
          {walletManager.walletProfiles.length > 0 && (
            <MenuItem disabled>
              Rename Wallet
            </MenuItem>
          )}
          {walletManager.walletProfiles.map((profile) => (
            <MenuItem
              key={`rename-${profile.id}`}
              onClick={() => {
                handleCloseSettingsMenu();
                walletManager.handleRenameWallet(profile.id);
              }}
            >
              Rename {profile.name}
            </MenuItem>
          ))}
          {walletManager.walletProfiles.length > 0 && <Divider />}
          {walletManager.walletProfiles.length > 0 && (
            <MenuItem disabled>
              Delete Wallet
            </MenuItem>
          )}
          {walletManager.walletProfiles.map((profile) => (
            <MenuItem
              key={`delete-${profile.id}`}
              onClick={async () => {
                handleCloseSettingsMenu();
                await walletManager.handleDeleteWallet(profile.id);
              }}
            >
              Delete {profile.name}
            </MenuItem>
          ))}
          {(walletManager.walletProfiles.length > 0) && <Divider />}
          <MenuItem
            onClick={() => {
              handleCloseSettingsMenu();
              walletManager.handleClearWallet();
            }}
          >
            Clear Wallet
          </MenuItem>
          {cloudWallet && (
            <MenuItem
              onClick={() => {
                handleCloseSettingsMenu();
                cloudWallet.clearEdvDocuments();
              }}
            >
              Clear EDV
            </MenuItem>
          )}
        </Menu>

        {/* DID Management */}
        <DidSection
          defaultDID={defaultDID}
          walletProfiles={walletManager.walletProfiles}
          activeWalletId={walletManager.activeWalletId}
          autoCheckMessages={autoCheckMessages}
          onProvisionNewWallet={provisionNewWallet}
          onSwitchWallet={walletManager.handleSwitchWallet}
          onFetchMessages={handleFetchMessages}
          onAutoCheckToggle={setAutoCheckMessages}
        />

        {/* Credentials List */}
        <CredentialsSection
          formattedCredentials={formattedCredentials}
          documents={documents}
          deletingCredentialId={credentialManagement.deletingCredentialId}
          onDeleteCredential={credentialManagement.handleDeleteCredential}
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
        open={walletManager.walletToast.open}
        autoHideDuration={4000}
        onClose={() => walletManager.setWalletToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={walletManager.walletToast.severity}
          variant="filled"
          onClose={() => walletManager.setWalletToast((prev) => ({ ...prev, open: false }))}
        >
          {walletManager.walletToast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default App;
