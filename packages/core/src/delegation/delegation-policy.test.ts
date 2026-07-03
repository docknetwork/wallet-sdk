import {delegationPolicyTravelAgent} from './delegation-fixtures';
import {buildDelegationRoleTree, getRoleNodeById} from './delegation-tree';
import {getDelegationOptions} from './delegation-policy';

const CORPORATE_ACCOUNT_MANAGER = '8e5abc88-7006-42ae-ae48-9e34f8f66124';
const BOOKING_SPECIALIST = '6375baa1-a52d-4838-9100-3facea02ba49';

describe('getDelegationOptions', () => {
  const tree = buildDelegationRoleTree(delegationPolicyTravelAgent);

  it('returns only the holder subtree, not the whole tree', () => {
    const holder = getRoleNodeById(CORPORATE_ACCOUNT_MANAGER, tree)!;
    const ids = getDelegationOptions(holder).map(r => r.roleId);

    expect(ids).toEqual([
      BOOKING_SPECIALIST,
      '16f68474-bf3b-4494-9fe5-f141a7d74a33',
      'c1bd8821-c645-4dd6-ab07-9bc087755db9',
    ]);
    expect(ids).not.toContain('9726317c-cb60-4ae7-a828-e334b10f6f52');
    expect(ids).not.toContain(CORPORATE_ACCOUNT_MANAGER);
  });

  it('returns an empty list for a leaf holder', () => {
    const leaf = getRoleNodeById(BOOKING_SPECIALIST, tree)!;
    expect(getDelegationOptions(leaf)).toEqual([]);
  });
});
