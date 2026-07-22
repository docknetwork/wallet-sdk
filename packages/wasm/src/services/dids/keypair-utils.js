/**
 * This code is based on the implementation from truvera api
 * https://github.com/docknetwork/web/blob/3c706c5dc5de4ae63f548c76ec6edeb17533a0c9/apps/api/src/utils/key-manager.js
 */
import {Ed25519Keypair, Secp256r1Keypair} from '@docknetwork/credential-sdk/keypairs';
import {hexToU8a, u8aToHex, u8aToU8a} from '@docknetwork/credential-sdk/utils';
import {EcdsaSecp256r1VerKeyName} from '@docknetwork/credential-sdk/vc/crypto';
// import {encodeBase58} from './dock-shared';
import * as bs58 from 'base58-universal';

export function getKeyPairType(key) {
  const keyType = key.type || key.constructor.VerKeyType;
  if (keyType) {
    return keyType;
  }

  if (key instanceof Ed25519Keypair) {
    return 'Ed25519VerificationKey2018';
  }

  throw new Error(`Unknown key type for ${key.constructor.name}`);
}

export const MULTIBASE_BASE58BTC_HEADER = 'z';
export const MULTICODEC_ED25519_PUB_HEADER = new Uint8Array([0xed, 0x01]);
export const MULTICODEC_ED25519_PRIV_HEADER = new Uint8Array([0x80, 0x26]);
// Multicodec table: p256-pub = 0x1200, p256-priv = 0x1306 (varint-encoded).
// https://github.com/multiformats/multicodec/blob/master/table.csv
export const MULTICODEC_P256_PUB_HEADER = new Uint8Array([0x80, 0x24]);
export const MULTICODEC_P256_PRIV_HEADER = new Uint8Array([0x86, 0x26]);

export function encodeMbKey(header, key) {
  const mbKey = new Uint8Array(header.length + key.length);
  mbKey.set(header);
  mbKey.set(key, header.length);
  return MULTIBASE_BASE58BTC_HEADER + bs58.encode(mbKey);
}

function getKeyFingerprint(keyType, publicKey) {
  if (keyType.startsWith('Ed25519')) {
    return encodeMbKey(MULTICODEC_ED25519_PUB_HEADER, publicKey);
  } else {
    throw new Error(`Cannot detect key type for fingerprint: ${keyType}`);
  }
}

const keyTypeToDocType = {
  bjj: 'BJJVerificationKey2021',
  secp256k1: 'EcdsaSecp256k1VerificationKey2019',
};

export function keypairToKeydoc(key, controller, id = undefined) {
  const keyType = getKeyPairType(key);
  let keyDoc;
  if (
    keyType === 'Ed25519VerificationKey2020' ||
    keyType === 'Ed25519VerificationKey2018'
  ) {
    const publicKey = u8aToU8a(
      (key.keyPair &&
        key.keyPair.publicKey &&
        u8aToU8a(key.keyPair.publicKey)) ||
        key.publicKeyBuffer ||
        (key.pk && key.pk.value),
    );

    if (!publicKey) {
      throw new Error('Cannot find public key');
    }

    const pk = u8aToU8a(
      (key.keyPair && key.keyPair.secretKey) ||
        key.privateKeyBuffer ||
        (key.sk &&
          (typeof key.sk === 'string'
            ? hexToU8a(key.sk)
            : key.sk.value || key.sk)) ||
        hexToU8a(key.pk),
    );

    const publicKeyBase58 = bs58.encode(publicKey);
    const privateKeyBase58 = bs58.encode(pk);

    const fingerprint =
      (key.fingerprint && key.fingerprint()) ||
      getKeyFingerprint(keyType, publicKey);

    // auto create controller
    if (!controller) {
      controller = `did:key:${fingerprint}`;
      id = id || key.id || `${controller}#${fingerprint}`;
    }

    const keyId = id || key.id || `${controller}#${fingerprint}`;
    const type = keyTypeToDocType[keyType] || keyType;
    keyDoc = {
      controller,
      type,
      id: keyId,
      publicKeyMultibase: encodeMbKey(MULTICODEC_ED25519_PUB_HEADER, publicKey),
      privateKeyMultibase: encodeMbKey(MULTICODEC_ED25519_PRIV_HEADER, pk),
      privateKeyBase58,
      publicKeyBase58,
    };

    if (key.seed) {
      keyDoc.seed = u8aToHex(key.seed);
    }
  } else if (keyType === EcdsaSecp256r1VerKeyName) {
    // Not a did:key type: this key is meant to be attached to an existing
    // DID (e.g. as an AP2 mandate signing key), not to mint a new
    // did:key identifier, so a controller must be supplied by the caller.
    if (!controller) {
      throw new Error(
        'A controller DID is required to store a secp256r1 key document',
      );
    }

    const publicKey = key.publicKey().value.bytes;
    const pk = key.privateKey();

    const publicKeyBase58 = bs58.encode(publicKey);
    const privateKeyBase58 = bs58.encode(pk);

    const keyId = id || key.id || `${controller}#secp256r1-1`;
    keyDoc = {
      controller,
      type: keyType,
      id: keyId,
      publicKeyMultibase: encodeMbKey(MULTICODEC_P256_PUB_HEADER, publicKey),
      privateKeyMultibase: encodeMbKey(MULTICODEC_P256_PRIV_HEADER, pk),
      privateKeyBase58,
      publicKeyBase58,
    };
  } else {
    throw new Error(`Unknown keypairToKeydoc type: ${keyType}`);
  }

  keyDoc['@context'] = ['https://w3id.org/wallet/v1'];

  return keyDoc;
}
