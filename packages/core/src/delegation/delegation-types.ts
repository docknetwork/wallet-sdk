import {Credential} from '../credential-provider';

export type JsonSchema = Record<string, unknown>;

export type CapabilityGrant = {
  capability: string;
  schema: JsonSchema;
};

export type Capability = {
  name: string;
  schema: JsonSchema;
};

export type Role = {
  label: string;
  roleId: string;
  attributes: string[];
  parentRoleId: string | null;
  capabilityGrants: CapabilityGrant[];
};

export type DelegatedCredentialLifetime = {
  unit: string;
  value: number;
};

export type OverallConstraints = {
  maxDelegationDepth: number;
  delegatedCredentialLifetime: DelegatedCredentialLifetime;
};

export type Ruleset = {
  roles: Role[];
  capabilities: Capability[];
  delegationTarget: string;
  overallConstraints: OverallConstraints;
};

export type DelegationPolicy = {
  id: string;
  type: 'DelegationPolicy';
  ruleset: Ruleset;
  createdAt: string;
  name?: string;
};

export type RoleNode = Role & {
  level: number;
  children?: RoleNode[];
};

export type DelegationDetails = {
  delegationPolicy: DelegationPolicy | null;
  delegationChain: Credential[];
  delegatedBy: {
    role: Role | null;
    issuerName: string;
    issuerDid: string;
  };
  role: RoleNode | null;
  roleTree: RoleNode | null;
  remainingDelegationDepth: number | null;
  delegationOptions: RoleNode[];
};
