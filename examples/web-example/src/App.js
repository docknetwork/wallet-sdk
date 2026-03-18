import React, { useState, useEffect, useCallback } from "react";
import { Box, Button, FormControlLabel, Menu, MenuItem, Modal, Switch, TextField } from "@mui/material";
import "./App.css";
import { createVerificationController } from "@docknetwork/wallet-sdk-core/lib/verification-controller";
import { getVCData } from "@docknetwork/prettyvc";
import axios from "axios";
import { setLocalStorageImpl } from "@docknetwork/wallet-sdk-data-store-web/lib/localStorageJSON";

import useCloudWallet from './hooks/useCloudWallet';
import { generateCloudWalletMasterKey } from "@docknetwork/wallet-sdk-core/lib/cloud-wallet";


setLocalStorageImpl(global.localStorage);

function humanizeKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatDate(value) {
  if (!value) return null;
  const clean = String(value).replace(/^"|"$/g, '').trim();
  try {
    const d = new Date(clean);
    if (!isNaN(d)) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) {}
  return clean;
}

function formatAttributeValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatAttributeValue).join(', ');
  if (typeof value === 'object') {
    // Prefer a human-readable scalar property over raw JSON
    const pick = value.name ?? value.value ?? value.id ?? value.label;
    if (pick !== undefined && typeof pick !== 'object') return String(pick);
    // Single-key object — just show its value
    const entries = Object.entries(value);
    if (entries.length === 1) return formatAttributeValue(entries[0][1]);
    // Multi-key: show "Key: Value" pairs joined by space
    return entries.map(([k, v]) => `${humanizeKey(k)}: ${formatAttributeValue(v)}`).join(' · ');
  }
  if (typeof value === 'string') {
    const stripped = value.replace(/^"|"$/g, '');
    if (/^\d{4}-\d{2}-\d{2}/.test(stripped)) {
      try {
        return new Date(stripped).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      } catch (_) {}
    }
    return stripped;
  }
  return String(value);
}

function isPrimitiveValue(value) {
  return value === null || value === undefined || typeof value !== 'object';
}

function FetchMessagesIcon({ className, title }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} title={title}>
      <path d="M20 8h-3V4H7v4H4l8 8 8-8zm-2 10H6v-3H4v5h16v-5h-2v3z" />
    </svg>
  );
}

function AttributeNode({ label, value, depth = 0 }) {
  const normalizedLabel = label ? humanizeKey(label) : null;

  if (Array.isArray(value)) {
    if (value.length === 0 || value.every(isPrimitiveValue)) {
      return (
        <div className="credential-attribute-row">
          <span className="attribute-label">{normalizedLabel}</span>
          <span className="attribute-value">{formatAttributeValue(value)}</span>
        </div>
      );
    }

    return (
      <div className={`attribute-group depth-${depth}`}>
        {normalizedLabel && <div className="attribute-group-title">{normalizedLabel}</div>}
        <div className="attribute-group-body">
          {value.map((item, index) => (
            <AttributeNode
              key={`${normalizedLabel || 'item'}-${index}`}
              label={`Item ${index + 1}`}
              value={item}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([key]) => key !== 'id');

    if (entries.length === 0) {
      return (
        <div className="credential-attribute-row">
          <span className="attribute-label">{normalizedLabel}</span>
          <span className="attribute-value">—</span>
        </div>
      );
    }

    return (
      <div className={`attribute-group depth-${depth}`}>
        {normalizedLabel && <div className="attribute-group-title">{normalizedLabel}</div>}
        <div className="attribute-group-body">
          {entries.map(([key, nestedValue]) => (
            <AttributeNode
              key={`${normalizedLabel || 'group'}-${key}`}
              label={key}
              value={nestedValue}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="credential-attribute-row">
      <span className="attribute-label">{normalizedLabel}</span>
      <span className="attribute-value">{formatAttributeValue(value)}</span>
    </div>
  );
}

function CredentialCard({ document, rawDocument, selectable, selected, onClick }) {
  const [expanded, setExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const subject = document?.credentialSubject || {};
  const subjectEntries = Object.entries(subject).filter(([key]) => key !== 'id');
  const PREVIEW_COUNT = 4;
  const visibleEntries = expanded ? subjectEntries : subjectEntries.slice(0, PREVIEW_COUNT);
  const hasMore = subjectEntries.length > PREVIEW_COUNT;

  const issuer = document?.issuer;
  const issuerName = typeof issuer === 'string'
    ? issuer
    : issuer?.name || issuer?.id || null;
  const issuerLogo = typeof issuer === 'object'
    ? (issuer?.image?.id || issuer?.image || issuer?.logo?.id || issuer?.logo || null)
    : null;
  const issuerLogoUrl = typeof issuerLogo === 'string' ? issuerLogo : null;

  const issuanceDate = formatDate(document?.issuanceDate);
  const expirationDate = formatDate(document?.expirationDate);
  const isExpired = document?.expirationDate && new Date(String(document.expirationDate).replace(/^"|"$/g, '').trim()) < new Date();

  return (
    <div
      className={['credential-card', selectable && 'selectable', selected && 'selected'].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <div className="credential-card-header">
        <span className="credential-type-badge">{document.humanizedType || (document.type?.slice(-1)[0]) || 'Credential'}</span>
        {isExpired
          ? <span className="credential-status expired">Expired</span>
          : <span className="credential-status valid">Valid</span>}
      </div>

      {showJson ? (
        <div className="credential-raw-json">
          <pre>{JSON.stringify(rawDocument || document, null, 2)}</pre>
        </div>
      ) : (
        subjectEntries.length > 0 && (
          <div className="credential-attributes">
            {visibleEntries.map(([key, value]) => (
              <AttributeNode
                key={key}
                label={key}
                value={value}
              />
            ))}
            {hasMore && (
              <button
                className="expand-btn"
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              >
                {expanded ? 'Show less' : `Show ${subjectEntries.length - PREVIEW_COUNT} more…`}
              </button>
            )}
          </div>
        )
      )}

      <div className="credential-card-footer">
        {issuerName && (
          <div className="footer-section issuer-section">
            <span className="footer-section-label">Issued By</span>
            <div className="issuer-identity">
              {issuerLogoUrl && (
                <img src={issuerLogoUrl} alt={issuerName} title={issuerName} className="issuer-logo" />
              )}
              <span className="issuer-value">{issuerName}</span>
            </div>
          </div>
        )}
        <div className="footer-meta">
          {issuanceDate && (
            <div className="credential-footer-item">
              <span className="footer-label">Issued</span>
              <span className="footer-value">{issuanceDate}</span>
            </div>
          )}
          {expirationDate && (
            <div className="credential-footer-item">
              <span className="footer-label">Expires</span>
              <span className={`footer-value ${isExpired ? 'expired-text' : ''}`}>{expirationDate}</span>
            </div>
          )}
          <div className="credential-footer-item id-row">
            <span className="footer-label">ID</span>
            <span className="footer-value credential-id-value">{document.id}</span>
          </div>
        </div>
        <div className="footer-bottom">
          <button
            className="view-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowJson((v) => !v);
            }}
          >
            {showJson ? 'View Card' : 'View JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [formattedCredentials, setFormattedCredentials] = useState([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [credentialUrl, setCredentialUrl] = useState("");
  const [proofRequestUrl, setProofRequestUrl] = useState();
  const [verifyStep, setVerifyStep] = useState(1);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [walletKeys, setWalletKeys] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);
  const [autoCheckMessages, setAutoCheckMessages] = useState(false);

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

  useEffect(() => {
    try {
      const jsonKeys = localStorage.getItem("keys");
      if (jsonKeys) {
        let masterKeyArray;
        const parsedKeys = JSON.parse(jsonKeys);
        if (parsedKeys.masterKey && typeof parsedKeys.masterKey === 'object' && !Array.isArray(parsedKeys.masterKey)) {
          masterKeyArray = Object.values(parsedKeys.masterKey);
        } else if (Array.isArray(parsedKeys.masterKey)) {
          masterKeyArray = parsedKeys.masterKey;
        } else {
          console.log('Master key', parsedKeys.masterKey);
          throw new Error('Invalid master key format');
        }

        const _walletKeys = {
          masterKey: new Uint8Array(masterKeyArray),
          mnemonic: parsedKeys.mnemonic,
        };

        setWalletKeys(_walletKeys);
      }
    } catch (err) {
      console.error("Error fetching wallet keys:", err);
    }
  }, []);

  const {
    loading: cloudWalletLoading,
    cloudWallet,
    wallet,
    credentialProvider,
    didProvider,
    defaultDID,
    messageProvider,
    provisionNewWallet,
  } = useCloudWallet(walletKeys);

  const settingsMenuOpen = Boolean(settingsAnchorEl);

  const handleOpenSettingsMenu = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleCloseSettingsMenu = () => {
    setSettingsAnchorEl(null);
  };


  const handleImportCredential = async () => {
    if (!credentialProvider) {
      return
    }

    // check if the URL is a valid openid-credential-offer
    if (!credentialUrl.startsWith("openid-credential-offer:")) {
      alert("Invalid credential offer URL. Check https://docs.truvera.io/truvera-api/openid#credential-offers for more details.");
      return;
    }

    await credentialProvider.importCredentialFromURI({
      uri: credentialUrl,
      didProvider,
    });

    refreshDocuments();
    setImportModalOpen(false);
    setCredentialUrl("");
  };

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

      if (message.body.credentials) {
        console.log("adding credential to the wallet");
        message.body.credentials.forEach(async (credential) => {
          await credentialProvider.addCredential(credential);
          refreshDocuments();
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

  const handleVerifyCredential = async () => {
    if (!wallet || !credentialProvider || !didProvider) {
      return;
    }

    setLoading(true);
    const { data: proofRequest } = await axios.get(proofRequestUrl);
    const controller = createVerificationController({
      wallet,
      credentialProvider,
      didProvider,
    });

    const credential = selectedCredential;

    await controller.start({ template: proofRequest });

    const attributesToReveal = ["credentialSubject.name"];

    controller.selectedCredentials.set(credential.id, {
      credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();

    console.log(presentation);

    try {
      const { data: verificationResult } = await axios
        .post(proofRequest.response_url, presentation)
        .then((res) => res.data);

      console.log("Verification sent", {
        verificationResult,
      });

      alert("Verification sent successfully");
    } catch (err) {
      console.error("Error sending verification", err);
      alert("Error sending verification: " + err.response.data.error);
    }

    setLoading(false);
    setVerifyModalOpen(false);
    setVerifyStep(1);
    setProofRequestUrl("");
    setSelectedCredential(null);
  };

  const handleWalletKeyUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const keys = JSON.parse(e.target.result);
          localStorage.setItem("keys", JSON.stringify(keys));
          setWalletKeys(keys);
          setLoading(false);
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
      const newKeys = await generateCloudWalletMasterKey();
      console.log("generated new keys for the wallet");
      localStorage.setItem("keys", JSON.stringify(newKeys));
      setWalletKeys(newKeys);
    } catch (err) {
      console.error("Error generating keys", err);
    }
    setLoading(false);
  };

  const handleClearWallet = () => {
    const currentKeysStr = localStorage.getItem("keys");
    const currentKeys = currentKeysStr ? JSON.parse(currentKeysStr) : null;
    localStorage.clear();
    if (currentKeys) {
      localStorage.setItem("keys", JSON.stringify({
        masterKey: currentKeys.masterKey,
        mnemonic: currentKeys.mnemonic,
      }));
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
        <div className="action-buttons">
          <button
            className="btn primary"
            data-testid="import-credential-button"
            onClick={() => {
              setImportModalOpen(true);
              setCredentialUrl("");
            }}
          >
            Import Credential
          </button>
          <button
            className="btn primary"
            data-testid="verify-credential-button"
            onClick={() => {
              setVerifyModalOpen(true);
              setVerifyStep(1);
              setProofRequestUrl("");
              setSelectedCredential(null);
            }}
          >
            Verify Credential
          </button>
          <button
            className="icon-action-btn"
            data-testid="refresh-button"
            aria-label="Refresh credentials"
            title="Refresh"
            onClick={refreshDocuments}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="action-icon" title="Refresh">
              <path d="M17.65 6.35A7.95 7.95 0 0012 4V1L7 6l5 5V7a5 5 0 11-4.9 6h-2.02A7 7 0 1017.65 6.35z" />
            </svg>
          </button>
          <button
            className="icon-action-btn"
            aria-label="Settings"
            title="Settings"
            onClick={handleOpenSettingsMenu}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="action-icon" title="Settings">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.2 7.2 0 00-1.63-.94l-.36-2.54A.5.5 0 0013.9 2h-3.8a.5.5 0 00-.49.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 00-.6.22L2.71 8.48a.5.5 0 00.12.64l2.03 1.58c-.05.31-.08.63-.08.94s.03.63.08.94l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z" />
            </svg>
          </button>
        </div>
        <Menu
          anchorEl={settingsAnchorEl}
          open={settingsMenuOpen}
          onClose={handleCloseSettingsMenu}
        >
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
        <div className="did-section">
          {!defaultDID ? (
            <div className="create-did">
              <button
                className="btn primary"
                onClick={() => provisionNewWallet()}
              >
                Create Default DID
              </button>
            </div>
          ) : (
            <div className="did-display">
              <div className="did-info">
                <strong>Default DID:</strong>
                <span className="did-value">{defaultDID}</span>
                <div className="did-controls">
                  <div className="did-control-group did-copy-group">
                    <button
                      className="did-icon-btn"
                      data-testid="copy-did-button"
                      aria-label="Copy DID"
                      title="Copy DID"
                      onClick={() => {
                        navigator.clipboard.writeText(defaultDID);
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="did-action-icon" title="Copy DID">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                      </svg>
                    </button>
                  </div>
                  <div className="did-control-group did-messages-group">
                    <button
                      className="did-icon-btn"
                      data-testid="fetch-messages-button"
                      aria-label="Fetch Messages"
                      title="Fetch Messages"
                      onClick={() => {
                        void handleFetchMessages();
                      }}
                    >
                      <FetchMessagesIcon
                        className="did-action-icon"
                        title="Fetch Messages"
                      />
                    </button>
                    <FormControlLabel
                      className="did-auto-check-toggle"
                      control={(
                        <Switch
                          size="small"
                          checked={autoCheckMessages}
                          onChange={(event) => setAutoCheckMessages(event.target.checked)}
                        />
                      )}
                      label="Auto-check every 30s"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Credentials List */}
        <div className="credentials-section">
          <h3>Credentials ({formattedCredentials.length})</h3>

          {formattedCredentials.length === 0 ? (
            <div className="no-credentials">
              No credentials found. Import some credentials to get started.
            </div>
          ) : (
            <div className="credentials-list">
              {formattedCredentials.map((document, idx) => (
                <CredentialCard
                  key={document.id}
                  document={document}
                  rawDocument={documents[idx] || document}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import Credential Modal */}
      <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)}>
        <Box sx={modalStyle}>
          <h2>Import Credential</h2>
          <div className="form-group">
            <label htmlFor="credentialUrl">Credential Offer URL:</label>
            <TextField
              id="credentialUrl"
              fullWidth
              value={credentialUrl}
              onChange={(e) => setCredentialUrl(e.target.value)}
              placeholder="Enter credential offer URL"
              InputProps={{
                sx: {
                  borderRadius: '8px',
                  '&.Mui-focused': {
                    boxShadow: '0 0 0 3px rgba(76, 81, 191, 0.1)',
                  },
                },
              }}
            />
          </div>
          <div className="modal-buttons">
            <button
              className="btn secondary"
              onClick={() => setImportModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={handleImportCredential}
              disabled={!credentialUrl}
            >
              Import
            </button>
          </div>
        </Box>
      </Modal>

      {/* Verify Credential Modal */}
      <Modal
        open={verifyModalOpen}
        onClose={() => {
          setVerifyModalOpen(false);
          setVerifyStep(1);
          setProofRequestUrl("");
          setSelectedCredential(null);
        }}
      >
        <Box sx={modalStyle}>
          {verifyStep === 1 && (
            <>
              <h2>Verify Credential</h2>
              <div className="form-group">
                <label htmlFor="proofRequestUrl">Proof Request URL:</label>
                <TextField
                  id="proofRequestUrl"
                  fullWidth
                  value={proofRequestUrl}
                  onChange={(e) => setProofRequestUrl(e.target.value)}
                  placeholder="Enter proof request URL"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(76, 81, 191, 0.1)',
                      },
                    },
                  }}
                />
              </div>
              <div className="modal-buttons">
                <button
                  className="btn secondary"
                  onClick={() => setVerifyModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  onClick={() => setVerifyStep(2)}
                  disabled={!proofRequestUrl}
                >
                  Next
                </button>
              </div>
            </>
          )}
          {verifyStep === 2 && (
            <>
              <h2>Select Credential to Present</h2>
              <div className="credential-selection">
                {formattedCredentials.map((document, idx) => (
                  <CredentialCard
                    key={document.id}
                    document={document}
                    rawDocument={documents[idx] || document}
                    selectable
                    selected={selectedCredential?.id === documents[idx]?.id}
                    onClick={() => setSelectedCredential(documents[idx])}
                  />
                ))}
              </div>
              <div className="modal-buttons">
                <button
                  className="btn secondary"
                  onClick={() => setVerifyStep(1)}
                >
                  Back
                </button>
                <button
                  className="btn primary"
                  onClick={handleVerifyCredential}
                  disabled={!selectedCredential}
                >
                  Verify
                </button>
              </div>
            </>
          )}
        </Box>
      </Modal>
    </div>
  );
}

export default App;
