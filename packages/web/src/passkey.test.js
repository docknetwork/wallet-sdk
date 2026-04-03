import {
  checkPasskeySupport,
  registerPasskey,
  getPasskeyPRFKey,
  credentialIdToBase64url,
  base64urlToCredentialId,
} from './passkey';

describe('passkey helpers', () => {
  describe('credentialIdToBase64url', () => {
    it('should convert Uint8Array to base64url string', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const result = credentialIdToBase64url(bytes);

      expect(result).toBe('SGVsbG8');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });

    it('should handle bytes that produce + / = in base64', () => {
      // 0xFB, 0xFF, 0xFE produces base64 with + and /
      const bytes = new Uint8Array([251, 255, 254]);
      const result = credentialIdToBase64url(bytes);

      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });

    it('should handle empty array', () => {
      const result = credentialIdToBase64url(new Uint8Array([]));
      expect(result).toBe('');
    });
  });

  describe('base64urlToCredentialId', () => {
    it('should convert base64url string back to Uint8Array', () => {
      const result = base64urlToCredentialId('SGVsbG8');
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should handle base64url characters (- and _)', () => {
      // Create bytes, encode, then decode and verify roundtrip
      const original = new Uint8Array([251, 255, 254]);
      const encoded = credentialIdToBase64url(original);
      const decoded = base64urlToCredentialId(encoded);

      expect(decoded).toEqual(original);
    });

    it('should handle padding correctly', () => {
      // 1 byte needs 2 padding chars, 2 bytes need 1 padding char
      const oneByteResult = base64urlToCredentialId(
        credentialIdToBase64url(new Uint8Array([42])),
      );
      expect(oneByteResult).toEqual(new Uint8Array([42]));

      const twoBytesResult = base64urlToCredentialId(
        credentialIdToBase64url(new Uint8Array([42, 43])),
      );
      expect(twoBytesResult).toEqual(new Uint8Array([42, 43]));
    });
  });

  describe('credentialId roundtrip', () => {
    it('should survive encode/decode roundtrip for various lengths', () => {
      const testCases = [
        new Uint8Array([]),
        new Uint8Array([0]),
        new Uint8Array([255]),
        new Uint8Array(16).fill(128),
        new Uint8Array(32).map((_, i) => i),
        new Uint8Array(64).map((_, i) => i * 4),
      ];

      for (const original of testCases) {
        const encoded = credentialIdToBase64url(original);
        const decoded = base64urlToCredentialId(encoded);
        expect(decoded).toEqual(original);
      }
    });
  });

  describe('checkPasskeySupport', () => {
    const originalWindow = global.window;

    afterEach(() => {
      global.window = originalWindow;
    });

    it('should return false when window is undefined', async () => {
      delete global.window;
      const result = await checkPasskeySupport();
      expect(result).toEqual({webauthn: false, prf: false});
    });

    it('should return false when PublicKeyCredential is not available', async () => {
      global.window = {PublicKeyCredential: undefined};
      const result = await checkPasskeySupport();
      expect(result).toEqual({webauthn: false, prf: false});
    });

    it('should return true when PublicKeyCredential is available', async () => {
      global.window = {PublicKeyCredential: jest.fn()};
      const result = await checkPasskeySupport();
      expect(result).toEqual({webauthn: true, prf: true});
    });
  });

  describe('registerPasskey', () => {
    let originalNavigator;
    let originalWindow;

    beforeEach(() => {
      originalNavigator = global.navigator;
      originalWindow = global.window;
      global.window = {
        PublicKeyCredential: jest.fn(),
        location: {hostname: 'localhost'},
      };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
      global.window = originalWindow;
    });

    it('should throw when WebAuthn is not supported', async () => {
      global.window = {PublicKeyCredential: undefined};

      await expect(registerPasskey('user@test.com')).rejects.toThrow(
        'WebAuthn is not supported in this browser',
      );
    });

    it('should call navigator.credentials.create with correct options', async () => {
      const mockCredential = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({prf: {enabled: true}}),
      };

      global.navigator = {
        credentials: {create: jest.fn().mockResolvedValue(mockCredential)},
      };

      await registerPasskey('user@test.com', 'My App', 'example.com');

      const createCall = global.navigator.credentials.create.mock.calls[0][0];
      expect(createCall.publicKey.rp.name).toBe('My App');
      expect(createCall.publicKey.rp.id).toBe('example.com');
      expect(createCall.publicKey.user.name).toBe('user@test.com');
      expect(createCall.publicKey.extensions.prf).toEqual({});
      expect(createCall.publicKey.authenticatorSelection.residentKey).toBe(
        'required',
      );
    });

    it('should use defaults for rpName and rpId', async () => {
      const mockCredential = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({prf: {enabled: false}}),
      };

      global.navigator = {
        credentials: {create: jest.fn().mockResolvedValue(mockCredential)},
      };

      await registerPasskey('user@test.com');

      const createCall = global.navigator.credentials.create.mock.calls[0][0];
      expect(createCall.publicKey.rp.name).toBe('Truvera Wallet');
      expect(createCall.publicKey.rp.id).toBe('localhost');
    });

    it('should return credentialId and prfSupported status', async () => {
      const rawId = new Uint8Array([1, 2, 3, 4]).buffer;
      const mockCredential = {
        rawId,
        getClientExtensionResults: () => ({prf: {enabled: true}}),
      };

      global.navigator = {
        credentials: {create: jest.fn().mockResolvedValue(mockCredential)},
      };

      const result = await registerPasskey('user@test.com');

      expect(result.credentialId).toEqual(new Uint8Array([1, 2, 3, 4]));
      expect(result.prfSupported).toBe(true);
    });

    it('should report prfSupported as false when PRF is not enabled', async () => {
      const mockCredential = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({}),
      };

      global.navigator = {
        credentials: {create: jest.fn().mockResolvedValue(mockCredential)},
      };

      const result = await registerPasskey('user@test.com');
      expect(result.prfSupported).toBe(false);
    });
  });

  describe('getPasskeyPRFKey', () => {
    let originalNavigator;
    let originalWindow;

    beforeEach(() => {
      originalNavigator = global.navigator;
      originalWindow = global.window;
      global.window = {
        PublicKeyCredential: jest.fn(),
        location: {hostname: 'localhost'},
      };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
      global.window = originalWindow;
    });

    it('should throw when WebAuthn is not supported', async () => {
      global.window = {PublicKeyCredential: undefined};

      await expect(getPasskeyPRFKey('user@test.com')).rejects.toThrow(
        'WebAuthn is not supported in this browser',
      );
    });

    it('should call navigator.credentials.get with PRF extension', async () => {
      const prfFirst = new ArrayBuffer(32);
      const mockAssertion = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({
          prf: {results: {first: prfFirst}},
        }),
      };

      global.navigator = {
        credentials: {get: jest.fn().mockResolvedValue(mockAssertion)},
      };

      await getPasskeyPRFKey('user@test.com');

      const getCall = global.navigator.credentials.get.mock.calls[0][0];
      expect(getCall.publicKey.userVerification).toBe('required');
      expect(getCall.publicKey.extensions.prf.eval.first).toBeInstanceOf(
        Uint8Array,
      );
      expect(getCall.publicKey.rpId).toBe('localhost');
    });

    it('should include allowCredentials when credentialId is provided', async () => {
      const prfFirst = new ArrayBuffer(32);
      const mockAssertion = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({
          prf: {results: {first: prfFirst}},
        }),
      };

      global.navigator = {
        credentials: {get: jest.fn().mockResolvedValue(mockAssertion)},
      };

      const credentialId = new Uint8Array([10, 20, 30]);
      await getPasskeyPRFKey('user@test.com', {credentialId});

      const getCall = global.navigator.credentials.get.mock.calls[0][0];
      expect(getCall.publicKey.allowCredentials).toHaveLength(1);
      expect(getCall.publicKey.allowCredentials[0].type).toBe('public-key');
    });

    it('should not include allowCredentials when credentialId is omitted', async () => {
      const prfFirst = new ArrayBuffer(32);
      const mockAssertion = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({
          prf: {results: {first: prfFirst}},
        }),
      };

      global.navigator = {
        credentials: {get: jest.fn().mockResolvedValue(mockAssertion)},
      };

      await getPasskeyPRFKey('user@test.com');

      const getCall = global.navigator.credentials.get.mock.calls[0][0];
      expect(getCall.publicKey.allowCredentials).toBeUndefined();
    });

    it('should return prfOutput and credentialId', async () => {
      const prfBytes = new Uint8Array(32).fill(42);
      const rawId = new Uint8Array([1, 2, 3]).buffer;
      const mockAssertion = {
        rawId,
        getClientExtensionResults: () => ({
          prf: {results: {first: prfBytes.buffer}},
        }),
      };

      global.navigator = {
        credentials: {get: jest.fn().mockResolvedValue(mockAssertion)},
      };

      const result = await getPasskeyPRFKey('user@test.com');

      expect(result.prfOutput).toEqual(new Uint8Array(32).fill(42));
      expect(result.credentialId).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('should throw when PRF results are missing', async () => {
      const mockAssertion = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({}),
      };

      global.navigator = {
        credentials: {get: jest.fn().mockResolvedValue(mockAssertion)},
      };

      await expect(getPasskeyPRFKey('user@test.com')).rejects.toThrow(
        'PRF extension not supported by this authenticator',
      );
    });

    it('should use custom rpId when provided', async () => {
      const prfFirst = new ArrayBuffer(32);
      const mockAssertion = {
        rawId: new ArrayBuffer(16),
        getClientExtensionResults: () => ({
          prf: {results: {first: prfFirst}},
        }),
      };

      global.navigator = {
        credentials: {get: jest.fn().mockResolvedValue(mockAssertion)},
      };

      await getPasskeyPRFKey('user@test.com', {rpId: 'example.com'});

      const getCall = global.navigator.credentials.get.mock.calls[0][0];
      expect(getCall.publicKey.rpId).toBe('example.com');
    });
  });
});
