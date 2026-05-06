import {delegationPolicyTravelAgent} from './delegation-fixtures';
import {
  buildDelegationRoleTree,
  getRoleDepth,
  getRemainingDelegationDepth,
} from './delegation-tree';

describe('Delegation tree', () => {
  it('build a delegation tree from the delegation policy', () => {
    const delegationTree = buildDelegationRoleTree(delegationPolicyTravelAgent);

    expect(delegationTree).toEqual({
      name: 'Travel Agent 1',
      roleId: 'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
      level: 1,
      children: [
        {
          name: 'Corporate Account Manager',
          roleId: '8e5abc88-7006-42ae-ae48-9e34f8f66124',
          level: 2,
          children: [
            {
              name: 'Booking Specialist',
              roleId: '6375baa1-a52d-4838-9100-3facea02ba49',
              level: 3,
            },
            {
              name: 'Hotel Sub-agent',
              roleId: '16f68474-bf3b-4494-9fe5-f141a7d74a33',
              level: 3,
            },
            {
              name: 'Flight Sub-agent',
              roleId: 'c1bd8821-c645-4dd6-ab07-9bc087755db9',
              level: 3,
            },
          ],
        },
        {
          name: 'Car Rental Sub-agent',
          roleId: '9726317c-cb60-4ae7-a828-e334b10f6f52',
          level: 2,
          children: [
            {
              name: 'Flight Sub-agent',
              roleId: '888aeee9-c3ed-469b-86bd-910490c9aa20',
              level: 3,
            },
            {
              name: 'Booking Executor',
              roleId: 'd39f29c4-fc3e-4b5d-9eae-9f576576e4fb',
              level: 3,
            },
          ],
        },
      ],
    });
  });

  describe('getRoleDepth', () => {
    it('returns 1 for the root role', () => {
      expect(
        getRoleDepth(
          delegationPolicyTravelAgent,
          'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
        ),
      ).toBe(1);
    });

    it('returns the depth for a nested role', () => {
      expect(
        getRoleDepth(
          delegationPolicyTravelAgent,
          '8e5abc88-7006-42ae-ae48-9e34f8f66124',
        ),
      ).toBe(2);
      expect(
        getRoleDepth(
          delegationPolicyTravelAgent,
          '6375baa1-a52d-4838-9100-3facea02ba49',
        ),
      ).toBe(3);
    });

    it('returns null for unknown roleId', () => {
      expect(
        getRoleDepth(delegationPolicyTravelAgent, 'does-not-exist'),
      ).toBeNull();
    });
  });

  describe('getRemainingDelegationDepth', () => {
    it('subtracts the role depth from maxDelegationDepth', () => {
      const max =
        delegationPolicyTravelAgent.ruleset.overallConstraints
          .maxDelegationDepth;
      expect(
        getRemainingDelegationDepth(
          delegationPolicyTravelAgent,
          'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
        ),
      ).toBe(max - 1);
      expect(
        getRemainingDelegationDepth(
          delegationPolicyTravelAgent,
          '6375baa1-a52d-4838-9100-3facea02ba49',
        ),
      ).toBe(max - 3);
    });

    it('returns null for unknown roleId', () => {
      expect(
        getRemainingDelegationDepth(
          delegationPolicyTravelAgent,
          'does-not-exist',
        ),
      ).toBeNull();
    });
  });
});
