import { useState, useCallback } from 'react';

export function useCredentialManagement(
  credentialProvider,
  wallet,
  cloudWallet,
  documents,
  refreshDocuments
) {
  const [deletingCredentialId, setDeletingCredentialId] = useState(null);

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

      await refreshDocuments();

      return {
        success: true,
        message: 'Credential deleted from local wallet and EDV.',
      };
    } catch (err) {
      console.error('Error deleting credential', err);
      return {
        success: false,
        message: `Delete failed: ${err?.message || 'Unable to delete credential.'}`,
      };
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
    waitForCloudWalletSync,
    wallet,
  ]);

  return {
    // State
    deletingCredentialId,
    // Handlers
    handleDeleteCredential,
  };
}
