import {IWallet} from '../types';
import assert from 'assert';
import axios from 'axios';
import {didServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/dids/index';
import {credentialServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/credential';
import {utilCryptoService} from '@docknetwork/wallet-sdk-wasm/src/services/util-crypto';
import {getAllDIDs, getDIDKeyPair} from '../did-provider';

const CREDENTIAL_STATUS_ID_PREFIX = 'status-list2021:dock:0x';

export const STATUS_LIST_2021_CONTEXT =
  'https://w3id.org/vc/status-list/2021/v1';

/**
 * Wallet document id under which the single per-wallet revocation registry is
 * persisted. Holds { registryId, statusListCredentialUrl, nextIndex }.
 */
export const DELEGATION_REVOCATION_REGISTRY_ID = 'DelegationRevocationRegistry';

/** Valid statusListIndex range for the fixed 131,072-bit status list. */
export const STATUS_LIST_MAX_INDEX = 131071;

export type RevocationAction = 'create' | 'revoke' | 'unrevoke';

/**
 * Persisted registry state. `nextIndex` MUST survive backup/restore — a
 * double-assigned index revokes two credentials at once.
 */
export interface RevocationRegistry {
  registryId: string; // 64 hex chars, no 0x prefix
  statusListCredentialUrl: string; // public status list URL from the create response
  nextIndex: number; // next statusListIndex to assign, 0..STATUS_LIST_MAX_INDEX
}

/**
 * StatusList2021Entry embedded in a credential at issuance.
 * Note the asymmetry: statusListIndex is a STRING here, but a NUMBER in the
 * revocation request body and JWT claims.
 * TODO: Update workspace api to accept string index, or convert to number in the revocation service.
 */
export interface StatusList2021Entry {
  id: string; // status-list2021:dock:0x<registryId>#<index>
  type: 'StatusList2021Entry';
  statusPurpose: 'revocation';
  statusListIndex: string;
  statusListCredential: string;
}

/**
 * Common context for every signed revocation API call.
 *
 * `apiUrl` doubles as the JWT `aud` claim and MUST exactly match the server's
 * configured SERVER_URL (no trailing slash) or the token is rejected with 401.
 */
export interface RevocationContext {
  wallet: IWallet;
  issuerDID: string; // the did:key that owns the registry / signs the JWT
  truveraApiSponsorKey: string;
  apiUrl: string;
}

/**
 * Resolve the issuer DID's private key doc and produce a DID-signed JWT whose
 * payload mirrors `claims` plus the standard aud/iss/iat/exp fields.
 */
async function signRevocationJWT(
  ctx: RevocationContext,
  claims: Record<string, any>,
): Promise<string> {
  const dids = await getAllDIDs({wallet: ctx.wallet});
  const didDoc = dids.find(d => d.didDocument.id === ctx.issuerDID);
  assert(!!didDoc, 'issuer DID not found in wallet');
  const privateKeyDoc = await getDIDKeyPair(ctx.wallet, didDoc);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: ctx.apiUrl,
    iss: ctx.issuerDID,
    iat: now,
    exp: now + 120,
    ...claims,
  };

  return await didServiceRPC.createSignedJWT({
    payload,
    privateKeyDoc,
    headerInput: {typ: 'JWT', alg: 'EdDSA'},
  });
}

/**
 * Sign a JWT mirroring `body`, then POST the revocation control action.
 * Throws on any non-2xx response.
 */
async function postRevocation(
  ctx: RevocationContext,
  registryId: string,
  body: Record<string, any>,
): Promise<any> {
  assert(!!ctx.truveraApiSponsorKey, 'truveraApiSponsorKey is required');
  const jwt = await signRevocationJWT(ctx, {registryId, ...body});

  try {
    const response = await axios.post(
      `${ctx.apiUrl}/delegatable-revocations/${registryId}`,
      body,
      {
        headers: {
          'X-MOBILE-SPONSOR-KEY': ctx.truveraApiSponsorKey,
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new Error(
        `Revocation request failed (${err.response.status}): ${JSON.stringify(err.response.data)}`,
      );
    }
    throw err;
  }
}

/**
 * Claim a registry with a DID-signed `create` call. Idempotent for the owning
 * DID. MUST be called BEFORE issuing any credential that references it.
 *
 * @param ctx signing + api context
 * @param registryId the id to claim
 * @returns the statusListCredential URL from the create response
 */
export async function claimRevocationRegistry(
  ctx: RevocationContext,
  registryId: string,
): Promise<string> {
  const response = await postRevocation(ctx, registryId, {action: 'create'});
  return response.statusListCredential;
}

/**
 * Get the wallet's revocation registry, creating + claiming one on first use or
 * when the previous registry's index counter is exhausted.
 *
 * @param ctx signing + api context
 * @returns the persisted registry state
 */
export async function getRevocationRegistry(
  ctx: RevocationContext,
): Promise<RevocationRegistry> {
  const existing = await ctx.wallet.getDocumentById(
    DELEGATION_REVOCATION_REGISTRY_ID,
  );

  if (existing && existing.nextIndex <= STATUS_LIST_MAX_INDEX) {
    return existing as RevocationRegistry;
  }

  const registryId = await utilCryptoService.generateRegistryId();
  const statusListCredentialUrl = await claimRevocationRegistry(ctx, registryId);
  const doc = {
    id: DELEGATION_REVOCATION_REGISTRY_ID,
    type: 'DelegationRevocationRegistry',
    registryId,
    statusListCredentialUrl,
    nextIndex: 0,
  };

  if (existing) {
    await ctx.wallet.updateDocument(doc);
  } else {
    await ctx.wallet.addDocument(doc);
  }

  return doc;
}

/**
 * Reserve the next statusListIndex and build the StatusList2021Entry to embed at
 * issuance. Increments and persists nextIndex atomically with wallet state.
 *
 * @param ctx signing + api context
 * @returns the credentialStatus entry plus the updated registry
 */
export async function allocateStatusEntry(
  ctx: RevocationContext,
): Promise<{credentialStatus: StatusList2021Entry; registry: RevocationRegistry}> {
  const registry = await getRevocationRegistry(ctx);
  const index = registry.nextIndex;
  assert(index <= STATUS_LIST_MAX_INDEX, 'revocation registry exhausted');

  const credentialStatus: StatusList2021Entry = {
    id: `${CREDENTIAL_STATUS_ID_PREFIX}${registry.registryId}#${index}`,
    type: 'StatusList2021Entry',
    statusPurpose: 'revocation',
    statusListIndex: String(index),
    statusListCredential: registry.statusListCredentialUrl,
  };

  const updatedRegistry = {...registry, nextIndex: index + 1};
  await ctx.wallet.updateDocument(updatedRegistry);

  return {credentialStatus, registry: updatedRegistry};
}

/**
 * Validate a credential's credentialStatus is a well-formed StatusList2021Entry
 * and extract the registryId + integer index. Throws with a clear message on any
 * malformed/missing field rather than letting a downstream TypeError or NaN leak.
 */
function parseStatusEntry(credential: any): {
  registryId: string;
  statusListIndex: number;
} {
  const status = credential?.credentialStatus;
  assert(
    !!status && status.type === 'StatusList2021Entry',
    'credential has no StatusList2021Entry credentialStatus',
  );
  assert(
    typeof status.id === 'string' &&
      status.id.startsWith(CREDENTIAL_STATUS_ID_PREFIX),
    'invalid credentialStatus.id',
  );
  const registryId = status.id
    .slice(CREDENTIAL_STATUS_ID_PREFIX.length)
    .split('#')[0];
  assert(
    /^[0-9a-f]{64}$/.test(registryId),
    'invalid registryId in credentialStatus.id',
  );
  const statusListIndex = Number(status.statusListIndex);
  assert(
    Number.isInteger(statusListIndex) &&
      statusListIndex >= 0 &&
      statusListIndex <= STATUS_LIST_MAX_INDEX,
    'invalid statusListIndex in credentialStatus',
  );
  return {registryId, statusListIndex};
}

/**
 * Revoke or unrevoke a delegatable credential.
 *
 * Extracts registryId and index from the credential's credentialStatus,
 * signs a DID JWT, and POSTs the control action. Handles idempotency; a 409
 * indicates a wallet-side counter bug and should NOT be retried blindly.
 *
 * @param credential the delegatable credential carrying a StatusList2021Entry
 * @param ctx signing + api context (issuerDID must own the registry)
 * @param action 'revoke' or 'unrevoke'
 */
export async function setDelegatableCredentialRevocation(
  credential: any,
  ctx: RevocationContext,
  action: 'revoke' | 'unrevoke',
): Promise<void> {
  const {registryId, statusListIndex} = parseStatusEntry(credential);
  const credentialId = credential.id;

  await postRevocation(ctx, registryId, {action, credentialId, statusListIndex});
}

/**
 * Check whether a delegatable credential is currently revoked.
 *
 * Public read — no auth, no sponsor key. Fetches the StatusList2021Credential
 * from the credential's own statusListCredential URL and reads the bit at its
 * statusListIndex. Verifiers do this automatically; this is for wallet-side UI.
 *
 * @param credential the delegatable credential carrying a StatusList2021Entry
 * @returns true if the index bit is set (revoked), false otherwise
 */
export async function isDelegatableCredentialRevoked(
  credential: any,
): Promise<boolean> {
  const {statusListIndex} = parseStatusEntry(credential);
  const {data: statusListCredential} = await axios.get(
    credential.credentialStatus.statusListCredential,
  );
  return credentialServiceRPC.isStatusList2021Revoked({
    statusListCredential,
    statusListIndex,
  });
}

/** Convenience wrapper: revoke. */
export function revokeDelegatableCredential(
  credential: any,
  ctx: RevocationContext,
): Promise<void> {
  return setDelegatableCredentialRevocation(credential, ctx, 'revoke');
}

/** Convenience wrapper: unrevoke. */
export function unrevokeDelegatableCredential(
  credential: any,
  ctx: RevocationContext,
): Promise<void> {
  return setDelegatableCredentialRevocation(credential, ctx, 'unrevoke');
}
