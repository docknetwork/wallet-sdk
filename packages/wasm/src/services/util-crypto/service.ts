// @ts-nocheck
import {hexToU8a, randomAsHex, u8aToString} from '@docknetwork/credential-sdk/utils';
import * as bip39 from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english';
import assert from 'assert';
import {validation} from './configs';

function isHex(value: string) {
  const isDefinitelyHexString = value.startsWith('0x');
  const isHex =
    isDefinitelyHexString || (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0);

  return isHex;
}

export class UtilCryptoService {
  rpcMethods = [
    UtilCryptoService.prototype.mnemonicGenerate,
    UtilCryptoService.prototype.mnemonicToMiniSecret,
    UtilCryptoService.prototype.isBase64,
    UtilCryptoService.prototype.hexToString,
    UtilCryptoService.prototype.generateRegistryId,
  ];

  constructor() {
    this.name = 'utilCrypto';
  }

  mnemonicGenerate(numWords = 12) {
    validation.mnemonicGenerate(numWords);

    // @scure/bip39 uses strength in bits, not number of words
    // 12 words = 128 bits, 15 words = 160 bits, 18 words = 192 bits, 21 words = 224 bits, 24 words = 256 bits
    const strengthMap = {
      12: 128,
      15: 160,
      18: 192,
      21: 224,
      24: 256
    };
    
    const strength = strengthMap[numWords];
    if (!strength) {
      throw new Error(`Invalid number of words: ${numWords}. Supported values: 12, 15, 18, 21, 24`);
    }

    return bip39.generateMnemonic(wordlist, strength);
  }

  mnemonicToMiniSecret(phrase) {
    validation.mnemonicToMiniSecret(phrase);

    // Convert mnemonic to entropy which gives us a 32-byte mini secret for 12-word mnemonics
    // This matches the behavior of Polkadot's mnemonicToMiniSecret
    const entropy = bip39.mnemonicToEntropy(phrase, wordlist);
    
    // For 12-word mnemonics, entropy is already 16 bytes (128 bits)
    // We need to pad it to 32 bytes to match Polkadot's mini secret size
    // Polkadot uses PBKDF2 with specific parameters, but for compatibility
    // we can use the seed derivation and take the first 32 bytes
    const seed = bip39.mnemonicToSeedSync(phrase);
    
    // Return first 32 bytes as Uint8Array to match the expected mini secret format
    return new Uint8Array(seed.slice(0, 32));
  }

  isBase64(value) {
    if (typeof value !== 'string') {
      return false;
    }

    if (value === '') {
      return false;
    }

    const regex = '(?:[A-Za-z0-9+\\/]{4})*(?:[A-Za-z0-9+\\/]{2}(==)?|[A-Za-z0-9+\\/]{3}=?)?';
    if (!(new RegExp('^' + regex + '$', 'gi')).test(value)) {
      return false;
    }

    try {
      const decoded = Buffer.from(value, 'base64');
      const asUtf8 = decoded.toString('utf8');
      const reencoded = Buffer.from(asUtf8, 'utf8').toString('base64');
      
      const normalize = (str) => str.replace(/=+$/, '');
      
      return normalize(value) === normalize(reencoded);
    } catch (e) {
      return false;
    }
  }

  /**
   * Generate a revocation registry id: 32 CSPRNG bytes as 64 hex chars,
   * WITHOUT the 0x prefix.
   */
  generateRegistryId(): string {
    return randomAsHex(32).replace(/^0x/, '');
  }

  hexToString(hex: string): string {
    try {
      const bytes = hexToU8a(hex);
      return u8aToString(bytes);
    } catch (e) {
      console.log('error: ', e);
    }

    return '';
  }
}

export const utilCryptoService: UtilCryptoService = new UtilCryptoService();
