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

function CredentialCard({ document, rawDocument, selectable, selected, onClick, onDelete, deleting }) {
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
        <div className="credential-header-actions">
          {isExpired
            ? <span className="credential-status expired">Expired</span>
            : <span className="credential-status valid">Valid</span>}
          {onDelete && (
            <button
              className="delete-credential-icon-btn"
              data-testid={`delete-credential-${document.id}`}
              aria-label="Delete credential"
              title="Delete credential"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(document.id);
              }}
              disabled={deleting}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="delete-credential-icon" title="Delete credential">
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
              </svg>
            </button>
          )}
        </div>
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
  const [proofRequestTemplate, setProofRequestTemplate] = useState(null);
  const [verifyStep, setVerifyStep] = useState(1);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [matchingCredentialIds, setMatchingCredentialIds] = useState([]);
  const [loadingMatchingCredentials, setLoadingMatchingCredentials] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [verifyToast, setVerifyToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });
  const [importToast, setImportToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });
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

  const settingsMenuOpen = Boolean(settingsAnchorEl);
  const activeWalletProfile = walletProfiles.find((profile) => profile.id === activeWalletId) || null;

  const handleOpenSettingsMenu = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleCloseSettingsMenu = () => {
    setSettingsAnchorEl(null);
  };

  const resetVerifyFlow = () => {
    setVerifyModalOpen(false);
    setVerifyStep(1);
    setProofRequestUrl("");
    setProofRequestTemplate(null);
    setMatchingCredentialIds([]);
    setSelectedCredential(null);
    setIsVerifying(false);
  };

  const resetImportFlow = () => {
    setImportModalOpen(false);
    setCredentialUrl("");
    setIsImporting(false);
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

    try {
      setIsImporting(true);

      await credentialProvider.importCredentialFromURI({
        uri: credentialUrl,
        didProvider,
      });

      await refreshDocuments();
      setImportToast({
        open: true,
        severity: "success",
        message: "Credential imported successfully.",
      });
      resetImportFlow();
    } catch (err) {
      console.error("Error importing credential", err);
      setImportToast({
        open: true,
        severity: "error",
        message: `Import failed: ${err?.message || "Unable to import credential."}`,
      });
      setIsImporting(false);
    }
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
        setImportToast({
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

  const handleVerifyCredential = async () => {
    if (!wallet || !credentialProvider || !didProvider) {
      return;
    }

    try {
      setIsVerifying(true);

      const proofRequest = proofRequestTemplate || (await axios.get(proofRequestUrl)).data;
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

      const { data: verificationResult } = await axios
        .post(proofRequest.response_url, presentation)
        .then((res) => res.data);

      console.log("Verification sent", {
        verificationResult,
      });

      setVerifyToast({
        open: true,
        severity: "success",
        message: "Verification sent successfully.",
      });
    } catch (err) {
      console.error("Error sending verification", err);

      const errorMessage = err?.response?.data?.error || err?.message || "Unable to verify credential.";
      setVerifyToast({
        open: true,
        severity: "error",
        message: `Verification failed: ${errorMessage}`,
      });
    } finally {
      setIsVerifying(false);
      resetVerifyFlow();
    }
  };

  const handleLoadMatchingCredentials = async () => {
    if (!wallet || !credentialProvider || !didProvider || !proofRequestUrl) {
      return;
    }

    try {
      setLoadingMatchingCredentials(true);
      const proofRequest = (await axios.get(proofRequestUrl)).data;
      const controller = createVerificationController({
        wallet,
        credentialProvider,
        didProvider,
      });

      await controller.start({ template: proofRequest });
      const filteredCredentials = controller.getFilteredCredentials() || [];
      const filteredIds = filteredCredentials.map((credential) => credential.id);

      setProofRequestTemplate(proofRequest);
      setMatchingCredentialIds(filteredIds);
      setSelectedCredential(null);
      setVerifyStep(2);
    } catch (err) {
      console.error("Error loading matching credentials", err);
      alert("Unable to load matching credentials for this proof request.");
    } finally {
      setLoadingMatchingCredentials(false);
    }
  };

  const matchingCredentials = formattedCredentials
    .map((document, idx) => ({
      document,
      rawDocument: documents[idx],
    }))
    .filter((item) => item.rawDocument && matchingCredentialIds.includes(item.rawDocument.id));

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
        <div className="action-buttons">
          <button
            className="btn primary"
            data-testid="import-credential-button"
            onClick={() => {
              setImportModalOpen(true);
              setCredentialUrl("");
              setIsImporting(false);
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
              setProofRequestTemplate(null);
              setMatchingCredentialIds([]);
              setSelectedCredential(null);
              setIsVerifying(false);
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
                <strong>{activeWalletProfile?.name || "Wallet"}:</strong>
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
                  onDelete={handleDeleteCredential}
                  deleting={deletingCredentialId === document.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import Credential Modal */}
      <Modal
        open={importModalOpen}
        onClose={() => {
          if (isImporting) {
            return;
          }
          resetImportFlow();
        }}
      >
        <Box sx={modalStyle}>
          {isImporting ? (
            <div className="verify-loading-state">
              <CircularProgress size={32} />
              <p>Importing credential offer and processing response...</p>
            </div>
          ) : (
            <>
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
                  onClick={resetImportFlow}
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
            </>
          )}
        </Box>
      </Modal>

      {/* Verify Credential Modal */}
      <Modal
        open={verifyModalOpen}
        onClose={() => {
          if (isVerifying) {
            return;
          }
          resetVerifyFlow();
        }}
      >
        <Box sx={modalStyle}>
          {isVerifying ? (
            <div className="verify-loading-state">
              <CircularProgress size={32} />
              <p>Checking credential and submitting verification...</p>
            </div>
          ) : (
            <>
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
                  onClick={handleLoadMatchingCredentials}
                  disabled={!proofRequestUrl || loadingMatchingCredentials}
                >
                  {loadingMatchingCredentials ? 'Loading...' : 'Next'}
                </button>
              </div>
            </>
          )}
          {verifyStep === 2 && (
            <>
              <h2>Select Credential to Present</h2>
              {matchingCredentials.length === 0 ? (
                <div className="no-credentials">
                  No matching credentials found for this proof request.
                </div>
              ) : (
                <div className="credential-selection">
                  {matchingCredentials.map((item) => (
                    <CredentialCard
                      key={item.document.id}
                      document={item.document}
                      rawDocument={item.rawDocument || item.document}
                      selectable
                      selected={selectedCredential?.id === item.rawDocument?.id}
                      onClick={() => setSelectedCredential(item.rawDocument)}
                    />
                  ))}
                </div>
              )}
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
            </>
          )}
        </Box>
      </Modal>
      <Snackbar
        open={verifyToast.open}
        autoHideDuration={4000}
        onClose={() => setVerifyToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={verifyToast.severity}
          variant="filled"
          onClose={() => setVerifyToast((prev) => ({ ...prev, open: false }))}
        >
          {verifyToast.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={importToast.open}
        autoHideDuration={4000}
        onClose={() => setImportToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          severity={importToast.severity}
          variant="filled"
          onClose={() => setImportToast((prev) => ({ ...prev, open: false }))}
        >
          {importToast.message}
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
