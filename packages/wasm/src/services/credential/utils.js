import * as bs58 from 'base58-universal';
import {
  Bls12381BBSKeyPairDock2023,
  Bls12381G2KeyPairDock2022,
  Bls12381BBDT16KeyPairDock2024,
} from '@docknetwork/credential-sdk/vc/crypto';
import {randomAsHex} from '@docknetwork/credential-sdk/utils';
import {X25519KeyAgreementKey2020} from '@digitalbazaar/x25519-key-agreement-key-2020';
import {X25519KeyAgreementKey2019} from '@digitalbazaar/x25519-key-agreement-key-2019';
import {Ed25519VerificationKey2018} from '@digitalbazaar/ed25519-verification-key-2018';
import {Ed25519VerificationKey2020} from '@digitalbazaar/ed25519-verification-key-2020';

import {Ed25519Keypair, Secp256r1Keypair} from '@docknetwork/credential-sdk/keypairs';
import {EcdsaSecp256r1VerKeyName} from '@docknetwork/credential-sdk/vc/crypto';

export async function keyDocToKeypair(keyDoc) {
  if (keyDoc.keypair) {
    return keyDoc;
  }

  const {
    type,
    privateKeyBase58,
    publicKeyBase58,
    privateKeyMultibase,
    publicKeyMultibase,
  } = keyDoc;

  const publicKeyEncoded = publicKeyBase58 || publicKeyMultibase.substr(1);
  const privateKeyEncoded =
    privateKeyBase58 || (privateKeyMultibase && privateKeyMultibase.substr(1));
  if (!privateKeyEncoded) {
    throw new Error(
      `No private key in document found, this should not happen. keyDoc id: ${
        keyDoc.id || '<unknown>'
      }, type: ${type || '<unknown>'}`,
    );
  }

  const privateKeyBytes = bs58.decode(privateKeyEncoded);
  const publicKeyBytes = bs58.decode(publicKeyEncoded);

  if (type === 'Bls12381G2VerificationKeyDock2022') {
    return new Bls12381G2KeyPairDock2022(keyDoc);
  } else if (type === 'Bls12381BBSVerificationKeyDock2023') {
    return new Bls12381BBSKeyPairDock2023(keyDoc);
  } else if (type === 'Bls12381BBDT16VerificationKeyDock2024') {
    return new Bls12381BBDT16KeyPairDock2024(keyDoc);
  } else if (
    type === 'Ed25519VerificationKey2020' ||
    type === 'Ed25519VerificationKey2018'
  ) {
    const key = new Ed25519Keypair(randomAsHex(32));
    key.keyPair.publicKey = publicKeyBytes;
    key.keyPair.secretKey = privateKeyBytes;
    return key;
  } else if (type === EcdsaSecp256r1VerKeyName) {
    return new Secp256r1Keypair(privateKeyBytes, 'private');
  } else {
    throw new Error(`Unsupported key type: ${type}`);
  }
}

const keyConstructors = {
  Ed25519VerificationKey2018: keypairOptions =>
    new Ed25519VerificationKey2018(keypairOptions),
  Ed25519VerificationKey2020: keypairOptions =>
    new Ed25519VerificationKey2020(keypairOptions),
  X25519KeyAgreementKey2019: keypairOptions =>
    new X25519KeyAgreementKey2019(keypairOptions),
  X25519KeyAgreementKey2020: keypairOptions =>
    new X25519KeyAgreementKey2020(keypairOptions),
};

export function getKeypairFromDoc(keypairOptions) {
  const {type} = keypairOptions;
  const keyConstructor = keyConstructors[type];
  if (!keyConstructor) {
    throw new Error(`Unrecognized keypair type to construct: ${type}`);
  }
  return keyConstructor(keypairOptions);
}
