import {getJSON} from './helpers';
import {pexService} from '@docknetwork/wallet-sdk-wasm/src/services/pex';
import {credentialServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/credential';
import {
  createCredentialProvider,
  CredentialStatus,
  ICredentialProvider,
} from './credential-provider';
import {IWallet} from './types';
import {EventEmitter} from 'events';
import axios from 'axios';
import assert from 'assert';
import {createDIDProvider, IDIDProvider} from './did-provider';

export enum VerificationStatus {
  Started = 'Started',
  LoadingTemplate = 'LoadingTemplate',
  Filtering = 'Filtering',
  FetchingProvingKey = 'FetchingProvingKey',
  Error = 'Error',
  NoCredentialsInTheWallet = 'NoCredentialsInTheWallet',
  SelectingCredentials = 'SelectingCredentials',
}

type CredentialId = string;
type CredentialSelection = {
  credential: any;
  /**
   * Optional list of credential attributes to reveal in the presentation.
   * When omitted, the credential-sdk automatically determines which attributes
   * to reveal based on the PEX (Presentation Exchange) template requirements.
   * This allows generating a default presentation without manual attribute selection.
   */
  attributesToReveal?: string[];
};
type CredentialSelectionMap = Map<CredentialId, CredentialSelection>;

export interface IVerificationController {
  emitter: EventEmitter;
  selectedCredentials: CredentialSelectionMap;
  getStatus: () => VerificationStatus;
  getStatusData: () => any;
  submitPresentation: (presentation: any) => Promise<any>;
  getSelectedDID: () => string | null;
  setSelectedDID: (did: string) => void;
  start: (params: {template: string | any}) => Promise<void>;
  isBBSPlusCredential: (credential: any) => Promise<boolean>;
  loadCredentials: () => Promise<void>;
  getFilteredCredentials: () => any[];
  createPresentation: () => Promise<any>;
  createDefaultPresentation: () => Promise<any>;
  evaluatePresentation: (presentation: any) => {
    isValid: boolean;
    errors: any[];
    warnings: any[];
  };
  getRequirementGroups: () => Array<{
    descriptorKey: string;
    descriptorName: string;
    candidates: any[];
  }>;
  getSelectedCredentialsByDescriptor: () => any[];
  getCredentialOptionsForDescriptor: (credentialId: string) => Promise<any>;
  switchCredential: (
    currentCredentialId: string,
    replacementCredentialId: string,
  ) => Promise<void>;
  getRequestedAttributes: (credentialId: string) => any[];
  getCredentialStatus: (credentialId: string) => Promise<any>;
  canSwitchCredential: (credentialId: string) => Promise<boolean>;
  getTemplateJSON: () => any;
}

export function createVerificationController({
  wallet,
  credentialProvider,
  didProvider,
}: {
  wallet: IWallet;
  credentialProvider?: ICredentialProvider;
  didProvider?: IDIDProvider;
}): IVerificationController {
  const emitter = new EventEmitter();
  let templateJSON = null;
  let status = VerificationStatus.Started;
  /**
   * Extra data to give better context to the current state
   * Can be used to show error messages, or more specific information about the state
   */
  let statusData = null;
  let filteredCredentials = [];
  let filteredMatches = [];
  let selectedCredentials: CredentialSelectionMap = new Map();
  let selectedDID = null;

  if (!credentialProvider) {
    credentialProvider = createCredentialProvider({wallet});
  }

  if (!didProvider) {
    didProvider = createDIDProvider({wallet});
  }

  async function start({template}: {template: string | any}) {
    setState(VerificationStatus.LoadingTemplate);

    // check for dids
    const dids = await didProvider.getAll();

    if (!dids.length) {
      setState(VerificationStatus.Error, {
        message: 'no_dids_in_the_wallet',
      });
      throw new Error('No DIDs in the wallet');
    }

    // the application needs to verify if there are more DIDs available, and allow the user to change this selection before creating a presentation
    selectedDID = dids[0].didDocument.id;
    templateJSON = await getJSON(template);

    await loadCredentials();

    setState(VerificationStatus.SelectingCredentials);
  }

  function setState(_status: VerificationStatus, data?: any) {
    status = _status;
    statusData = data;
    emitter.emit(_status, data);
  }

  async function loadCredentials() {
    setState(VerificationStatus.Filtering);

    // get wallet credentials and apply pex filter
    const allCredentials = await credentialProvider.getCredentials();

    if (!allCredentials.length) {
      setState(VerificationStatus.NoCredentialsInTheWallet);
      return;
    }

    try {
      const result = await pexService.filterCredentials({
        credentials: allCredentials,
        presentationDefinition: getPresentationDefinition(),
        holderDIDs: [],
      });

      filteredCredentials = result.verifiableCredential;
      filteredMatches = result.matches || [];
    } catch (err) {
      console.error(
        `Unable to filter credentials using the template: \n ${JSON.stringify(
          templateJSON,
          null,
          2,
        )}`,
      );
      console.error(err);

      setState(VerificationStatus.Error);
      throw err;
    }
  }

  function getPresentationDefinition() {
    return templateJSON.request;
  }

  async function isBBSPlusCredential(credential) {
    return credentialServiceRPC.isBBSPlusCredential({credential});
  }

  async function isKvacCredential(credential) {
    return credentialServiceRPC.isKvacCredential({credential});
  }

  async function deriveNonBbsCredentials(sdJwtSelections, regularSelections) {
    const credentials = [];

    for (const sel of sdJwtSelections) {
      const derived = await credentialServiceRPC.createSDJWTPresentation({
        attributesToReveal: sel.attributesToReveal,
        credential: sel.credential._sd_jwt.encoded,
      });
      credentials.push(derived);
    }

    for (const sel of regularSelections) {
      credentials.push(sel.credential);
    }

    return credentials;
  }

  function getKeyId(keyDoc) {
    return keyDoc.controller.startsWith('did:key:')
      ? keyDoc.id
      : `${keyDoc.controller}#keys-1`;
  }

  async function assembleSignedPresentation(credentials, keyDoc) {
    return credentialServiceRPC.createPresentation({
      credentials,
      challenge: templateJSON.nonce,
      keyDoc,
      id: getKeyId(keyDoc),
      domain: 'dock.io',
    });
  }

  function getRequirementGroups() {
    if (filteredMatches.length === 0) {
      return [
        {
          descriptorKey: 'default',
          descriptorName: 'default',
          candidates: [...filteredCredentials],
        },
      ];
    }

    const groups: Array<{
      descriptorKey: string;
      descriptorName: string;
      candidates: any[];
    }> = [];
    const groupKeyFn = match =>
      match.from ? JSON.stringify(match.from) : match.name || match.id || '';
    const seen = new Map<string, number>();

    for (const match of filteredMatches) {
      const key = groupKeyFn(match);
      const candidateIndices: number[] = [];
      for (const path of match.vc_path || []) {
        const indexMatch = path.match(/\[(\d+)\]/);
        if (indexMatch) {
          candidateIndices.push(parseInt(indexMatch[1], 10));
        }
      }
      const candidates = candidateIndices
        .map(idx => filteredCredentials[idx])
        .filter(Boolean);

      if (match.from || !seen.has(key)) {
        seen.set(key, groups.length);
        groups.push({
          descriptorKey: key,
          descriptorName: match.name || match.id || key,
          candidates,
        });
      } else {
        const existing = groups[seen.get(key)];
        for (const cred of candidates) {
          if (!existing.candidates.some(c => c.id === cred.id)) {
            existing.candidates.push(cred);
          }
        }
      }
    }

    return groups;
  }

  async function filterValidCredentials(candidates: any[]) {
    const results = await Promise.all(
      candidates.map(async cred => {
        const statusResult = await credentialProvider.getCredentialStatus(cred);
        return {
          credential: cred,
          status: statusResult.status,
        };
      }),
    );

    return results
      .filter(
        r =>
          r.status !== CredentialStatus.Revoked &&
          r.status !== CredentialStatus.Invalid,
      )
      .map(r => r.credential);
  }

  async function createDefaultPresentation() {
    assert(filteredCredentials.length > 0, 'No filtered credentials available');

    selectedCredentials.clear();

    const groups = getRequirementGroups();
    for (const group of groups) {
      const validCandidates = await filterValidCredentials(group.candidates);
      const chosen =
        validCandidates.find(cred => !selectedCredentials.has(cred.id)) ||
        validCandidates[0];
      if (chosen) {
        selectedCredentials.set(chosen.id, {credential: chosen});
      }
    }

    assert(
      selectedCredentials.size > 0,
      'No credentials could be selected for the presentation',
    );

    return createPresentation();
  }

  function getSelectedCredentialsByDescriptor() {
    const groups = getRequirementGroups();

    return groups.map(group => {
      const selected =
        group.candidates.find(cred => selectedCredentials.has(cred.id)) || null;
      const alternatives = group.candidates.filter(
        cred => !selected || cred.id !== selected.id,
      );

      return {
        descriptorId: group.descriptorKey,
        descriptorName: group.descriptorName,
        selected,
        alternatives,
      };
    });
  }

  async function getCredentialOptionsForDescriptor(credentialId: string) {
    const groups = getRequirementGroups();
    const group = groups.find(g =>
      g.candidates.some(c => c.id === credentialId),
    );

    assert(
      group,
      `Credential ${credentialId} not found in any descriptor group`,
    );

    const selected = group.candidates.find(c => c.id === credentialId);
    const allAlternatives = group.candidates.filter(c => c.id !== credentialId);
    const alternatives = await filterValidCredentials(allAlternatives);

    return {
      descriptorId: group.descriptorKey,
      descriptorName: group.descriptorName,
      selected,
      alternatives,
    };
  }

  async function switchCredential(
    currentCredentialId: string,
    replacementCredentialId: string,
  ) {
    assert(
      selectedCredentials.has(currentCredentialId),
      `Credential ${currentCredentialId} is not currently selected`,
    );

    const options = await getCredentialOptionsForDescriptor(currentCredentialId);
    const replacement = options.alternatives.find(
      c => c.id === replacementCredentialId,
    );

    assert(
      replacement,
      `Credential ${replacementCredentialId} is not a valid replacement for ${currentCredentialId}`,
    );

    selectedCredentials.delete(currentCredentialId);
    selectedCredentials.set(replacementCredentialId, {credential: replacement});

    return createPresentation();
  }

  function getAttributesToRevealFromTemplate(credential) {
    const definition = getPresentationDefinition();
    if (!definition?.input_descriptors) {
      return ['id'];
    }

    const attributes = ['id'];
    for (const descriptor of definition.input_descriptors) {
      const fields = descriptor.constraints?.fields || [];
      for (const field of fields) {
        if (!field.path) {
          continue;
        }
        const paths = Array.isArray(field.path) ? field.path : [field.path];
        for (const p of paths) {
          const attr = p.replace('$.', '');
          if (
            attr &&
            !attributes.includes(attr) &&
            !attr.startsWith('type') &&
            !attr.startsWith('issuer') &&
            !attr.startsWith('@context') &&
            !attr.startsWith('proof') &&
            !attr.startsWith('credentialSchema') &&
            !attr.startsWith('issuanceDate')
          ) {
            // Only include if the credential actually has this attribute
            const value = attr
              .split('.')
              .reduce((obj, key) => obj?.[key], credential);
            if (value !== undefined) {
              attributes.push(attr);
            }
            break;
          }
        }
      }
    }

    return attributes;
  }

  function ensureDescriptorMap(presentation) {
    if (presentation?.presentation_submission?.descriptor_map?.length > 0) {
      return presentation;
    }

    const definition = getPresentationDefinition();
    if (!definition?.input_descriptors) {
      return presentation;
    }

    const descriptorMap = definition.input_descriptors.map(
      (descriptor, idx) => ({
        id: descriptor.id,
        format: 'ldp_vp',
        path: `$.verifiableCredential[${idx}]`,
      }),
    );

    presentation.presentation_submission = {
      ...presentation.presentation_submission,
      definition_id: definition.id,
      descriptor_map: descriptorMap,
    };

    return presentation;
  }

  async function createPresentation() {
    assert(!!selectedDID, 'No DID selected');
    assert(!!selectedCredentials.size, 'No credentials selected');

    const didKeyPairList = await didProvider.getDIDKeyPairs();
    const keyDoc = didKeyPairList.find(doc => doc.controller === selectedDID);
    assert(keyDoc, `No key pair found for the selected DID ${selectedDID}`);

    const sdJwtSelections = [];
    const bbsKvacSelections = [];
    const regularSelections = [];

    for (const credentialSelection of selectedCredentials.values()) {
      if (credentialSelection.credential._sd_jwt) {
        sdJwtSelections.push(credentialSelection);
      } else {
        const isBBS = await isBBSPlusCredential(credentialSelection.credential);
        const isKVAC = await isKvacCredential(credentialSelection.credential);
        if (isBBS || isKVAC) {
          bbsKvacSelections.push(credentialSelection);
        } else {
          regularSelections.push(credentialSelection);
        }
      }
    }

    if (bbsKvacSelections.length > 0) {
      // When attributesToReveal is undefined, the credential-sdk will automatically
      // determine which attributes to reveal based on the PEX template requirements.
      // This enables generating a default presentation without manual attribute selection.
      const credentialsWithWitness = await Promise.all(
        bbsKvacSelections.map(async sel => {
          return {
            credential: sel.credential,
            witness: await credentialProvider.getMembershipWitness(
              sel.credential.id,
            ),
            attributesToReveal:
              sel.attributesToReveal ||
              getAttributesToRevealFromTemplate(sel.credential),
          };
        }),
      );

      // Derive each BBS+/KVAC credential separately, then assemble into a signed presentation.
      // This approach uses deriveVCFromPresentation which properly handles range proof
      // bound checks and produces presentations that the Truvera API can verify.
      const derivedResults = await Promise.all(
        credentialsWithWitness.map(c =>
          credentialServiceRPC.deriveVCFromPresentation({
            proofRequest: templateJSON,
            credentials: [
              {
                credential: c.credential,
                witness: c.witness,
                attributesToReveal: c.attributesToReveal,
              },
            ],
          }),
        ),
      );
      const derivedCredentials = derivedResults.flat();

      const nonBbsCredentials = await deriveNonBbsCredentials(
        sdJwtSelections,
        regularSelections,
      );
      const presentation = await assembleSignedPresentation(
        [...derivedCredentials, ...nonBbsCredentials],
        keyDoc,
      );
      return presentation;
    }

    // No BBS+/KVAC: handle SD-JWT and regular only
    const credentials = await deriveNonBbsCredentials(
      sdJwtSelections,
      regularSelections,
    );
    const presentation = await assembleSignedPresentation(credentials, keyDoc);
    return ensureDescriptorMap(presentation);
  }

  /**
   * Filtered credentials
   */
  function getFilteredCredentials() {
    return filteredCredentials;
  }

  function getStatus() {
    return status;
  }

  function getStatusData() {
    return statusData;
  }

  function setSelectedDID(did: string) {
    selectedDID = did;
  }

  /**
   * Use pex to evaluate presentation
   *
   * @param presentation
   */
  function evaluatePresentation(presentation) {
    const definition = getPresentationDefinition();
    const result = pexService.evaluatePresentation({
      presentation,
      presentationDefinition: definition,
    });

    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
    };
  }

  function getRequestedAttributes(credentialId: string) {
    const definition = getPresentationDefinition();
    if (!definition?.input_descriptors) {
      return [];
    }

    const groups = getRequirementGroups();
    const group = groups.find(g =>
      g.candidates.some(c => c.id === credentialId),
    );
    if (!group) {
      return [];
    }

    const credential = group.candidates.find(c => c.id === credentialId);
    if (!credential) {
      return [];
    }

    const descriptor = definition.input_descriptors.find(
      d => (d.name || d.id) === group.descriptorName,
    );
    if (!descriptor?.constraints?.fields) {
      return [];
    }

    const attributesToSkip = [
      /^type/,
      /^issuer/,
      /^@context/,
      /^proof/,
      /^credentialSchema/,
      /^issuanceDate/,
      /^credentialStatus/,
      /^cryptoVersion/,
    ];

    return descriptor.constraints.fields
      .map(field => {
        const paths = Array.isArray(field.path) ? field.path : [field.path];
        let resolvedPath = null;
        let value;

        for (const p of paths) {
          const cleanPath = p.replace('$.', '');
          const pathParts = cleanPath.split('.');
          let current = credential;
          let found = true;
          for (const part of pathParts) {
            if (current && typeof current === 'object' && part in current) {
              current = current[part];
            } else {
              found = false;
              break;
            }
          }
          if (found) {
            resolvedPath = cleanPath;
            value = current;
            break;
          }
        }

        if (!resolvedPath) {
          return null;
        }

        if (attributesToSkip.some(regex => regex.test(resolvedPath))) {
          return null;
        }

        const isRangeProof = !!(
          field.filter &&
          (field.filter.minimum !== undefined ||
            field.filter.maximum !== undefined ||
            field.filter.exclusiveMinimum !== undefined ||
            field.filter.exclusiveMaximum !== undefined ||
            field.filter.formatMinimum !== undefined ||
            field.filter.formatMaximum !== undefined)
        );

        return {
          name: resolvedPath,
          value: isRangeProof ? null : value,
          isRangeProof,
          isOptional: field.optional === true,
          ...(isRangeProof && {
            min:
              field.filter.minimum ??
              field.filter.exclusiveMinimum ??
              field.filter.formatMinimum,
            max:
              field.filter.maximum ??
              field.filter.exclusiveMaximum ??
              field.filter.formatMaximum,
          }),
        };
      })
      .filter(Boolean);
  }

  async function getCredentialStatus(credentialId: string) {
    const groups = getRequirementGroups();
    let credential = null;

    for (const group of groups) {
      credential = group.candidates.find(c => c.id === credentialId);
      if (credential) {
        break;
      }
    }

    assert(
      credential,
      `Credential ${credentialId} not found in any descriptor group`,
    );

    return credentialProvider.isValid(credential);
  }

  async function canSwitchCredential(credentialId: string) {
    try {
      const options = await getCredentialOptionsForDescriptor(credentialId);
      return options.alternatives.length > 0;
    } catch {
      return false;
    }
  }

  async function submitPresentation(presentation, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await axios.post(templateJSON.response_url, presentation);
        return res.data;
      } catch (err) {
        const httpStatus = err?.response?.status;
        const isRetryable =
          !httpStatus || httpStatus === 429 || httpStatus >= 500;

        if (!isRetryable || attempt === maxRetries - 1) {
          throw err;
        }
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    emitter,
    selectedCredentials,
    getStatus,
    getStatusData,
    submitPresentation,
    getSelectedDID() {
      return selectedDID;
    },
    setSelectedDID,
    start,
    isBBSPlusCredential,
    loadCredentials,
    getFilteredCredentials,
    createDefaultPresentation,
    createPresentation,
    evaluatePresentation,
    getRequirementGroups,
    getSelectedCredentialsByDescriptor,
    getCredentialOptionsForDescriptor,
    switchCredential,
    getRequestedAttributes,
    getCredentialStatus,
    canSwitchCredential,
    getTemplateJSON() {
      return templateJSON;
    },
  };
}
