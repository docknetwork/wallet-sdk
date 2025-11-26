// @ts-nocheck
import {
  serviceName,
  validation,
  EvaluatePresentationParams,
  FilterCredentialsParams,
  CreatePresentationParams,
} from './config';
import {IPresentationDefinition, PEX} from '@sphereon/pex';

const pex: PEX = new PEX();

/**
 * @sphereon/pex is not able to handle optional attributes in the presentation definition
 * https://github.com/Sphereon-Opensource/PEX/issues/150
 * Any optional attribute in the presentation definition will cause the library to throw an error
 * This function removes the optional attribute from the presentation definition
 * This is a temporary workaround until the issue is fixed in the @sphereon/pex library
 **/
export function removeOptionalAttribute(presentationDefinition) {
  // Deep clone the presentationDefinition to avoid mutating the original
  const clonedPresentationDefinition = JSON.parse(
    JSON.stringify(presentationDefinition),
  );

  clonedPresentationDefinition.input_descriptors.forEach(inputDescriptor => {
    if (!inputDescriptor.constraints?.fields?.length) {
      return;
    }

    // Filter the optional fields
    inputDescriptor.constraints.fields =
      inputDescriptor.constraints.fields.filter(
        field => field.optional !== true,
      );

    inputDescriptor.constraints.fields = inputDescriptor.constraints.fields.map(
      field => {
        const updatedField = {...field};

        // Remove the optional attribute if it exists
        if (updatedField.optional !== undefined) {
          delete updatedField.optional;
        }

        // Remove the did format attribute if it exists
        if (updatedField.filter?.format === 'did') {
          delete updatedField.filter.format;
        }

        return updatedField;
      },
    );

    // Handle case where all fields are optional
    if (inputDescriptor.constraints.fields.length === 0) {
      inputDescriptor.constraints.fields.push({
        path: ['$.id'],
      });
    }
  });

  if (!clonedPresentationDefinition.id) {
    clonedPresentationDefinition.id = 'id';
  }

  return clonedPresentationDefinition;
}

class PEXService {
  name: string;

  constructor() {
    this.name = serviceName;
  }

  rpcMethods = [
    PEXService.prototype.filterCredentials,
    PEXService.prototype.evaluatePresentation,
    PEXService.prototype.presentationFrom,
    PEXService.prototype.isCredentialSelectionValid,
  ];

  filterCredentials(params: FilterCredentialsParams) {
    validation.filterCredentials(params);
    const {credentials, presentationDefinition, holderDIDs} = params;
    const result = pex.selectFrom(
      removeOptionalAttribute(presentationDefinition),
      credentials,
      holderDIDs,
    );

    return result;
  }

  isCredentialSelectionValid(params: EvaluateCredentialsParams) {
    validation.evaluateCredentials(params);
    const {credentials, presentationDefinition, holderDIDs} = params;
    const result = pex.selectFrom(
      removeOptionalAttribute(presentationDefinition),
      credentials,
      holderDIDs,
    );

    return result.errors.length === 0;
  }

  evaluatePresentation(params: EvaluatePresentationParams) {
    validation.evaluatePresentation(params);
    const {presentation, presentationDefinition} = params;
    const result = pex.evaluatePresentation(
      removeOptionalAttribute(presentationDefinition),
      presentation,
    );

    return result;
  }

  presentationFrom(params: CreatePresentationParams) {
    const {credentials, presentationDefinition, holderDID} = params;
    const evaluateResult = pex.evaluateCredentials(
      removeOptionalAttribute(presentationDefinition),
      credentials,
      holderDID,
    );

    const result: IPresentation = pex.presentationFrom(
      presentationDefinition,
      evaluateResult.verifiableCredential,
      holderDID,
    );

    return result;
  }
}

export const pexService = new PEXService();
