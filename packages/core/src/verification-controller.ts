import {getJSON} from './helpers';
import {pexService} from '@docknetwork/wallet-sdk-wasm/src/services/pex';
import {credentialServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/credential';
import {
  createCredentialProvider,
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
  attributesToReveal?: string[];
};
type CredentialSelectionMap = Map<CredentialId, CredentialSelection>;

export function createVerificationController({
  wallet,
  credentialProvider,
  didProvider,
}: {
  wallet: IWallet;
  credentialProvider?: ICredentialProvider;
  didProvider?: IDIDProvider;
}) {
  const emitter = new EventEmitter();
  let templateJSON = null;
  let status = VerificationStatus.Started;
  /**
   * Extra data to give better context to the current state
   * Can be used to show error messages, or more specific information about the state
   */
  let statusData = null;
  let filteredCredentials = [];
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
      const credentialsWithWitness = await Promise.all(
        bbsKvacSelections.map(async sel => ({
          credential: sel.credential,
          witness: await credentialProvider.getMembershipWitness(sel.credential.id),
          attributesToReveal: sel.attributesToReveal || [],
        })),
      );

      if (sdJwtSelections.length === 0 && regularSelections.length === 0) {
        return credentialServiceRPC.generatePresentationFromPex({
          credentials: credentialsWithWitness,
          pexRequest: templateJSON.request,
          holderKeyDoc: keyDoc,
          holderDid: selectedDID,
          challenge: templateJSON.nonce,
          domain: 'dock.io',
          boundCheckSnarkKey: templateJSON.boundCheckSnarkKey,
          skipSigning: true,
        });
      }

      const derivedCredentials =
        await credentialServiceRPC.deriveVCFromPresentation({
          proofRequest: templateJSON,
          credentials: credentialsWithWitness.map(c => ({
            credential: c.credential,
            witness: c.witness,
            attributesToReveal: [...(c.attributesToReveal || []), 'id'],
          })),
        });

      const allCredentials = [...derivedCredentials];

      for (const sel of sdJwtSelections) {
        const derived = await credentialServiceRPC.createSDJWTPresentation({
          attributesToReveal: sel.attributesToReveal,
          credential: sel.credential._sd_jwt.encoded,
        });
        allCredentials.push(derived);
      }

      for (const sel of regularSelections) {
        allCredentials.push(sel.credential);
      }

      return credentialServiceRPC.createPresentation({
        credentials: allCredentials,
        challenge: templateJSON.nonce,
        keyDoc,
        id: keyDoc.controller.startsWith('did:key:')
          ? keyDoc.id
          : `${keyDoc.controller}#keys-1`,
        domain: 'dock.io',
      });
    }

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

    return credentialServiceRPC.createPresentation({
      credentials,
      challenge: templateJSON.nonce,
      keyDoc,
      id: keyDoc.controller.startsWith('did:key:')
        ? keyDoc.id
        : `${keyDoc.controller}#keys-1`,
      domain: 'dock.io',
    });
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
    const result = credentialServiceRPC.evaluatePresentation({
      presentation,
      presentationDefinition: definition,
    });

    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
    };
  }

  function submitPresentation(presentation) {
    return axios
      .post(templateJSON.response_url, presentation)
      .then(res => res.data);
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
    createPresentation,
    evaluatePresentation,
    getTemplateJSON() {
      return templateJSON;
    },
  };
}
