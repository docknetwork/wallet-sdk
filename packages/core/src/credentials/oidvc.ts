import {IWallet} from '../types';
import {IDIDProvider} from '../did-provider';
import {credentialServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/credential';
import {MetadataClient} from '@sphereon/oid4vci-client';
import {jwtDecode} from 'jwt-decode';
import axios from 'axios';
import {pexService} from '@docknetwork/wallet-sdk-wasm/src/services/pex';
import {WellKnownEndpoints} from '@sphereon/oid4vci-common';

export async function acquireOpenIDCredentialFromURI({
  didProvider,
  uri,
  getAuthCode,
  allowInsecureHttpRequests,
}: {
  didProvider: IDIDProvider;
  uri: string;
  getAuthCode?: (authorizationURL: string) => Promise<string>;
  allowInsecureHttpRequests?: boolean;
}): Promise<any> {
  const [holderKeyDocument] = await didProvider.getDIDKeyPairs();

  let response = await credentialServiceRPC.acquireOIDCredential({
    uri,
    holderKeyDocument,
    allowInsecureHttpRequests,
  });

  if (!response) {
    throw new Error('Unable to acquire credential. Please check your credential offer and try again.');
  }

  if (response.authorizationURL) {
    const authorizationCode = await getAuthCode(response.authorizationURL);
    response = await credentialServiceRPC.acquireOIDCredential({
      uri,
      holderKeyDocument,
      authorizationCode,
      allowInsecureHttpRequests,
    });
  }

  return response.credential;
}

export async function getAuthURL(
  uri: string,
  walletClientId: string = 'dock-wallet',
  requestedRedirectURI: string = 'dockwallet://vp',
) {
  function buildOID4VPRequestURL(params, prefix = 'dockwallet://') {
    return `${prefix}?${Object.keys(params)
      .map(
        key =>
          `${encodeURIComponent(key)}=${encodeURIComponent(
            typeof params[key] === 'object'
              ? JSON.stringify(params[key])
              : params[key],
          )}`,
      )
      .join('&')}`;
  }

  const searchParams = new URL(uri).searchParams;
  const params = new URLSearchParams(searchParams);
  const clientId = params.get('client_id');
  // We need to investigate why MetadataClient.retrieveAllMetadata(clientId); is not working on android
  // Follow up bug ticket: https://dock-team.atlassian.net/browse/DCKM-600
  const metadataURI = `${clientId}${WellKnownEndpoints.OPENID_CONFIGURATION}`;
  const {data: metadata} = await axios.get(metadataURI);

  const requestedAlg =
    metadata?.authorizationServerMetadata
      ?.request_object_signing_alg_values_supported[0];
  const requestParams = {
    scope: 'openid vp_token',
    redirect_uri: requestedRedirectURI,
    client_metadata:
      requestedAlg && requestedAlg !== 'EdDSA'
        ? JSON.stringify({
            vp_formats_supported: {
              vc_json: {
                alg_values_supported: [requestedAlg],
              },
            },
          })
        : ['EdDSA'],
  };

  return buildOID4VPRequestURL(
    {
      ...requestParams,
      client_id: walletClientId,
    },
    metadata.authorization_endpoint,
  );
}

export async function decodeRequestJWT(uri: string) {
  const searchParams = new URL(uri).searchParams;
  const params = new URLSearchParams(searchParams);
  const requestUri = params.get('request_uri');
  const jwt = await axios.get(requestUri).then(res => res.data);
  const decoded = jwtDecode(jwt);

  return decoded;
}

export async function getPresentationSubmision({
  credentials,
  presentationDefinition,
  holderDID,
}) {
  const presentation = await pexService.presentationFrom({
    presentationDefinition,
    credentials,
    holderDID,
  });

  return presentation?.presentation_submission;
}

pexService.evaluatePresentation;
