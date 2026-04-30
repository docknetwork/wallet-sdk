import {delegationPolicyTravelAgent} from './delegation-fixtures';
import {buildDelegationRoleTree} from './delegation-policy';

describe('Delegation policy', () => {
  it('build a delegation tree from the delegation policy', () => {
    const delegationTree = buildDelegationRoleTree(delegationPolicyTravelAgent);

    expect(delegationTree).toEqual({
      name: 'Travel Agent 1',
      level: 1,
      children: [
        {
          name: 'Corporate Account Manager',
          level: 2,
          children: [
            {
              name: 'Booking Specialist',
              level: 3,
            },
            {
              name: 'Hotel Sub-agent',
              level: 3,
            },
            {
              name: 'Flight Sub-agent',
              level: 3,
            },
          ],
        },
        {
          name: 'Car Rental Sub-agent',
          level: 2,
          children: [
            {
              name: 'Flight Sub-agent',
              level: 3,
            },
            {
              name: 'Booking Executor',
              level: 3,
            },
          ],
        },
      ],
    });
  });
});
