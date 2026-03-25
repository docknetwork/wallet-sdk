export async function waitForCloudWalletSync(cloudWallet) {
  if (!cloudWallet || typeof cloudWallet.waitForEdvIdle !== 'function') {
    throw new Error('Cloud wallet connection is required to safely delete credentials.');
  }

  await cloudWallet.waitForEdvIdle();
}

export async function hasCredentialArtifacts(wallet, credentialId) {
  if (!wallet || !credentialId) {
    return false;
  }

  const candidateIds = [credentialId, `${credentialId}#witness`, `${credentialId}#status`];
  const docs = await Promise.all(candidateIds.map((id) => wallet.getDocumentById(id)));
  return docs.some(Boolean);
}

export async function removeCredentialArtifacts(wallet, credentialId) {
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
}

/**
 * Removes a credential from local wallet storage and EDV, with full sync verification.
 * Returns { success: boolean, message: string }.
 */
export async function deleteCredential({ credentialProvider, wallet, cloudWallet, credentialId }) {
  if (!credentialProvider || !wallet || !credentialId) {
    return { success: false, message: 'Missing required dependencies for credential deletion.' };
  }

  if (!cloudWallet || typeof cloudWallet.pullDocuments !== 'function') {
    return { success: false, message: 'Cloud wallet is unavailable, so EDV deletion cannot be confirmed.' };
  }

  try {
    await credentialProvider.removeCredential(credentialId);
    await waitForCloudWalletSync(cloudWallet);

    // Re-pull from EDV and re-check to confirm delete propagated to cloud.
    await cloudWallet.pullDocuments();
    await waitForCloudWalletSync(cloudWallet);

    if (await hasCredentialArtifacts(wallet, credentialId)) {
      await removeCredentialArtifacts(wallet, credentialId);
      await waitForCloudWalletSync(cloudWallet);
      await cloudWallet.pullDocuments();
      await waitForCloudWalletSync(cloudWallet);
    }

    if (await hasCredentialArtifacts(wallet, credentialId)) {
      throw new Error('Credential still exists after synchronization with EDV.');
    }

    return { success: true, message: 'Credential deleted from local wallet and EDV.' };
  } catch (err) {
    console.error('Error deleting credential', err);
    return { success: false, message: `Delete failed: ${err?.message || 'Unable to delete credential.'}` };
  }
}
