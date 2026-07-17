import {IWallet} from '../types';
import assert from 'assert';
import {didServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/dids/index';
import {getAllDIDs, getDIDKeyPair} from '../did-provider';

const CREDENTIAL_STATUS_ID_PREFIX = 'status-list2021:dock:0x';

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
  sponsorKey: string;
  apiUrl: string;
}

/**
 * Generate a new registry id: 32 CSPRNG bytes, hex-encoded WITHOUT 0x prefix
 * (64 hex chars). Its unguessability is what makes the claim race-free.
 *
 * @returns the fresh registry id
 */
export function generateRevocationRegistry(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
  const jwt = await signRevocationJWT(ctx, {...body});

  const response = await fetch(
    `${ctx.apiUrl}/delegatable-revocations/${registryId}`,
    {
      method: 'POST',
      headers: {
        'X-MOBILE-SPONSOR-KEY': ctx.sponsorKey,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Revocation request failed (${response.status}): ${text}`);
  }

  return response.json();
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
  // read DELEGATION_REVOCATION_REGISTRY_ID from the wallet
  // if missing (or nextIndex > STATUS_LIST_MAX_INDEX): generate + claim, persist { registryId, statusListCredentialUrl, nextIndex: 0 }
  // return the registry document
  return undefined as any;
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
  // registry = await getRevocationRegistry(ctx)
  // index = registry.nextIndex; assert index <= STATUS_LIST_MAX_INDEX
  // build StatusList2021Entry (statusListIndex as STRING) from registryId + index + url
  // persist registry with nextIndex = index + 1
  // return { credentialStatus, registry }
  return undefined as any;
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
  // parse credential.credentialStatus: registryId from status.id, statusListIndex (string -> NUMBER)
  // sign JWT { action, registryId, credentialId, statusListIndex } via createSignedJWT
  // POST /delegatable-revocations/{registryId} { action, credentialId, statusListIndex } with headers
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
  // read credential.credentialStatus: statusListCredential URL + statusListIndex (string -> NUMBER)
  // GET the StatusList2021Credential from the URL (no auth)
  // decode the encodedList bitstring, return the bit at statusListIndex
  return undefined as any;
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
