import assert from 'assert';
import axios from 'axios';
import {Logger} from '@docknetwork/wallet-sdk-wasm/src/core/logger';
import {
  didcommCreateEncrypted,
  didcommDecrypt,
  didcommCreateSignedJWT,
  DIDCOMM_TYPE_ISSUE_DIRECT,
  getDerivedAgreementKey,
} from './didcomm';
import {
  fromBase64,
  generateSignedPayload,
  generateSignedPayloadFromList,
  toBase64,
} from './payloads';
import {jwtDecode} from 'jwt-decode';
import {blockchainService} from '@docknetwork/wallet-sdk-wasm/src/services/blockchain/service';
import {utilCryptoService} from '@docknetwork/wallet-sdk-wasm/src/services/util-crypto/service';

let serviceURL = process.env.RELAY_SERVICE_URL || 'https://relay.truvera.io';

export const didcomm = {
  encrypt: didcommCreateEncrypted,
  decrypt: didcommDecrypt,
};

const sendMessage = async ({keyPairDoc, recipientDid, message, type}) => {
  assert(!!keyPairDoc, 'keyPairDoc is required');
  assert(!!recipientDid, 'recipientDid is required');
  assert(!!message, 'message is required');

  const keyAgreementKey = await getDerivedAgreementKey(keyPairDoc);
  const jweMessage = await didcomm.encrypt({
    recipientDids: [recipientDid],
    type: type || DIDCOMM_TYPE_ISSUE_DIRECT,
    senderDid: keyPairDoc.controller,
    payload: message,
    keyAgreementKey,
  });

  const didDocument = await blockchainService.resolveDID(recipientDid);
  const services =
    didDocument?.service?.filter(
      endpoint => endpoint.type === 'DIDCommMessaging',
    ) || [];

  const serviceEndpoints = services
    .flatMap(service => {
      if (!service.serviceEndpoint) {
        return [];
      }

      if (!Array.isArray(service.serviceEndpoint)) {
        return [service.serviceEndpoint];
      }

      return service.serviceEndpoint;
    })
    .filter(endpoint => endpoint.accept?.includes('didcomm/v2'));

  // Try each endpoint until one is successful
  for (const endpoint of serviceEndpoints) {
    try {
      const result = await axios.post(endpoint.uri, jweMessage, {
        headers: {
          'Content-Type': 'application/didcomm-encrypted+json',
          Accept: 'application/didcomm-encrypted+json',
        },
      });

      return {
        success: result.data.status === 'received',
        endpoint: endpoint.uri,
      };
    } catch (err) {
      console.error(
        `Failed to send message to ${endpoint.uri}:`,
        err.response || err.message,
      );
    }
  }

  const {payload, did} = await generateSignedPayload(keyPairDoc, {
    to: recipientDid,
    msg: toBase64(jweMessage),
  });

  try {
    const result = await axios.post(
      `${serviceURL}/messages/${encodeURIComponent(did)}`,
      {
        payload: toBase64(payload),
      },
    );

    return {
      success: result.data.success,
    };
  } catch (err) {
    console.error(err.response);
    throw err;
  }
};

const getMessages = async ({
  keyPairDocs,
  limit = 20,
  skipMessageResolution = false,
}) => {
  assert(!!keyPairDocs, 'keyPairDoc is required');
  assert(Array.isArray(keyPairDocs), 'keyPairDocs must be an array');
  assert(!!keyPairDocs.length, 'keyPairDocs must not be empty');

  const {payload, dids} = await generateSignedPayloadFromList(keyPairDocs, {
    limit,
  });

  try {
    const result = await axios.get(
      `${serviceURL}/messages/batch-dids?dids=${encodeURIComponent(
        JSON.stringify(dids),
      )}&payload=${toBase64(payload)}&keepMessages=true`,
    );

    const data = result.data;

    if (skipMessageResolution) {
      return data;
    }

    const messages = await Promise.all(
      data.map(async message => {
        const didCommMessage = await resolveDidcommMessage({
          message,
          keyPairDocs,
        });

        return {
          ...message,
          ...didCommMessage,
          msg: didCommMessage.body,
        };
      }),
    );

    return messages.filter(item => !!item);
  } catch (err) {
    console.error(err.response);
    return err;
  }
};

const ackMessages = ({did, messageIds}) => {
  assert(!!did, 'did is required');
  assert(!!messageIds, 'messageIds is required');
  return axios.post(`${serviceURL}/messages/ack`, {
    ack: messageIds,
    did,
  });
};

const registerDIDPushNotification = async ({keyPairDocs, token}) => {
  assert(!!keyPairDocs, 'keyPairDoc is required');
  assert(Array.isArray(keyPairDocs), 'keyPairDocs must be an array');
  assert(!!keyPairDocs.length, 'keyPairDocs must not be empty');
  assert(!!token, 'token is required');

  const {payload, dids} = await generateSignedPayloadFromList(keyPairDocs, {
    token,
  });

  try {
    const result = await axios.post(
      `${serviceURL}/register/batch-dids?dids=${encodeURIComponent(
        JSON.stringify(dids),
      )}&payload=${toBase64(payload)}`,
    );

    return result.data;
  } catch (err) {
    console.error(err.response);
    return err;
  }
};

async function jwtHandler(message) {
  try {
    const jwt = await jwtDecode(message);
    return jwt;
  } catch (err) {
    return false;
  }
}

async function base64Handler(message) {
  if (!(await utilCryptoService.isBase64(message))) {
    return false;
  }

  return fromBase64(message);
}

async function jsonHandler(message) {
  try {
    const json = JSON.parse(message);
    return json;
  } catch (err) {
    return false;
  }
}

const messageHandlers = [base64Handler, jwtHandler, jsonHandler];

async function resolveJweString(message) {
  let resolvedMessage = message;

  try {
    for (const handler of messageHandlers) {
      let _result = await handler(resolvedMessage);
      if (_result) {
        resolvedMessage = _result;
      }
    }
  } catch (e) {
    Logger.debug(`Invalid JWE message received: ${message}`);
    console.error(e);
    return null;
  }

  return resolvedMessage;
}

function isURL(str) {
  try {
    // eslint-disable-next-line no-new
    new URL(str);
    return true;
  } catch (err) {
    return false;
  }
}

export async function resolveDidcommMessage({keyPairDocs, message}) {
  assert(!!keyPairDocs, 'keyPairDoc is required');
  assert(Array.isArray(keyPairDocs), 'keyPairDocs must be an array');
  assert(!!keyPairDocs.length, 'keyPairDocs must not be empty');

  let jwe = message.msg || message;

  if (jwe && jwe.indexOf('didcomm://') > -1) {
    jwe = jwe.replace('didcomm://', '');
  }

  if (isURL(jwe)) {
    try {
      const {data} = await axios.get(jwe);
      jwe = data;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  try {
    // Parse JSON strings
    jwe = JSON.parse(jwe);
  } catch (_err) {}

  if (typeof jwe === 'string') {
    jwe = await resolveJweString(jwe);
  }

  let result = jwe;

  let didCommRecipients = jwe?.recipients?.map(
    recipient => recipient.header.kid,
  );

  // if no recipients, the message is not encrypted
  if (didCommRecipients) {
    const keyPairDoc = keyPairDocs.find(doc =>
      didCommRecipients.find(did => did.indexOf(doc.controller) > -1),
    );

    assert(
      !!keyPairDoc,
      `keyPairDoc not found for recipients ${JSON.stringify(
        didCommRecipients,
      )}`,
    );
    const keyAgreementKey = await getDerivedAgreementKey(keyPairDoc);
    result = await didcommDecrypt(jwe, keyAgreementKey);
  }

  if (!result.body && result.payload) {
    result.body = result.payload;
  }

  return result;
}

async function signJwt({keyPairDocs, message}) {
  return await didcommCreateSignedJWT(message, keyPairDocs, true);
}

const setServiceURL = ({url}) => {
  assert(!!url, 'url is required');

  serviceURL = url;
};

export const RelayService = {
  sendMessage,
  getMessages,
  resolveDidcommMessage,
  registerDIDPushNotification,
  setServiceURL,
  ackMessages,
  serviceURL,
  signJwt,
};
