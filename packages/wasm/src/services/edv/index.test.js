import base64url from 'base64url-universal';

import {assertRpcService} from '../test-utils';
import {validation} from './configs';
import {edvService as service} from './service';
import {EDVServiceRpc} from './service-rpc';

describe('EDVService', () => {
  it('ServiceRpc', () => {
    assertRpcService(EDVServiceRpc, service, validation);
  });

  describe('service', () => {
    beforeAll(async () => {});

    describe('generateKeys', () => {
      it('should generate EDV keys', async () => {
        const keys = await service.generateKeys();

        expect(keys.agreementKey).toBeDefined();
        expect(keys.hmacKey).toBeDefined();
        expect(keys.verificationKey).toBeDefined();
      });
    });

    describe('deriveKeys', () => {
      it('should derive EDV keys', async () => {
        const testMasterKey = new Uint8Array(
          base64url.decode('0O+9vxwb3Zo/9AVcQfVeQ59wvgcYUVH/mTye6islspM='),
        );
        const derivedTestAgreementKey =
          '{"id":"did:key:z6Mkt1paLGw6VqRCTmqjpbiP9fxLVHJb8k97zERL6TcWr9Ru#z6LSojEubzYtAGCBE7Mwwks7J3Gttsrd1c9EXcDuNjthwVQj","controller":"did:key:z6Mkt1paLGw6VqRCTmqjpbiP9fxLVHJb8k97zERL6TcWr9Ru","type":"X25519KeyAgreementKey2020","publicKeyMultibase":"z6LSojEubzYtAGCBE7Mwwks7J3Gttsrd1c9EXcDuNjthwVQj","privateKeyMultibase":"z3weoV5H5DppQ7pjABoopaiDFN6zH3SokESte2Jte87YNXgg"}';
        const derivedTestHmacKey =
          '0O-9vxwb3Zo_9AVcQfVeQ59wvgcYUVH_mTye6islspM';
        const derivedTestVerificationKey =
          '{"id":"did:key:z6Mkt1paLGw6VqRCTmqjpbiP9fxLVHJb8k97zERL6TcWr9Ru#z6Mkt1paLGw6VqRCTmqjpbiP9fxLVHJb8k97zERL6TcWr9Ru","controller":"did:key:z6Mkt1paLGw6VqRCTmqjpbiP9fxLVHJb8k97zERL6TcWr9Ru","type":"Ed25519VerificationKey2018","publicKeyBase58":"EZZXk2gfAHvjMH1392kYJaQLfi2jirtmJDWQGBeVvveX","privateKeyBase58":"5BHUEjDDbDzQKnveM9qXXXmRqwTtmBvumTY2xZXN61x8dvZHgzsDaTpkVqkE4LSoMLcV6yDRhxcv7mMTzdaJ21pX"}';
        const {agreementKey, hmacKey, verificationKey} =
          await service.deriveKeys(testMasterKey);

        expect(hmacKey).toBeDefined();
        expect(hmacKey).toBe(derivedTestHmacKey);
        expect(verificationKey).toBeDefined();
        expect(JSON.stringify(verificationKey)).toBe(
          derivedTestVerificationKey,
        );
        expect(agreementKey).toBeDefined();
        expect(JSON.stringify(agreementKey)).toBe(derivedTestAgreementKey);
      });
    });

    describe('deriveBiometricKey', () => {
      it('should derive a key from biometric data', () => {
        const biometricData = Buffer.from('mock-biometric-data');
        const identifier = 'user@example.com';

        const key = service.deriveBiometricKey(biometricData, identifier);

        expect(key).toBeDefined();
        expect(Buffer.isBuffer(key)).toBe(true);
        expect(key.length).toBe(32); // HKDF_LENGTH
      });

      it('should produce consistent keys for same inputs', () => {
        const biometricData = Buffer.from('mock-biometric-data');
        const identifier = 'user@example.com';

        const key1 = service.deriveBiometricKey(biometricData, identifier);
        const key2 = service.deriveBiometricKey(biometricData, identifier);

        expect(key1.equals(key2)).toBe(true);
      });

      it('should produce different keys for different identifiers', () => {
        const biometricData = Buffer.from('mock-biometric-data');
        const identifier1 = 'user1@example.com';
        const identifier2 = 'user2@example.com';

        const key1 = service.deriveBiometricKey(biometricData, identifier1);
        const key2 = service.deriveBiometricKey(biometricData, identifier2);

        expect(key1.equals(key2)).toBe(false);
      });

      it('should produce different keys for different biometric data', () => {
        const biometricData1 = Buffer.from('mock-biometric-data-1');
        const biometricData2 = Buffer.from('mock-biometric-data-2');
        const identifier = 'user@example.com';

        const key1 = service.deriveBiometricKey(biometricData1, identifier);
        const key2 = service.deriveBiometricKey(biometricData2, identifier);

        expect(key1.equals(key2)).toBe(false);
      });
    });

    describe('deriveBiometricEncryptionKey', () => {
      it('should derive encryption key and IV', async () => {
        const biometricData = Buffer.from('mock-biometric-data');
        const identifier = 'user@example.com';

        const result = await service.deriveBiometricEncryptionKey(biometricData, identifier);

        expect(result).toBeDefined();
        expect(result.key).toBeDefined();
        expect(result.iv).toBeDefined();
        expect(Buffer.isBuffer(result.key)).toBe(true);
        expect(Buffer.isBuffer(result.iv)).toBe(true);
        expect(result.key.length).toBe(32); // HKDF_LENGTH
        expect(result.iv.length).toBe(16); // AES-GCM IV length
      });

      it('should produce consistent keys but different IVs for same inputs', async () => {
        const biometricData = Buffer.from('mock-biometric-data');
        const identifier = 'user@example.com';

        const result1 = await service.deriveBiometricEncryptionKey(biometricData, identifier);
        const result2 = await service.deriveBiometricEncryptionKey(biometricData, identifier);

        expect(result1.key.equals(result2.key)).toBe(true);
        // IVs should be different (random)
        expect(result1.iv.equals(result2.iv)).toBe(false);
      });
    });

    describe('encryptMasterKey and decryptMasterKey', () => {
      it('should encrypt and decrypt master key successfully', async () => {
        const masterKey = new Uint8Array(32).fill(42);
        const encryptionKey = Buffer.from(new Uint8Array(32).fill(1));
        const iv = Buffer.from(new Uint8Array(16).fill(2));

        const encrypted = await service.encryptMasterKey(masterKey, encryptionKey, iv);
        expect(encrypted).toBeDefined();
        expect(encrypted instanceof Uint8Array).toBe(true);
        expect(encrypted.length).toBeGreaterThan(0);

        const decrypted = await service.decryptMasterKey(encrypted, encryptionKey, iv);
        expect(decrypted).toBeDefined();
        expect(decrypted instanceof Uint8Array).toBe(true);
        expect(new Uint8Array(decrypted)).toEqual(masterKey);
      });

      it('should fail to decrypt with wrong key', async () => {
        const masterKey = new Uint8Array(32).fill(42);
        const encryptionKey = Buffer.from(new Uint8Array(32).fill(1));
        const wrongKey = Buffer.from(new Uint8Array(32).fill(99));
        const iv = Buffer.from(new Uint8Array(16).fill(2));

        const encrypted = await service.encryptMasterKey(masterKey, encryptionKey, iv);

        await expect(service.decryptMasterKey(encrypted, wrongKey, iv))
          .rejects.toThrow('Decryption failed: Invalid key or corrupted data');
      });

      it('should fail to decrypt with wrong IV', async () => {
        const masterKey = new Uint8Array(32).fill(42);
        const encryptionKey = Buffer.from(new Uint8Array(32).fill(1));
        const iv = Buffer.from(new Uint8Array(16).fill(2));
        const wrongIv = Buffer.from(new Uint8Array(16).fill(99));

        const encrypted = await service.encryptMasterKey(masterKey, encryptionKey, iv);

        await expect(service.decryptMasterKey(encrypted, encryptionKey, wrongIv))
          .rejects.toThrow('Decryption failed: Invalid key or corrupted data');
      });

      it('should produce different ciphertext for same plaintext with different IVs', async () => {
        const masterKey = new Uint8Array(32).fill(42);
        const encryptionKey = Buffer.from(new Uint8Array(32).fill(1));
        const iv1 = Buffer.from(new Uint8Array(16).fill(2));
        const iv2 = Buffer.from(new Uint8Array(16).fill(3));

        const encrypted1 = await service.encryptMasterKey(masterKey, encryptionKey, iv1);
        const encrypted2 = await service.encryptMasterKey(masterKey, encryptionKey, iv2);

        expect(encrypted1).not.toEqual(encrypted2);
      });

      it('should handle empty master key', async () => {
        const masterKey = new Uint8Array(0);
        const encryptionKey = Buffer.from(new Uint8Array(32).fill(1));
        const iv = Buffer.from(new Uint8Array(16).fill(2));

        const encrypted = await service.encryptMasterKey(masterKey, encryptionKey, iv);
        const decrypted = await service.decryptMasterKey(encrypted, encryptionKey, iv);

        expect(new Uint8Array(decrypted)).toEqual(masterKey);
      });
    });

    describe('integration: biometric encryption workflow', () => {
      it('should complete full encryption workflow', async () => {
        const biometricData = Buffer.from('mock-biometric-data');
        const identifier = 'user@example.com';
        const masterKey = new Uint8Array(32).fill(123);

        // Derive encryption key and IV from biometric data
        const { key, iv } = await service.deriveBiometricEncryptionKey(biometricData, identifier);

        // Encrypt master key
        const encrypted = await service.encryptMasterKey(masterKey, key, iv);

        // Decrypt master key
        const decrypted = await service.decryptMasterKey(encrypted, key, iv);

        // Verify decrypted matches original
        expect(new Uint8Array(decrypted)).toEqual(masterKey);
      });

      it('should fail workflow with different biometric data', async () => {
        const biometricData1 = Buffer.from('mock-biometric-data-1');
        const biometricData2 = Buffer.from('mock-biometric-data-2');
        const identifier = 'user@example.com';
        const masterKey = new Uint8Array(32).fill(123);

        // Encrypt with first biometric data
        const { key: key1, iv } = await service.deriveBiometricEncryptionKey(biometricData1, identifier);
        const encrypted = await service.encryptMasterKey(masterKey, key1, iv);

        // Try to decrypt with second biometric data (should fail)
        const { key: key2 } = await service.deriveBiometricEncryptionKey(biometricData2, identifier);

        await expect(service.decryptMasterKey(encrypted, key2, iv))
          .rejects.toThrow('Decryption failed: Invalid key or corrupted data');
      });
    });
  });
});
