# Ecosystem Tools

An ecosystem is a trusted set of issuers and verifiers. If a credential is associated with an ecosystem, then the credential details will include the ecosystem logo and a link to the ecosystem web page. This allows credential holders to become familiar with the branding of an ecosystem which they can then use to identify verifiers who will trust the ecosystem credentials and abide by the ecosystem's policies.

The functions of an ecosystem are further described in [the Ecosystem Tools section of the API documentation](https://docs.truvera.io/truvera-api/ecosystem-tools).

The Truvera Wallet SDK implementation of ecosystem tools is in:
[packages/core/src/ecosystem-tools.ts](https://github.com/docknetwork/wallet-sdk/blob/5dfbcb197b848802478d2f7a697286a8c3c28823/packages/core/src/ecosystem-tools.ts#L4)

## Usage example

Below is an example demonstrating how to use getEcosystems to retrieve ecosystem information based on an issuer's DID.

Importing the Function First, ensure you import getEcosystems from the SDK:

```js
import {getEcosystems} from '@docknetwork/wallet-sdk-core/src/ecosystem-tools';
Fetching Ecosystem Details
To fetch the details of ecosystems associated with a specific issuerDID, you can use the following code snippet:

javascript
Copy code
async function fetchEcosystemDetails() {
    const result = await getEcosystems({
        issuerDID: 'did:dock:5HLbQLSmirNuZVRsdWKbsgdajw9QTGzSFJABSVzMT5EBj5sb',
    });

    console.log(result);
}
fetchEcosystemDetails();
```

## Expected output

When you run the above code, you should expect output similar to this:

```json
{
    "0xc5671b2d1552db9b47a3501109ddbeb861a55fe3f7a0cb7a26791203abe9fcc8": {
        "name": "clarity partners",
        "convener": "did:dock:5GKaHgDoSzHpfR6aiXGu5F1oUYgXk8tHXMSNbZE2jdm9FAnT",
        "govFramework": "0x68747470733a2f2f6170692d746573746e65742e646f636b2e696f2f74727573742d726567697374726965732f3078633536373162326431353532646239623437613335303131303964646265623836316135356665336637613063623761323637393132303361626539666363382f7075626c6963"
    }
}
```

This JSON output contains the details of the ecosystems associated with the given issuerDID.

## Integration tests

For more examples and usage, please refer to the integration test at:
https://github.com/docknetwork/wallet-sdk/blob/master/integration-tests/ecosystem-tools.test.ts

This test file provides comprehensive examples on how to interact with ecosystem tools effectively.
