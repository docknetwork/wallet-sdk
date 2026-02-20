import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {
  closeWallet,
  getCredentialProvider,
  getWallet,
} from '../helpers/wallet-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import {ProofTemplateIds, createProofRequest} from '../helpers/certs-helpers';

const testAPIURL = process.env.TESTING_API_URL || null;
const testCredsURL = testAPIURL.replace('api-', 'creds-');

const credential = {
	"@context": [
		"https://www.w3.org/2018/credentials/v1",
		"https://ld.dock.io/security/bbdt16/v1",
		{
			"BasicCredential": "dk:BasicCredential",
			"address": "dk:address",
			"city": "dk:city",
			"dk": "https://ld.dock.io/credentials#",
			"name": "dk:name",
			"street": "dk:street",
			"zipCode": "dk:zipCode"
		}
	],
	"id": `${testCredsURL}/4d007f22b2677d542e18962cc88ba74c2e6e97482f57c9b205f99bf644aa9254`,
	"type": [
		"VerifiableCredential",
		"BasicCredential"
	],
	"credentialSubject": {
		"id": "did:key:z6MkoWAL66HUG7SHmJpwisjbUrjgaUZZnesNXp5m2CDmrFkT",
		"name": "Nested Attributes",
		"address": {
			"street": "Soem street name",
			"city": "City name",
			"zipCode": "12345"
		}
	},
	"issuanceDate": "2024-04-09T15:43:59.361Z",
	"issuer": {
		"name": "profile bbs+",
		"id": "did:dock:5GJeBeStWSxqyPGUJnERMFhm3wKcfCZP6nhqtoKyRAmq9FeU"
	},
	"credentialSchema": {
		"id": "https://schema.dock.io/BasicCredential-V2-1703777584571.json",
		"type": "JsonSchemaValidator2018",
		"details": "{\"jsonSchema\":{\"$id\":\"https://schema.dock.io/BasicCredential-V2-1703777584571.json\",\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"additionalProperties\":true,\"description\":\"A representation of a very basic example credential\",\"name\":\"Basic Credential\",\"properties\":{\"@context\":{\"type\":\"string\"},\"credentialSchema\":{\"properties\":{\"details\":{\"type\":\"string\"},\"id\":{\"type\":\"string\"},\"type\":{\"type\":\"string\"},\"version\":{\"type\":\"string\"}},\"type\":\"object\"},\"credentialSubject\":{\"properties\":{\"address\":{\"properties\":{\"city\":{\"type\":\"string\"},\"street\":{\"type\":\"string\"},\"zipCode\":{\"type\":\"string\"}},\"type\":\"object\"},\"id\":{\"description\":\"A unique identifier of the recipient. Example: DID, email address, national ID number, employee ID, student ID etc. If you enter the recipient's DID, the person will automatically receive the credential in their Dock wallet.\",\"title\":\"Subject ID\",\"type\":\"string\"},\"name\":{\"description\":\"The name of the credential holder.\",\"title\":\"Subject Name\",\"type\":\"string\"}},\"required\":[\"name\"],\"type\":\"object\"},\"cryptoVersion\":{\"type\":\"string\"},\"id\":{\"type\":\"string\"},\"issuanceDate\":{\"format\":\"date-time\",\"type\":\"string\"},\"issuer\":{\"properties\":{\"id\":{\"type\":\"string\"},\"name\":{\"type\":\"string\"}},\"type\":\"object\"},\"name\":{\"type\":\"string\"},\"proof\":{\"properties\":{\"@context\":{\"items\":[{\"properties\":{\"proof\":{\"properties\":{\"@container\":{\"type\":\"string\"},\"@id\":{\"type\":\"string\"},\"@type\":{\"type\":\"string\"}},\"type\":\"object\"},\"sec\":{\"type\":\"string\"}},\"type\":\"object\"},{\"type\":\"string\"}],\"type\":\"array\"},\"created\":{\"format\":\"date-time\",\"type\":\"string\"},\"proofPurpose\":{\"type\":\"string\"},\"type\":{\"type\":\"string\"},\"verificationMethod\":{\"type\":\"string\"}},\"type\":\"object\"},\"type\":{\"type\":\"string\"}},\"type\":\"object\"},\"parsingOptions\":{\"defaultDecimalPlaces\":4,\"defaultMinimumDate\":-17592186044415,\"defaultMinimumInteger\":-4294967295,\"useDefaults\":true}}",
		"version": "0.4.0"
	},
	"name": "Nested Attributes",
	"cryptoVersion": "0.6.0",
	"proof": {
		"@context": [
			{
				"sec": "https://w3id.org/security#",
				"proof": {
					"@id": "sec:proof",
					"@type": "@id",
					"@container": "@graph"
				}
			},
			"https://ld.dock.io/security/bbdt16/v1"
		],
		"type": "Bls12381BBDT16MACDock2024",
		"created": "2024-07-03T17:38:33Z",
		"verificationMethod": "did:dock:5GJeBeStWSxqyPGUJnERMFhm3wKcfCZP6nhqtoKyRAmq9FeU#73UFp7oRA5TcjuRLyAy7D2z7szZPjEZs1S8uVP8pvVJL9rm7xW2TBPcQShwLz813pT",
		"proofPurpose": "assertionMethod",
		"proofValue": "zYtFbq55ZsfiK7wLB8AKfdyBriaMCg5CDNgoeKbJphiCGnE3JHG5PNZJV2scJAnaAT1StakGswamqoLAVjfTDTyz78KSqVmRNB4JuPDGFi4umBRc4wCFQvQjGwgzm812bqmtzkJWijrvFVaiFnoKDNRUZU"
	}
}

describe('VPI verification', () => {
  it('should verify a vpi credential', async () => {
    const wallet: IWallet = await getWallet();

    try {
      await getCredentialProvider().addCredential(credential);
    } catch(err) {
      console.error('Credential already added');
    }

    const proofRequest = await createProofRequest(
      ProofTemplateIds.ANY_CREDENTIAL,
    );

    const result: any = await getCredentialProvider().isValid(credential);

    expect(result.status).toBe('verified');

    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest,
    });

    let attributesToReveal = ['credentialSubject.name'];

    controller.selectedCredentials.set(credential.id, {
      credential: credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();
    console.log('Presentation generated');
    console.log(JSON.stringify(presentation, null, 2));
    console.log('Sending presentation to Certs API');

    let certsResponse;
    try {
      certsResponse = await controller.submitPresentation(presentation);
      console.log('CERTS response');
      console.log(JSON.stringify(certsResponse, null, 2));
    } catch (err) {
      certsResponse = err.response.data;
      console.log('Certs API returned an error');
      console.log(JSON.stringify(certsResponse, null, 2));
    }

	// TODO: Will need to update the verification template and credentials to be issued under the same ecosystem
	// https://dock-team.atlassian.net/browse/DCKM-543
    // expect(certsResponse.verified).toBe(true);
  });

  afterAll(() => closeWallet());
});
