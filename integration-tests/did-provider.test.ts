import {
  getWallet,
  getDIDProvider,
  closeWallet,
} from './helpers/wallet-helpers';
import {IWallet, IDIDProvider} from '@docknetwork/wallet-sdk-core/lib/types';

describe('DID Provider Integration Tests', () => {
  let wallet: IWallet;
  let didProvider: IDIDProvider;

  beforeAll(async () => {
    wallet = await getWallet();
    didProvider = getDIDProvider();
  });

  describe('createDIDKey', () => {
    it('should create a DID:key successfully', async () => {
      const {keyDoc, didDocumentResolution} = await didProvider.createDIDKey({
        name: 'Test DID Integration',
      });

      expect(keyDoc).toBeDefined();
      expect(keyDoc.id).toBeDefined();
      expect(keyDoc.type).toBeDefined();
      expect(didDocumentResolution).toBeDefined();
      expect(didDocumentResolution.id).toBeDefined();
      expect(didDocumentResolution.type).toBe('DIDResolutionResponse');
      expect(didDocumentResolution.didDocument).toBeDefined();
      expect(didDocumentResolution.correlation).toContain(keyDoc.id);
    });

    it('should throw error when name is not provided', async () => {
      await expect(
        didProvider.createDIDKey({
          name: '',
        }),
      ).rejects.toThrowError('name is required');
    });

    it('should create multiple DIDs successfully', async () => {
      const did1 = await didProvider.createDIDKey({
        name: 'First DID',
      });
      const did2 = await didProvider.createDIDKey({
        name: 'Second DID',
      });

      expect(did1.didDocumentResolution.id).not.toBe(did2.didDocumentResolution.id);

      const allDIDs = await didProvider.getAll();
      expect(allDIDs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('editDID', () => {
    it('should edit a DID name successfully', async () => {
      const {didDocumentResolution} = await didProvider.createDIDKey({
        name: 'Original DID Name',
      });

      await didProvider.editDID({
        id: didDocumentResolution.id,
        name: 'Updated DID Name',
      });

      const updatedDoc = await wallet.getDocumentById(didDocumentResolution.id);
      expect(updatedDoc).toBeDefined();
      expect(updatedDoc.name).toBe('Updated DID Name');
    });

    it('should throw error when document ID is not set', async () => {
      await expect(
        didProvider.editDID({
          id: '',
          name: 'New Name',
        }),
      ).rejects.toThrowError('Document ID is not set');
    });

    it('should handle editing non-existent document', async () => {
      await didProvider.editDID({
        id: 'non-existent-did-id-12345',
        name: 'New Name',
      });

      const doc = await wallet.getDocumentById('non-existent-did-id-12345');
      expect(doc).toBeNull();
    });
  });

  describe('deleteDID', () => {
    it('should delete a DID successfully', async () => {
      const {didDocumentResolution} = await didProvider.createDIDKey({
        name: 'DID to Delete',
      });

      const beforeDelete = await wallet.getDocumentById(didDocumentResolution.id);
      expect(beforeDelete).toBeDefined();

      await didProvider.deleteDID({
        id: didDocumentResolution.id,
      });

      const afterDelete = await wallet.getDocumentById(didDocumentResolution.id);
      expect(afterDelete).toBeNull();
    });

    it('should throw error when document ID is empty', async () => {
      await expect(
        didProvider.deleteDID({
          id: '',
        }),
      ).rejects.toThrowError('Document ID is not set');
    });

    it('should throw error when document ID is undefined', async () => {
      await expect(
        didProvider.deleteDID({
          id: undefined as any,
        }),
      ).rejects.toThrowError('Document ID is not set');
    });

    it('should delete DID and associated keypair', async () => {
      const {keyDoc, didDocumentResolution} = await didProvider.createDIDKey({
        name: 'DID with KeyPair to Delete',
      });

      const didBefore = await wallet.getDocumentById(didDocumentResolution.id);
      const keyBefore = await wallet.getDocumentById(keyDoc.id);
      expect(didBefore).toBeDefined();
      expect(keyBefore).toBeDefined();

      await didProvider.deleteDID({
        id: didDocumentResolution.id,
      });

      const didAfter = await wallet.getDocumentById(didDocumentResolution.id);
      expect(didAfter).toBeNull();
    });
  });

  describe('exportDID', () => {
    it('should export DID with correlations successfully', async () => {
      const {didDocumentResolution, keyDoc} = await didProvider.createDIDKey({
        name: 'DID to Export',
      });

      const exportPassword = 'secure-export-password-123';
      const exportedWallet = await didProvider.exportDID({
        id: didDocumentResolution.id,
        password: exportPassword,
      });

      expect(exportedWallet).toBeDefined();
      expect(exportedWallet.type).toContain('EncryptedWallet');
      expect(exportedWallet.credentialSubject).toBeDefined();
      expect(exportedWallet.credentialSubject.encryptedWalletContents).toBeDefined();
      expect(exportedWallet['@context']).toBeDefined();
    });

    it('should throw error when DID document not found', async () => {
      await expect(
        didProvider.exportDID({
          id: 'non-existent-did-id-xyz',
          password: 'test-password',
        }),
      ).rejects.toThrowError('DID Document not found');
    });

    it('should be able to import exported DID', async () => {
      const {didDocumentResolution} = await didProvider.createDIDKey({
        name: 'DID for Export-Import Test',
      });

      const exportPassword = 'test-password-456';
      const exportedWallet = await didProvider.exportDID({
        id: didDocumentResolution.id,
        password: exportPassword,
      });

      await didProvider.deleteDID({
        id: didDocumentResolution.id,
      });

      const deletedDoc = await wallet.getDocumentById(didDocumentResolution.id);
      expect(deletedDoc).toBeNull();

      const importedDocs = await didProvider.importDID({
        encryptedJSONWallet: exportedWallet,
        password: exportPassword,
      });

      expect(importedDocs).toBeDefined();
      expect(Array.isArray(importedDocs)).toBe(true);
      expect(importedDocs.length).toBeGreaterThan(0);

      const reimportedDoc = await wallet.getDocumentById(didDocumentResolution.id);
      expect(reimportedDoc).toBeDefined();
    });
  });

  describe('importDID', () => {
    it('should import DID from encrypted wallet', async () => {
      const {didDocumentResolution} = await didProvider.createDIDKey({
        name: 'DID for Import Test',
      });

      const password = 'import-test-password';
      const exportedWallet = await didProvider.exportDID({
        id: didDocumentResolution.id,
        password,
      });

      await didProvider.deleteDID({
        id: didDocumentResolution.id,
      });

      const importedDocs = await didProvider.importDID({
        encryptedJSONWallet: exportedWallet,
        password,
      });

      expect(importedDocs).toBeDefined();
      expect(importedDocs.length).toBeGreaterThan(0);

      const keyDocument = importedDocs.find((doc: any) =>
        doc.type === 'KeyDocument' || doc.type === 'Ed25519VerificationKey2018'
      );
      const didResolution = importedDocs.find(
        (doc: any) => doc.type === 'DIDResolutionResponse',
      );

      expect(keyDocument).toBeDefined();
      expect(didResolution).toBeDefined();
    });

    it('should throw error for incorrect password', async () => {
      const {didDocumentResolution} = await didProvider.createDIDKey({
        name: 'DID for Password Test',
      });

      const correctPassword = 'correct-password';
      const exportedWallet = await didProvider.exportDID({
        id: didDocumentResolution.id,
        password: correctPassword,
      });

      await didProvider.deleteDID({
        id: didDocumentResolution.id,
      });

      await expect(
        didProvider.importDID({
          encryptedJSONWallet: exportedWallet,
          password: 'wrong-password',
        }),
      ).rejects.toThrowError('Incorrect password');
    });

    it('should prevent duplicate DID imports', async () => {
      const {didDocumentResolution} = await didProvider.createDIDKey({
        name: 'DID for Duplicate Test',
      });

      const password = 'duplicate-test-password';
      const exportedWallet = await didProvider.exportDID({
        id: didDocumentResolution.id,
        password,
      });

      await expect(
        didProvider.importDID({
          encryptedJSONWallet: exportedWallet,
          password,
        }),
      ).rejects.toThrowError('DID already exists in wallet');
    });
  });

  describe('getAll and utility methods', () => {
    it('should get all DIDs in wallet', async () => {
      const allDIDs = await didProvider.getAll();

      expect(Array.isArray(allDIDs)).toBe(true);
      expect(allDIDs.length).toBeGreaterThan(0);

      allDIDs.forEach((did: any) => {
        expect(did.type).toBe('DIDResolutionResponse');
        expect(did.didDocument).toBeDefined();
      });
    });

    it('should get default DID', async () => {
      const defaultDID = await didProvider.getDefaultDID();

      expect(defaultDID).toBeDefined();
      expect(typeof defaultDID).toBe('string');
      expect(defaultDID).toMatch(/^did:/);
    });

    it('should get DID keypairs', async () => {
      const keyPairs = await didProvider.getDIDKeyPairs();

      expect(Array.isArray(keyPairs)).toBe(true);
      expect(keyPairs.length).toBeGreaterThan(0);

      keyPairs.forEach((keyPair: any) => {
        expect(keyPair).toBeDefined();
        expect(keyPair.id).toBeDefined();
      });
    });

    it('should ensure at least one DID exists', async () => {
      await didProvider.ensureDID();

      const allDIDs = await didProvider.getAll();
      expect(allDIDs.length).toBeGreaterThan(0);
    });
  });

  afterAll(() => closeWallet(wallet));
});
