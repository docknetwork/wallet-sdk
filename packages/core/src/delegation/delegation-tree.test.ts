import {delegationPolicyTravelAgent} from './delegation-fixtures';
import {
  buildDelegationRoleTree,
  getRoleNodeById,
  getRemainingDelegationDepth,
} from './delegation-tree';

describe('Delegation tree', () => {
  it('builds a delegation tree from the delegation policy', () => {
    const delegationTree = buildDelegationRoleTree(delegationPolicyTravelAgent);

    expect(delegationTree).toMatchObject({
      label: 'Travel Agent 1',
      roleId: 'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
      level: 1,
      children: [
        {
          label: 'Corporate Account Manager',
          roleId: '8e5abc88-7006-42ae-ae48-9e34f8f66124',
          level: 2,
          children: [
            {
              label: 'Booking Specialist',
              roleId: '6375baa1-a52d-4838-9100-3facea02ba49',
              level: 3,
            },
            {
              label: 'Hotel Sub-agent',
              roleId: '16f68474-bf3b-4494-9fe5-f141a7d74a33',
              level: 3,
            },
            {
              label: 'Flight Sub-agent',
              roleId: 'c1bd8821-c645-4dd6-ab07-9bc087755db9',
              level: 3,
            },
          ],
        },
        {
          label: 'Car Rental Sub-agent',
          roleId: '9726317c-cb60-4ae7-a828-e334b10f6f52',
          level: 2,
          children: [
            {
              label: 'Flight Sub-agent',
              roleId: '888aeee9-c3ed-469b-86bd-910490c9aa20',
              level: 3,
            },
            {
              label: 'Booking Executor',
              roleId: 'd39f29c4-fc3e-4b5d-9eae-9f576576e4fb',
              level: 3,
            },
          ],
        },
      ],
    });
  });

  describe('getRoleNodeById', () => {
    it('returns level 1 for the root role', () => {
      const tree = buildDelegationRoleTree(delegationPolicyTravelAgent);
      const node = getRoleNodeById(
        'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
        tree,
      );
      expect(node?.level).toBe(1);
    });

    it('returns the level for nested roles', () => {
      const tree = buildDelegationRoleTree(delegationPolicyTravelAgent);
      expect(
        getRoleNodeById('8e5abc88-7006-42ae-ae48-9e34f8f66124', tree)?.level,
      ).toBe(2);
      expect(
        getRoleNodeById('6375baa1-a52d-4838-9100-3facea02ba49', tree)?.level,
      ).toBe(3);
    });

    it('returns null for unknown roleId', () => {
      const tree = buildDelegationRoleTree(delegationPolicyTravelAgent);
      expect(getRoleNodeById('does-not-exist', tree)).toBeNull();
    });
  });

  describe('getRemainingDelegationDepth', () => {
    it('subtracts the role level from maxDelegationDepth', () => {
      const tree = buildDelegationRoleTree(delegationPolicyTravelAgent);
      const max =
        delegationPolicyTravelAgent.ruleset.overallConstraints
          .maxDelegationDepth;

      const root = getRoleNodeById(
        'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
        tree,
      )!;
      expect(getRemainingDelegationDepth(root, delegationPolicyTravelAgent)).toBe(
        max - 1,
      );

      const leaf = getRoleNodeById(
        '6375baa1-a52d-4838-9100-3facea02ba49',
        tree,
      )!;
      expect(getRemainingDelegationDepth(leaf, delegationPolicyTravelAgent)).toBe(
        max - 3,
      );
    });
  });
});
