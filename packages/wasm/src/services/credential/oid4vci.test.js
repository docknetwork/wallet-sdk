import {resolveOfferedCredentialConfig, resolveFormatAndType} from './oid4vci';

function makeClient({supported, offerIds}) {
  return {
    getCredentialsSupported: () => supported,
    credentialOffer: offerIds
      ? {credential_offer: {credential_configuration_ids: offerIds}}
      : undefined,
  };
}

describe('OID4VCI offer resolution', () => {
  describe('resolveOfferedCredentialConfig', () => {
    it('returns the entry matching the offered configuration id', () => {
      const supported = {
        'ldp_vc:MyCredential': {format: 'vc+sd-jwt', vct: 'MyCredential'},
        'ldp_vc:OtherCredential': {format: 'ldp_vc'},
      };
      const client = makeClient({
        supported,
        offerIds: ['ldp_vc:MyCredential'],
      });

      expect(resolveOfferedCredentialConfig(client)).toBe(
        supported['ldp_vc:MyCredential'],
      );
    });

    it('falls back to the first record entry when the offer id does not match', () => {
      const supported = {
        'ldp_vc:A': {format: 'ldp_vc'},
        'ldp_vc:B': {format: 'vc+sd-jwt'},
      };
      const client = makeClient({supported, offerIds: ['nonexistent']});

      expect(resolveOfferedCredentialConfig(client)).toBe(
        supported['ldp_vc:A'],
      );
    });

    it('handles array-shaped credentialsSupported by returning the first entry', () => {
      const supported = [
        {format: 'vc+sd-jwt', vct: 'MyCredential'},
        {format: 'ldp_vc'},
      ];
      const client = makeClient({supported, offerIds: []});

      expect(resolveOfferedCredentialConfig(client)).toBe(supported[0]);
    });

    it('matches an array-shaped entry by id when the offer provides one', () => {
      const supported = [
        {id: 'ldp_vc:A', format: 'ldp_vc'},
        {id: 'sdjwt:B', format: 'vc+sd-jwt', vct: 'B'},
      ];
      const client = makeClient({supported, offerIds: ['sdjwt:B']});

      expect(resolveOfferedCredentialConfig(client)).toBe(supported[1]);
    });

    it('falls back to the first array entry when no offered id matches', () => {
      const supported = [
        {id: 'ldp_vc:A', format: 'ldp_vc'},
        {id: 'sdjwt:B', format: 'vc+sd-jwt'},
      ];
      const client = makeClient({supported, offerIds: ['nonexistent']});

      expect(resolveOfferedCredentialConfig(client)).toBe(supported[0]);
    });

    it('reads offer ids from credentialOffer.credential_configuration_ids when not nested', () => {
      const supported = {
        'ldp_vc:Wanted': {format: 'vc+sd-jwt', vct: 'Wanted'},
        'ldp_vc:Other': {format: 'ldp_vc'},
      };
      const client = {
        getCredentialsSupported: () => supported,
        credentialOffer: {credential_configuration_ids: ['ldp_vc:Wanted']},
      };

      expect(resolveOfferedCredentialConfig(client)).toBe(
        supported['ldp_vc:Wanted'],
      );
    });
  });

  describe('resolveFormatAndType', () => {
    it('returns vct as credentialTypes for vc+sd-jwt', () => {
      const result = resolveFormatAndType({
        format: 'vc+sd-jwt',
        vct: 'MyCredential',
        scope: 'ldp_vc:MyCredential',
      });

      expect(result).toEqual({
        format: 'vc+sd-jwt',
        credentialTypes: 'MyCredential',
      });
    });

    it('returns the last credential_definition.type entry for ldp_vc', () => {
      const result = resolveFormatAndType({
        format: 'ldp_vc',
        credential_definition: {
          type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        },
      });

      expect(result).toEqual({
        format: 'ldp_vc',
        credentialTypes: 'UniversityDegreeCredential',
      });
    });

    it('falls back to the scope suffix when credential_definition is missing', () => {
      const result = resolveFormatAndType({
        format: 'ldp_vc',
        scope: 'ldp_vc:LegacyCredential',
      });

      expect(result).toEqual({
        format: 'ldp_vc',
        credentialTypes: 'LegacyCredential',
      });
    });

    it('returns undefined credentialTypes when nothing identifies the type', () => {
      const result = resolveFormatAndType({format: 'jwt_vc_json'});

      expect(result).toEqual({
        format: 'jwt_vc_json',
        credentialTypes: undefined,
      });
    });

    it('derives format from a known scope prefix when format is missing', () => {
      const result = resolveFormatAndType({
        scope: 'vc+sd-jwt:MyCredential',
        vct: 'MyCredential',
      });

      expect(result).toEqual({
        format: 'vc+sd-jwt',
        credentialTypes: 'MyCredential',
      });
    });

    it('defaults to ldp_vc when format and a recognizable scope prefix are missing', () => {
      const result = resolveFormatAndType({
        scope: 'MyCredential',
        credential_definition: {
          type: ['VerifiableCredential', 'MyCredential'],
        },
      });

      expect(result).toEqual({
        format: 'ldp_vc',
        credentialTypes: 'MyCredential',
      });
    });
  });
});
