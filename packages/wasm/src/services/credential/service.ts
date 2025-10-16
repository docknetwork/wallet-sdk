// @ts-nocheck

/**
 * @module credential-service
 * @description Verifiable credential management service for the Wallet SDK.
 * This module provides functionality for creating, signing, verifying, and presenting
 * verifiable credentials including support for BBS+ signatures and anonymous credentials.
 */

import {serviceName, validation} from './config';
import {
  Accumulator,
  VB_ACCUMULATOR_22 as AccumulatorType,
  WitnessUpdatePublicInfo,
  MembershipWitness,
} from '@docknetwork/crypto-wasm-ts';
import {OpenID4VCIClientV1_0_13} from '@sphereon/oid4vci-client';
import {Alg} from '@sphereon/oid4vci-common';
import {getKeypairFromDoc} from '@docknetwork/universal-wallet/methods/keypairs';
import {hexToU8a} from '@docknetwork/credential-sdk/utils';
import {
  VerifiablePresentation,
  Presentation,
  verifyCredential,
  verifyPresentation,
  VerifiableCredential,
  getSuiteFromKeyDoc,
} from '@docknetwork/credential-sdk/vc';
import {PEX} from '@sphereon/pex';
import {keyDocToKeypair} from './utils';
import {blockchainService, getDock} from '../blockchain/service';
import {
  applyEnforceBounds,
  hasProvingKey,
  fetchProvingKey,
} from './bound-check';
import assert from 'assert';
import axios from 'axios';
import {getIsRevoked, getWitnessDetails} from './bbs-revocation';
import {getPexRequiredAttributes, shouldSkipAttribute} from './pex-helpers';
import {didService} from '../dids/service';
import {isSDJWTCredential as checkIsSDJWT, credentialToW3C as convertCredentialToW3C, verifySDJWT, createSDJWTPresentation} from './sd-jwt';

/**
 * PEX (Presentation Exchange) instance for credential filtering
 * @private
 */
const pex: PEX = new PEX();

/**
 * Checks if a credential uses BBS+ signature
 * @param {Object} credential - The credential to check
 * @returns {boolean} True if the credential uses BBS+ signature
 * @example
 * const isBBS = isBBSPlusCredential(credential);
 * if (isBBS) {
 *   console.log('This credential uses BBS+ signatures');
 * }
 */
export function isBBSPlusCredential(credential) {
  return (
    (typeof credential?.proof?.type === 'string' &&
      credential.proof.type.includes('BBS+SignatureDock')) ||
    (Array.isArray(credential['@context']) &&
      credential['@context'].find(
        context => typeof context === 'string' && context.indexOf('bbs') > -1,
      ))
  );
}

/**
 * Checks if a credential uses KVAC (BBDT16) signature
 * @param {Object} credential - The credential to check
 * @returns {boolean} True if the credential uses KVAC signature
 * @example
 * const isKVAC = isKvacCredential(credential);
 */
export function isKvacCredential(credential) {
  return (
    typeof credential?.proof?.type === 'string' &&
    credential.proof.type.toLowerCase().includes('bbdt16')
  );
}

/**
 * Checks if a credential is anonymous (BBS+ or KVAC)
 * @param {Object} credential - The credential to check
 * @returns {boolean} True if the credential is anonymous
 * @example
 * if (isAnnonymousCredential(credential)) {
 *   console.log('This credential supports selective disclosure');
 * }
 */
export function isAnnonymousCredential(credential) {
  return isBBSPlusCredential(credential) || isKvacCredential(credential);
}

/**
 * Service class for managing verifiable credentials
 * @class
 * @description Provides methods for creating, signing, verifying, and presenting
 * verifiable credentials with support for various signature types
 */
class CredentialService {
  /**
   * Creates a new CredentialService instance
   * @constructor
   */
  constructor() {
    this.name = serviceName;
  }
  rpcMethods = [
    CredentialService.prototype.generateCredential,
    CredentialService.prototype.signCredential,
    CredentialService.prototype.createPresentation,
    CredentialService.prototype.verifyCredential,
    CredentialService.prototype.createBBSPresentation,
    CredentialService.prototype.deriveVCFromPresentation,
    CredentialService.prototype.isBBSPlusCredential,
    CredentialService.prototype.isKvacCredential,
    CredentialService.prototype.isSDJWTCredential,
    CredentialService.prototype.credentialToW3C,
    CredentialService.prototype.createSDJWTPresentation,
    CredentialService.prototype.acquireOIDCredential,
  ];


  createSDJWTPresentation(params) {
    const {attributesToReveal, credential} = params;
    return createSDJWTPresentation({attributesToReveal, credential});
  }

  /**
   * Generates a new verifiable credential template
   * @param {Object} [params={}] - Generation parameters
   * @param {Object} [params.subject] - The credential subject
   * @returns {VerifiableCredential} A new verifiable credential instance
   * @example
   * const credential = credentialService.generateCredential({
   *   subject: { id: 'did:example:123', name: 'Alice' }
   * });
   */
  generateCredential(params = {}) {
    validation.generateCredential(params);
    const {subject} = params;
    const vc = new VerifiableCredential();

    vc.addType('DockAuthCredential');
    vc.addContext({
      dk: 'https://ld.dock.io/credentials#',
      DockAuthCredential: 'dk:DockAuthCredential',
    });
    if (subject) {
      vc.setSubject(subject);
      vc.addContext({
        state: 'dk:state',
      });
    }
    return vc;
  }
  /**
   * Signs a verifiable credential
   * @param {Object} params - Signing parameters
   * @param {Object} params.vcJson - The credential JSON to sign
   * @param {Object} params.keyDoc - The key document for signing
   * @returns {Promise<VerifiableCredential>} The signed verifiable credential
   * @throws {Error} If validation fails or signing fails
   * @example
   * const signedCredential = await credentialService.signCredential({
   *   vcJson: credentialData,
   *   keyDoc: issuerKeyDocument
   * });
   */
  async signCredential(params) {
    validation.signCredential(params);
    const {vcJson, keyDoc} = params;
    const verifiableCredential = new VerifiableCredential();
    verifiableCredential.setFromJSON(vcJson);
    const kp = getKeypairFromDoc(keyDoc);

    kp.signer = kp.signer();
    const suite = await getSuiteFromKeyDoc(kp);
    verifiableCredential.setIssuer(keyDoc.controller);

    await verifiableCredential.sign(suite);

    return verifiableCredential;
  }
  /**
   * Creates a verifiable presentation from credentials
   * @param {Object} params - Presentation parameters
   * @param {Array<Object>} params.credentials - Array of verifiable credentials to include
   * @param {Object} params.keyDoc - The key document for signing the presentation
   * @param {string} [params.challenge] - Challenge string for the presentation proof
   * @param {string} [params.id] - Presentation identifier
   * @param {string} [params.domain] - Domain for the presentation proof
   * @returns {Promise<Object>} The signed verifiable presentation
   * @throws {Error} If validation fails
   * @example
   * const presentation = await credentialService.createPresentation({
   *   credentials: [credential1, credential2],
   *   keyDoc: holderKeyDocument,
   *   challenge: 'abc123',
   *   domain: 'example.com'
   * });
   */
  async createPresentation(params) {
    validation.createPresentation(params);
    const {credentials, keyDoc, challenge, id, domain} = params;
    const vp = new VerifiablePresentation(id);
    let shouldSkipSigning = false;
    let jwtCredentials = [];

    for (const signedVC of credentials) {

      if (typeof signedVC === 'string') {
        jwtCredentials.push(signedVC);
        shouldSkipSigning = true;
      } else {
        vp.addCredential(signedVC);
      }
      shouldSkipSigning = shouldSkipSigning || isAnnonymousCredential(signedVC);
    }

    if (!shouldSkipSigning) {
      vp.setHolder(keyDoc.controller);
    }

    const keyPair = getKeypairFromDoc(keyDoc);
    keyPair.signer = keyPair.signer();
    const suite = await getSuiteFromKeyDoc(keyPair);

    if (shouldSkipSigning) {
      const result = vp.toJSON();
      result.verifiableCredential.push(...jwtCredentials);
      return result;
    }

    return vp.sign(suite, challenge, domain, blockchainService.resolver);
  }

  /**
   * Verifies a verifiable presentation
   * @param {Object} params - Verification parameters
   * @param {Object} params.presentation - The presentation to verify
   * @param {Object} [params.options] - Verification options
   * @returns {Promise<Object>} Verification result with verified status and any errors
   * @example
   * const result = await credentialService.verifyPresentation({
   *   presentation: presentationData
   * });
   * console.log('Verified:', result.verified);
   */
  async verifyPresentation({ presentation, options }: any) {
    return verifyPresentation(presentation, options);
  }

  /**
   * Verifies a verifiable credential including revocation check
   * @param {Object} params - Verification parameters
   * @param {Object} params.credential - The credential to verify
   * @param {Object} [params.membershipWitness] - Membership witness for revocation check
   * @returns {Promise<Object>} Verification result
   * @returns {boolean} returns.verified - Whether the credential is valid
   * @returns {string} [returns.error] - Error message if verification failed
   * @throws {Error} If validation fails
   * @example
   * const result = await credentialService.verifyCredential({
   *   credential: credentialData,
   *   membershipWitness: witnessData
   * });
   * if (!result.verified) {
   *   console.error('Verification failed:', result.error);
   * }
   */
  async verifyCredential(params) {
    validation.verifyCredential(params);
    let {credential, membershipWitness} = params;

    if (credential._sd_jwt)  {
      credential = credential?._sd_jwt?.encoded;
    }

    if (checkIsSDJWT(credential)) {
      return verifySDJWT(credential);
    }

    const result = await verifyCredential(credential, {
      resolver: blockchainService.resolver,
      revocationApi: {dock: blockchainService.dock},
    });

    const {credentialStatus} = credential;

    if (result.verified && credentialStatus?.id) {
      try {
        const isRevoked = await getIsRevoked(credential, membershipWitness);

        if (isRevoked) {
          result.verified = false;
          result.error = 'revocation check: the credential is revoked';
        }
      } catch (err) {
        console.log('Unable to get revocation status');
        console.error(err);
      }
    }

    return result;
  }

  /**
   * Filters credentials based on a presentation definition
   * @param {Object} params - Filter parameters
   * @param {Array<Object>} params.credentials - Array of credentials to filter
   * @param {Object} params.presentationDefinition - PEX presentation definition
   * @param {string} [params.holderDid] - DID of the credential holder
   * @returns {Object} Filtered credentials matching the presentation definition
   * @example
   * const filtered = credentialService.filterCredentials({
   *   credentials: allCredentials,
   *   presentationDefinition: definition,
   *   holderDid: 'did:example:holder'
   * });
   */
  filterCredentials(params) {
    const {credentials, presentationDefinition, holderDid} = params;
    const result = pex.selectFrom(
      presentationDefinition,
      credentials,
      holderDid,
    );

    return result;
  }

  /**
   * Evaluates a presentation against a presentation definition
   * @param {Object} params - Evaluation parameters
   * @param {Object} params.presentation - The presentation to evaluate
   * @param {Object} params.presentationDefinition - PEX presentation definition
   * @returns {Object} Evaluation result with validation details
   * @example
   * const evaluation = credentialService.evaluatePresentation({
   *   presentation: presentationData,
   *   presentationDefinition: definition
   * });
   */
  evaluatePresentation(params) {
    const {presentation, presentationDefinition} = params;
    const result = pex.evaluatePresentation(
      presentationDefinition,
      presentation,
    );

    return result;
  }

  /**
   * Checks if a credential uses BBS+ signature
   * @param {Object} params - Check parameters
   * @param {Object} params.credential - The credential to check
   * @returns {boolean} True if the credential uses BBS+ signature
   */
  isBBSPlusCredential(params) {
    const {credential} = params;
    return isBBSPlusCredential(credential);
  }

  /**
   * Checks if a credential uses KVAC signature
   * @param {Object} params - Check parameters
   * @param {Object} params.credential - The credential to check
   * @returns {boolean} True if the credential uses KVAC signature
   */
  isKvacCredential(params) {
    const {credential} = params;
    return isKvacCredential(credential);
  }

  /**
   * Checks if a credential is an SD-JWT (Selective Disclosure JWT) credential
   * @param {Object} params - Check parameters
   * @param {string} params.credential - The JWT string to check
   * @returns {boolean} True if the credential is an SD-JWT credential
   * @example
   * const isSDJWT = credentialService.isSDJWTCredential({
   *   credential: 'eyJ0eXAiOiJ2YytzZC1qd3Q...'
   * });
   */
  isSDJWTCredential(params) {
    const {credential} = params;
    return checkIsSDJWT(credential);
  }

  /**
   * Converts a credential to W3C Verifiable Credential format
   * @description Handles both SD-JWT credentials (needs decoding) and regular W3C credentials (returns as-is)
   * @param {Object} params - Conversion parameters
   * @param {string|Object} params.credential - Either an SD-JWT string or a credential object
   * @returns {Promise<Object>} W3C Verifiable Credential format
   * @throws {Error} If credential cannot be converted to W3C format
   * @example
   * // Convert SD-JWT to W3C format
   * const w3cCredential = await credentialService.credentialToW3C({
   *   credential: 'eyJ0eXAiOiJ2YytzZC1qd3Q...'
   * });
   *
   * // Returns W3C credential as-is
   * const w3cCredential = await credentialService.credentialToW3C({
   *   credential: { '@context': [...], type: [...], ... }
   * });
   */
  async credentialToW3C(params) {
    const {credential} = params;
    return convertCredentialToW3C(credential);
  }

  /**
   * Acquires a credential through OpenID for Verifiable Credentials (OID4VC)
   * @param {Object} params - Acquisition parameters
   * @param {string} params.uri - The credential offer URI
   * @param {string} [params.authorizationCode] - Authorization code if required
   * @param {Object} params.holderKeyDocument - Key document for the credential holder
   * @returns {Promise<Object>} Result containing the credential or authorization URL
   * @returns {Object} [returns.credential] - The acquired credential
   * @returns {string} [returns.authorizationURL] - Authorization URL if auth is required
   * @example
   * const result = await credentialService.acquireOIDCredential({
   *   uri: 'openid-credential-offer://...',
   *   holderKeyDocument: keyDoc
   * });
   */
  async acquireOIDCredential({
    uri,
    authorizationCode,
    holderKeyDocument,
  }: {
    uri: string;
    authorizationCode?: string;
    holderKeyDocument: any;
  }): Promise<any> {
    const searchParams = new URL(uri).searchParams;
    const params = new URLSearchParams(searchParams);

    const client = await OpenID4VCIClientV1_0_13.fromURI({
      uri: uri,
      clientId: 'dock.wallet',
      authorizationRequest: {
        redirectUri: 'dock-wallet://credentials/callback',
        clientId: 'dock.wallet',
      },
    });

    const format = 'ldp_vc';
    const { scope }  = client.getCredentialsSupported()[0];
    const scopeSplit = scope.split(':');
    const credentialTypes = scopeSplit[scopeSplit.length - 1];

    let code;

    if (client.credentialOffer?.preAuthorizedCode) {
      code = client.credentialOffer?.preAuthorizedCode;
    } else {
      if (authorizationCode) {
        code = authorizationCode;
      } else {
        return {
          authorizationURL: client.authorizationURL,
        };
      }
    }

    await client.acquireAccessToken({
      code,
    });

    try {
      const response = await client.acquireCredentials({
        credentialTypes,
        proofCallbacks: {
          signCallback: async args => {
            // use service method here
            const jwt = await didService.createSignedJWT({
              payload: args.payload,
              privateKeyDoc: holderKeyDocument,
              headerInput: args.header,
            });

            return jwt;
          },
        },
        context: 'truverawallet',
        format: format,
        alg: Alg.EdDSA,
        kid: holderKeyDocument.id,
      });

      return {
        credential: response.credential,
      };
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Creates a BBS+ presentation with selective disclosure
   * @param {Object} params - Presentation parameters
   * @param {Array<Object>} params.credentials - Array of credentials with attributes to reveal
   * @param {Object} params.credentials[].credential - The BBS+ credential
   * @param {Array<string>} [params.credentials[].attributesToReveal] - Attributes to reveal
   * @returns {Promise<Object>} The BBS+ presentation
   * @throws {Error} If validation fails
   * @example
   * const presentation = await credentialService.createBBSPresentation({
   *   credentials: [{
   *     credential: bbsCredential,
   *     attributesToReveal: ['name', 'age']
   *   }]
   * });
   */
  async createBBSPresentation(params) {
    validation.createBBSPresentation(params);
    const {credentials} = params;

    const bbsPlusPresentation = new Presentation();
    for (const {credential, attributesToReveal} of credentials) {
      const idx = await bbsPlusPresentation.addCredentialToPresent(credential, {
        resolver: blockchainService.resolver,
      });
      if (Array.isArray(attributesToReveal) && attributesToReveal.length > 0) {
        await bbsPlusPresentation.addAttributeToReveal(idx, attributesToReveal);
      }
    }
    return bbsPlusPresentation.createPresentation();
  }

  /**
   * Gets the accumulator ID from a credential's status
   * @param {Object} params - Parameters
   * @param {Object} params.credential - The credential to get accumulator ID from
   * @returns {string|null} The accumulator ID or null if not present
   * @throws {Error} If credential is not provided
   */
  getAccumulatorId({credential}) {
    assert(!!credential, `credential is required`);
    if (!credential?.credentialStatus) {
      return null;
    }

    return credential?.credentialStatus.id;
  }

  /**
   * Gets accumulator data from the blockchain for a credential
   * @param {Object} params - Parameters
   * @param {Object} params.credential - The credential to get accumulator data for
   * @returns {Promise<Object|null>} The accumulator data or null if not found
   * @throws {Error} If credential is not provided
   */
  async getAccumulatorData({credential}) {
    assert(!!credential, `credential is required`);
    const accumulatorId = await this.getAccumulatorId({credential});

    if (!accumulatorId) {
      return null;
    }

    return blockchainService.dock.accumulatorModule.getAccumulator(
      accumulatorId,
      false,
    );
  }

  /**
   * Updates the membership witness with the latest accumulator state
   * @description The witness is generated by the issuer when the credential is created
   * and is stored in the wallet when the credential is imported. This method updates
   * it with the latest accumulator changes from the blockchain.
   * @param {Object} params - Update parameters
   * @param {Object} params.credential - The credential with revocation status
   * @param {Object} params.membershipWitnessJSON - Current membership witness in JSON format
   * @returns {Promise<Object>} Updated membership witness in JSON format
   * @throws {Error} If updates cannot be fetched or applied
   */
  async updateMembershipWitness({credential, membershipWitnessJSON}) {
    const revocationId = credential.credentialStatus.revocationId;
    const member =
      Accumulator.encodePositiveNumberAsAccumulatorMember(revocationId);
    let updates = [];
    try {
      updates = await dock.accumulatorModule.getUpdatesFromBlock(
        accumulatorId,
        accumulator.lastModified,
      );
    } catch (err) {
      if (err.code === -32000) {
        console.error(err);
        // "-32000: Client error: UnknownBlock: State already discarded for BlockId::Hash(<hash>)"
        // This means that the node has discarded old blocks to preserve space. This should not happen with a full node
        updates = [];
      } else {
        throw err;
      }
    }

    const additions = [];
    const removals = [];

    if (updates.length && updates[0].additions !== null) {
      for (const a of updates[0].additions) {
        additions.push(hexToU8a(a));
      }
    }

    if (updates.length && updates[0].removals !== null) {
      for (const a of updates[0].removals) {
        removals.push(hexToU8a(a));
      }
    }

    const queriedWitnessInfo = new WitnessUpdatePublicInfo(
      hexToU8a(updates[0].witnessUpdateInfo),
    );
    const witness = MembershipWitness.fromJSON(membershipWitnessJSON);
    witness.updateUsingPublicInfoPostBatchUpdate(
      member,
      additions,
      removals,
      queriedWitnessInfo,
    );

    return witness.toJSON();
  }

  /**
   * Derives verifiable credentials from a presentation with selective disclosure
   * @param {Object} params - Derivation parameters
   * @param {Array<Object>} params.credentials - Array of credential objects
   * @param {Object} params.credentials[].credential - The credential
   * @param {Array<string>} params.credentials[].attributesToReveal - Attributes to reveal
   * @param {Object} [params.credentials[].witness] - Membership witness for revocation
   * @param {Object} [params.options={}] - Additional options for derivation
   * @param {Object} [params.proofRequest] - Proof request with constraints
   * @returns {Promise<Array>} Array of derived credentials
   * @throws {Error} If validation fails
   * @example
   * const derivedCredentials = await credentialService.deriveVCFromPresentation({
   *   credentials: [{
   *     credential: bbsCredential,
   *     attributesToReveal: ['name', 'dateOfBirth']
   *   }]
   * });
   */
  async deriveVCFromPresentation(params) {
    validation.deriveVCFromPresentation(params);
    const {credentials, options = {}, proofRequest} = params;
    const presentation = new Presentation();
    const selectedCredentials = credentials.map(({credential}) => credential);
    let descriptorBounds = [];

    for (const {credential} of credentials) {
      await presentation.addCredentialToPresent(credential, {
        resolver: blockchainService.resolver,
      });
    }

    if (proofRequest && hasProvingKey(proofRequest)) {
      const {provingKey, provingKeyId} = await fetchProvingKey(proofRequest);
      descriptorBounds = applyEnforceBounds({
        builder: presentation.presBuilder,
        proofRequest,
        provingKey,
        provingKeyId,
        selectedCredentials,
      });
    }

    let pexRequiredAttributes = [];
    if (proofRequest?.request) {
      pexRequiredAttributes = getPexRequiredAttributes(
        proofRequest.request,
        selectedCredentials,
      );
    }

    let idx = 0;
    for (const {attributesToReveal, witness, credential} of credentials) {
      const attributesToSkip = descriptorBounds[idx]
        ? descriptorBounds[idx].map(bound => bound.attributeName)
        : [];
      const filteredAttributes = attributesToReveal.filter(
        attribute => !attributesToSkip.includes(attribute) && !shouldSkipAttribute(attribute),
      );
      const _pexRequiredAttributes = pexRequiredAttributes[idx] || [];

      _pexRequiredAttributes.forEach(attr => {
        if (!filteredAttributes.includes(attr)) {
          filteredAttributes.push(attr);
        }
      });

      if (Array.isArray(filteredAttributes) && filteredAttributes.length > 0) {
        presentation.addAttributeToReveal(idx, filteredAttributes);
      }

      if (witness) {
        const details = await getWitnessDetails(credential, witness);
        const chainModule =
          credential.credentialStatus.id.indexOf('dock:accumulator') === 0
            ? blockchainService.modules.accumulator.modules[0]
            : blockchainService.modules.accumulator.modules[
                blockchainService.modules.accumulator.modules.length - 1
              ];
        const accumulatorModuleClass = chainModule.constructor;

        presentation.presBuilder.addAccumInfoForCredStatus(
          idx,
          details.membershipWitness,
          accumulatorModuleClass.accumulatedFromHex(
            details.accumulator.accumulated,
            AccumulatorType.VBPos,
          ),
          details.pk,
          details.params,
        );
      }

      idx++;
    }

    const credentialsFromPresentation = await presentation.deriveCredentials(
      options,
    );

    return credentialsFromPresentation;
  }

  /**
   * Test method for range proofs
   * @private
   * @returns {Promise<void>}
   */
  async testRangeProof() {
    console.log('test');
  }
}

/**
 * Singleton instance of the credential service
 * @type {CredentialService}
 * @example
 * import { credentialService } from '@docknetwork/wallet-sdk-wasm/services/credential';
 *
 * // Create and sign a credential
 * const credential = credentialService.generateCredential({
 *   subject: { id: 'did:example:123' }
 * });
 * const signed = await credentialService.signCredential({
 *   vcJson: credential,
 *   keyDoc: issuerKey
 * });
 *
 * // Verify a credential
 * const result = await credentialService.verifyCredential({
 *   credential: signedCredential
 * });
 */
export const credentialService = new CredentialService();
