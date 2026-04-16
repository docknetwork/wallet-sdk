import { useState, useCallback } from 'react';
import { deleteCredential } from '../services/credentialService';

export function useCredentialManagement(
  credentialProvider,
  wallet,
  cloudWallet,
  documents,
  refreshDocuments
) {
  const [deletingCredentialId, setDeletingCredentialId] = useState(null);
  const [credentialToast, setCredentialToast] = useState({
    open: false,
    severity: 'success',
    message: '',
  });

  const handleDeleteCredential = useCallback(async (credentialId) => {
    const credential = documents.find((doc) => doc?.id === credentialId);
    const credentialLabel = credential?.id || credentialId;
    const confirmed = window.confirm(
      `Delete this credential? This will remove it from local wallet storage and EDV.\n\n${credentialLabel}`
    );

    if (!confirmed) {
      return;
    }

    setDeletingCredentialId(credentialId);
    const result = await deleteCredential({ credentialProvider, wallet, cloudWallet, credentialId });
    setDeletingCredentialId(null);

    if (result.success) {
      await refreshDocuments();
    }

    setCredentialToast({ open: true, severity: result.success ? 'success' : 'error', message: result.message });
  }, [cloudWallet, credentialProvider, documents, refreshDocuments, wallet]);

  return {
    // State
    deletingCredentialId,
    credentialToast,
    // Setters
    setCredentialToast,
    // Handlers
    handleDeleteCredential,
  };
}
