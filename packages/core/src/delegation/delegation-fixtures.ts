import {DelegationPolicy} from './delegation-types';

export const delegationPolicyPharmacy = {
  id: 'urn:uuid:65763e5c-8b8c-4db6-916c-e367b71644b0',
  type: 'DelegationPolicy',
  ruleset: {
    roles: [
      {
        label: 'Prescribing Doctor',
        roleId: '6ed167b3-90be-4f9a-a8d2-542d2f212d79',
        attributes: ['*'],
        parentRoleId: null,
        capabilityGrants: [
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pick Up',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pay',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Cancel',
          },
          {
            schema: {
              type: 'array',
              items: {
                enum: ['Pay', 'Cancel', 'PickUp'],
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Claims',
          },
        ],
      },
      {
        label: 'Pharmacy',
        roleId: '053077d1-6e60-44a4-8c69-dad68eeca36e',
        attributes: ['*'],
        parentRoleId: '6ed167b3-90be-4f9a-a8d2-542d2f212d79',
        capabilityGrants: [
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pick Up',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pay',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Cancel',
          },
          {
            schema: {
              type: 'array',
              items: {
                enum: ['PickUp', 'Pay', 'Cancel'],
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Claims',
          },
        ],
      },
      {
        label: 'Patient',
        roleId: '560195e9-922d-4002-b851-95b730577421',
        attributes: ['*'],
        parentRoleId: '053077d1-6e60-44a4-8c69-dad68eeca36e',
        capabilityGrants: [
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pick Up',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pay',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Cancel',
          },
          {
            schema: {
              type: 'array',
              items: {
                enum: ['PickUp', 'Pay', 'Cancel'],
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Claims',
          },
        ],
      },
      {
        label: 'Guardian',
        roleId: '781aa007-ff3e-463a-82ac-b177359ea02c',
        attributes: ['*'],
        parentRoleId: '560195e9-922d-4002-b851-95b730577421',
        capabilityGrants: [
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pick Up',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Pay',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Can Cancel',
          },
        ],
      },
    ],
    capabilities: [
      {
        name: 'Can Pick Up',
        schema: {
          type: 'boolean',
          const: true,
        },
      },
      {
        name: 'Can Pay',
        schema: {
          type: 'boolean',
          const: true,
        },
      },
      {
        name: 'Can Cancel',
        schema: {
          type: 'boolean',
          const: true,
        },
      },
      {
        name: 'Allowed Claims',
        schema: {
          type: 'array',
          items: {
            enum: ['PickUp', 'Pay', 'Cancel'],
            type: 'string',
          },
          minItems: 1,
          uniqueItems: true,
        },
      },
    ],
    delegationTarget: 'single-credential',
    overallConstraints: {
      maxDelegationDepth: 4,
      delegatedCredentialLifetime: {
        unit: 'years',
        value: 1,
      },
    },
  },
  createdAt: '2026-04-29',
  name: 'Prescription',
};

export const delegationPolicyTravelAgent = {
  id: 'urn:uuid:0850f80d-7af5-4fda-8fda-a85ef5c8672d',
  type: 'DelegationPolicy',
  ruleset: {
    roles: [
      {
        label: 'Travel Agent 1',
        roleId: 'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
        attributes: ['*'],
        parentRoleId: null,
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 100,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Flights',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Hotels',
          },
        ],
      },
      {
        label: 'Corporate Account Manager',
        roleId: '8e5abc88-7006-42ae-ae48-9e34f8f66124',
        attributes: ['*'],
        parentRoleId: 'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 100,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Flights',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Hotels',
          },
        ],
      },
      {
        label: 'Booking Specialist',
        roleId: '6375baa1-a52d-4838-9100-3facea02ba49',
        attributes: ['*'],
        parentRoleId: '8e5abc88-7006-42ae-ae48-9e34f8f66124',
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 100,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Flights',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Hotels',
          },
        ],
      },
      {
        label: 'Hotel Sub-agent',
        roleId: '16f68474-bf3b-4494-9fe5-f141a7d74a33',
        attributes: ['*'],
        parentRoleId: '8e5abc88-7006-42ae-ae48-9e34f8f66124',
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 50,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Hotels',
          },
        ],
      },
      {
        label: 'Flight Sub-agent',
        roleId: 'c1bd8821-c645-4dd6-ab07-9bc087755db9',
        attributes: ['*'],
        parentRoleId: '8e5abc88-7006-42ae-ae48-9e34f8f66124',
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 50,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Flights',
          },
        ],
      },
      {
        label: 'Car Rental Sub-agent',
        roleId: '9726317c-cb60-4ae7-a828-e334b10f6f52',
        attributes: ['*'],
        parentRoleId: 'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 100,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Flights',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Hotels',
          },
        ],
      },
      {
        label: 'Flight Sub-agent',
        roleId: '888aeee9-c3ed-469b-86bd-910490c9aa20',
        attributes: ['*'],
        parentRoleId: '9726317c-cb60-4ae7-a828-e334b10f6f52',
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 50,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Flights',
          },
        ],
      },
      {
        label: 'Booking Executor',
        roleId: 'd39f29c4-fc3e-4b5d-9eae-9f576576e4fb',
        attributes: ['*'],
        parentRoleId: '9726317c-cb60-4ae7-a828-e334b10f6f52',
        capabilityGrants: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
              uniqueItems: true,
            },
            capability: 'Allowed Routes',
          },
          {
            schema: {
              type: 'integer',
              maximum: 50,
            },
            capability: 'Purchase',
          },
          {
            schema: {
              type: 'boolean',
              const: true,
            },
            capability: 'Reserve Hotels',
          },
        ],
      },
    ],
    capabilities: [
      {
        name: 'Allowed Routes',
        schema: {
          type: 'array',
          items: {
            type: 'string',
          },
          minItems: 1,
          uniqueItems: true,
        },
      },
      {
        name: 'Purchase',
        schema: {
          type: 'integer',
          maximum: 100,
        },
      },
      {
        name: 'Reserve Flights',
        schema: {
          type: 'boolean',
          const: true,
        },
      },
      {
        name: 'Reserve Hotels',
        schema: {
          type: 'boolean',
          const: true,
        },
      },
    ],
    delegationTarget: 'single-credential',
    overallConstraints: {
      maxDelegationDepth: 4,
      delegatedCredentialLifetime: {
        unit: 'years',
        value: 1,
      },
    },
  },
  createdAt: '2026-04-29',
  name: 'Travel Agent',
} as DelegationPolicy;
