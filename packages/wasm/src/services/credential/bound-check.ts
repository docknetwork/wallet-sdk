import {LegoProvingKey} from '@docknetwork/crypto-wasm-ts/lib/legosnark';
import {PresentationBuilder} from '@docknetwork/crypto-wasm-ts/lib';
import base64url from 'base64url';
import {pexToBounds} from './pex-helpers';
import {utilCryptoService} from '../util-crypto/service';

interface Filter {
  type: string;
  format: string;
  formatMaximum?: string;
  formatMinimum?: string;
}

interface Field {
  path: string[];
  filter: Filter;
  predicate: string;
}

interface Constraints {
  fields: Field[];
}

interface InputDescriptor {
  id: string;
  name: string;
  purpose: string;
  constraints: Constraints;
}

interface Request {
  id: string;
  input_descriptors: InputDescriptor[];
}

interface ProofRequest {
  qr: string;
  id: string;
  name: string;
  nonce: string;
  created: string;
  updated: string;
  verified: boolean;
  response_url: string;
  request: Request;
  type: string;
  boundCheckSnarkKey?: string;
}

/**
 * Receive a presentation builder and a proof request template
 * Convert the proof request template into enforce bound calls on the presentation builder
 * @param param0
 */
export function applyEnforceBounds({
  builder,
  proofRequest,
  provingKeyId,
  provingKey,
  selectedCredentials,
}: {
  builder: PresentationBuilder;
  proofRequest: ProofRequest;
  selectedCredentials: any[];
  provingKeyId: string;
  provingKey: LegoProvingKey;
}) {
  const descriptorBounds = pexToBounds(
    proofRequest.request,
    selectedCredentials,
  );

  let skipProvingKey = false;

  descriptorBounds.forEach((items, credentialIdx) => {
    if (!selectedCredentials[credentialIdx]) {
      return;
    }
    items.forEach((bound) => {
      builder.enforceBounds(
        credentialIdx,
        bound.attributeName,
        bound.min,
        bound.max,
        provingKeyId,
        skipProvingKey ? undefined : provingKey,
      );
      skipProvingKey = true;
   });
  });

  return descriptorBounds;
}

export async function fetchBlobFromUrl(url: string): Promise<Uint8Array> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    throw new Error(`Error fetching proving key: ${err.message}`);
  }
}

export function blobFromBase64(base64String: string): Uint8Array {
  const cleanedBase64 = base64String.replace(
    /^data:application\/octet-stream;base64,/,
    '',
  );
  return new Uint8Array(base64url.toBuffer(cleanedBase64));
}

export async function isBase64OrDataUrl(str: string): Promise<boolean> {
  return (
    (await utilCryptoService.isBase64(str)) ||
    (str as string).indexOf('data:application/octet-stream') > -1
  );
}

export async function fetchProvingKey(proofRequest: ProofRequest) {
  let blob: Uint8Array;

  if (await isBase64OrDataUrl(proofRequest.boundCheckSnarkKey)) {
    console.log('Is base64');
    blob = blobFromBase64(proofRequest.boundCheckSnarkKey);
  } else {
    console.log('is not base64');
    blob = await fetchBlobFromUrl(proofRequest.boundCheckSnarkKey);
  }

  const provingKey = new LegoProvingKey(blob);
  return {provingKey, provingKeyId: 'key0'};
}

export const hasProvingKey = (proofRequest: ProofRequest) =>
  !!proofRequest.boundCheckSnarkKey;
