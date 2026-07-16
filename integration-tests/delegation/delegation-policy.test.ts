import {fetchDelegationPolicyJson} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-policy';
import {issueCredential} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-issuance';
import {didService} from '@docknetwork/wallet-sdk-wasm/src/services/dids/service';

import {TRAVEL_AGENCY_CONTEXT, travelAgencyPolicy} from './delegation-fixtures';

describe('Delegatable policy', () => {
  it('should issue a root credential and resolve delegation policy', async () => {
    // Generate key pairs for root issuer and delegate
    const issuerKey = await didService.generateKeyDoc({
      type: 'ed25519',
    });

    const delegationRoleId = 'e79c0d16-8739-4e54-94d7-53d9f1c97c71';
    const credentialData = {
      '@context': TRAVEL_AGENCY_CONTEXT,
      type: [
        'VerifiableCredential',
        'TravelAgencyCredential',
        'DelegationCredential',
      ],
      issuer: {
        id: 'did:test:root-issuer',
        name: 'Travel Agency',
      },
      credentialSubject: {
        id: 'did:test:travel-agency',
        allowedRoutes: ['US-NYC-LAX', 'US-SFO-SEA', 'US-ORD-MIA'],
        purchaseLimit: 10000,
        reserveFlights: true,
        reserveHotels: true,
      },
      issuanceDate: new Date().toISOString(),
    };
    const rootCredential = await issueCredential(
      credentialData,
      issuerKey,
      travelAgencyPolicy,
      delegationRoleId,
    );

    expect(rootCredential.delegationPolicyId).toBeDefined();

    const delegationPolicy = await fetchDelegationPolicyJson(rootCredential);

    expect(delegationPolicy).toStrictEqual(travelAgencyPolicy);
  });
});
