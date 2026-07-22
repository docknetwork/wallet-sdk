import {delegationPolicyTravelAgent} from './delegation-fixtures';
import {createOOBInvitation, decodeMessage} from './delegation-offer';

const CORPORATE_ACCOUNT_MANAGER = '8e5abc88-7006-42ae-ae48-9e34f8f66124';

function getPreview(offer) {
  const url = createOOBInvitation('did:issuer', offer, {goal: 'delegate'});
  return decodeMessage(url).attachments[0].data.json;
}

describe('createOOBInvitation roleLabel', () => {
  const baseOffer = {
    id: 'offer-1',
    issuerName: 'Issuer',
    delegationPolicy: delegationPolicyTravelAgent,
    delegationRole: CORPORATE_ACCOUNT_MANAGER,
    sentAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-02T00:00:00.000Z',
  };

  it('resolves roleLabel from the policy role', () => {
    const preview = getPreview(baseOffer);
    expect(preview.role).toBe(CORPORATE_ACCOUNT_MANAGER);
    expect(preview.roleLabel).toBe('Corporate Account Manager');
  });

  it('leaves roleLabel undefined when the role is not in the policy', () => {
    const preview = getPreview({...baseOffer, delegationRole: 'unknown-role-id'});
    expect(preview.roleLabel).toBeUndefined();
  });
});
