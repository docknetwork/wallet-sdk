import {JSONPath} from '@astronautlabs/jsonpath';

export const EPSILON_NUMBER = 0.001;
export const EPSILON_INT = 1;

export const MAX_DATE_PLACEHOLDER = 884541351600000;
export const MIN_DATE_PLACEHOLDER = -17592186044415;
export const MAX_INTEGER = Number.MAX_SAFE_INTEGER;
export const MIN_INTEGER = Number.MIN_SAFE_INTEGER;
export const MAX_NUMBER = 100 ** 5;
export const MIN_NUMBER = -(100 ** 5);

/*
  PEX Filter rules:
    greater-than - Use the exclusiveMinimum descriptor
    less-than - Use the exclusiveMaximum descriptor
    greater-than or equal-to - Use the minimum descriptor
    less-than or equal-to - Use the maximum descriptor
*/

function correctFieldPath(path) {
  // NOTE: may not work for advanced jsonpath selectors, needs investigation
  return path.replace('$.', '');
}

function getNumDecimalPlaces(n) {
  const parts = n.toString().split('.');
  return parts.length > 1 && parts[1].length;
}

function toMaxDecimalPlaces(n, maxDecimalPlaces) {
  return +n.toFixed(maxDecimalPlaces);
}

function getAttributeName({field, selectedCredentials, index}) {
  let attributeName;
  if (Array.isArray(field.path) && field.path.length > 1) {
    const selectedCredential = selectedCredentials[index];
    if (!selectedCredential) {
      throw new Error(`Expected selected credential at index ${index}`);
    }

    // Must find a path that matches in selectedcredential, and choose that for bounds
    const pathCount = field.path.length;
    for (let i = 0; i < pathCount; i++) {
      const path = field.path[i];
      const paths = JSONPath.paths(selectedCredential, path);
      if (paths.length) {
        // First come first served
        attributeName = correctFieldPath(JSONPath.stringify(paths[0]));
        break;
      }
    }
  } else {
    attributeName = correctFieldPath(
      Array.isArray(field.path) ? field.path[0] : field.path,
    );
  }

  return attributeName;
}

/**
 * Convert PEX request to bounds for each descriptor
 * @param {*} pexRequest - The PEX request object containing input descriptors and constraints
 * @param {*} selectedCredentials  - Array of selected credentials corresponding to the input descriptors
 * @param {*} removeFromRequest - if true, removes range proofs fields from the request. it might be dangerous if you will be using the proof request later
 *  because it will not have the range proofs fields anymore.
 * @returns {Array} - Array of bounds for each descriptor, where each bound is an object with attributeName, min, and max
 * @throws {Error} - If a field path is missing or empty
 * @throws {Error} - If an unsupported format or type is encountered
 * @throws {Error} - If a selected credential is expected but not found at the given index
 */
export function pexToBounds(
  pexRequest,
  selectedCredentials = [],
  removeFromRequest = false,
) {
  const descriptorBounds = [];
  const fieldsToRemove = [];

  // One list of bounds per descriptor/credential
  pexRequest.input_descriptors.forEach((inputDescriptor, index) => {
    const selectedCredential = selectedCredentials[index];
    if (!selectedCredential) {
      return;
    }

    // Get embedded schema if existing
    let decodedSchema = {};
    if (selectedCredential.credentialSchema) {
      const schemaStartStr = 'data:application/json;charset=utf-8,';

      if (selectedCredential.credentialSchema.details) {
        decodedSchema =
          JSON.parse(selectedCredential.credentialSchema.details).jsonSchema ||
          {};
      } else if (
        selectedCredential.credentialSchema.id &&
        selectedCredential.credentialSchema.id.startsWith(schemaStartStr)
      ) {
        // LEGACY embedded schema handling
        decodedSchema = JSON.parse(
          decodeURIComponent(
            selectedCredential.credentialSchema.id.split(schemaStartStr)[1],
          ),
        );
      }
    }

    const bounds = [];
    inputDescriptor.constraints.fields.forEach(field => {
      const {
        exclusiveMaximum,
        exclusiveMinimum,
        formatMaximum,
        formatMinimum,
        maximum,
        minimum,
        format,
        type,
      } = field.filter || {};

      if (!field.path || field.path.length === 0) {
        throw new Error(
          'Missing or empty field "path" property, expected array or string',
        );
      }

      let attributeName;
      if (Array.isArray(field.path) && field.path.length > 1) {
        // Must find a path that matches in selectedcredential, and choose that for bounds
        const pathCount = field.path.length;
        for (let i = 0; i < pathCount; i++) {
          const path = field.path[i];
          const paths = JSONPath.paths(selectedCredential, path);
          if (paths.length) {
            // First come first served
            attributeName = correctFieldPath(JSONPath.stringify(paths[0]));
            break;
          }
        }
      } else {
        const path = Array.isArray(field.path) ? field.path[0] : field.path;
        attributeName = correctFieldPath(path);
      }

      if (!attributeName) {
        return;
      }

      const schemaPath = `$.properties.${attributeName.replaceAll(
        '.',
        '.properties.',
      )}`;
      const attributeSchema = JSONPath.query(
        decodedSchema,
        schemaPath,
        1,
      )[0] || {type};

      let max =
        maximum === undefined
          ? formatMaximum === undefined
            ? exclusiveMaximum
            : formatMaximum
          : maximum;

      let min =
        minimum === undefined
          ? formatMinimum === undefined
            ? exclusiveMinimum
            : formatMinimum
          : minimum;

      const proofRequestMax = max;
      const proofRequestMin = min;

      if (max === undefined && min === undefined) {
        return;
      }

      const attributeType = attributeSchema.type || type;

      // Get min/max bounds values, if using exclusive we must apply an epsilon so equality isnt true
      if (format === 'date-time' || format === 'date') {
        max = new Date(max === undefined ? MAX_DATE_PLACEHOLDER : max);
        min = new Date(min === undefined ? MIN_DATE_PLACEHOLDER : min);
      } else if (attributeType === 'number') {
        const epsilon = attributeSchema.multipleOf || EPSILON_NUMBER;
        const attribDecimalPlaces = getNumDecimalPlaces(epsilon);

        max =
          max === undefined
            ? attributeSchema.maximum === undefined
              ? MAX_NUMBER
              : attributeSchema.maximum
            : exclusiveMaximum === undefined
            ? max
            : max - epsilon;
        min =
          min === undefined
            ? attributeSchema.minimum === undefined
              ? MIN_NUMBER
              : attributeSchema.minimum
            : exclusiveMinimum === undefined
            ? min
            : min + epsilon;

        // Because of floating point math sucks, sometimes we can get extra decimal points
        // the bounds must also match the same decimal points as the input
        // for this we read from the embedded schema
        min = toMaxDecimalPlaces(min, attribDecimalPlaces);
        max = toMaxDecimalPlaces(max, attribDecimalPlaces);
      } else if (attributeType === 'integer') {
        max =
          max === undefined
            ? attributeSchema.maximum === undefined
              ? MAX_INTEGER
              : attributeSchema.maximum
            : exclusiveMaximum === undefined
            ? max
            : max - EPSILON_INT;
        min =
          min === undefined
            ? attributeSchema.minimum === undefined
              ? MIN_INTEGER
              : attributeSchema.minimum
            : exclusiveMinimum === undefined
            ? min
            : min + EPSILON_INT;

        // Ensure that input values are not decimals otherwise crypto-wasm-ts will complain
        min = Math.floor(min);
        max = Math.floor(max);
      } else {
        throw new Error(
          `Unsupported format ${format} and type ${type} for enforce bounds`,
        );
      }

      if (removeFromRequest) {
        fieldsToRemove.push({
          fields: inputDescriptor.constraints.fields,
          field,
        });
      }

      bounds.push({
        attributeName,
        min,
        max,
        proofRequestMax,
        proofRequestMin,
        format,
        type,
      });
    });

    descriptorBounds.push(bounds);
  });

  fieldsToRemove.forEach(({fields, field}) => {
    const idx = fields.indexOf(field);
    if (idx !== -1) {
      fields.splice(idx, 1);
    }
  });

  return descriptorBounds;
}

const attributesToSkip = [
  /^type/,
  /^issuer/,
  /^@context/,
  /^proof/,
  /^credentialSchema/,
  /^issuanceDate/,
];

export const shouldSkipAttribute = attributeName =>
  attributesToSkip.some(regex => regex.test(attributeName));

export function getPexRequiredAttributes(pexRequest, selectedCredentials = []) {
  // Match each credential to its best-fitting descriptor by checking which
  // descriptor's fields exist in the credential, rather than relying on
  // positional index. This allows credentials to be provided in any order.
  return selectedCredentials.map((credential, credIdx) => {
    const matchedDescriptor = findMatchingDescriptor(
      pexRequest.input_descriptors,
      credential,
    );
    if (!matchedDescriptor) {
      return [];
    }
    return matchedDescriptor.constraints.fields
      .filter(field => {
        if (field.filter || field.optional) {
          return false;
        }

        try {
          const paths = Array.isArray(field.path)
            ? field.path.flatMap(singlePath =>
                JSONPath.paths(credential, singlePath),
              )
            : JSONPath.paths(credential, field.path);

          return paths.length !== 0;
        } catch (error) {
          console.error(`Error in field ${field.path}: ${error.message}`);
          return false;
        }
      })
      .map(field =>
        getAttributeName({field, selectedCredentials, index: credIdx}),
      )
      .filter(attributeName => {
        return !shouldSkipAttribute(attributeName);
      });
  });
}

function findMatchingDescriptor(inputDescriptors, credential) {
  let bestMatch = null;
  let bestScore = 0;

  for (const descriptor of inputDescriptors) {
    const fields = descriptor.constraints?.fields || [];
    let score = 0;
    for (const field of fields) {
      try {
        const fieldPaths = Array.isArray(field.path)
          ? field.path
          : [field.path];
        for (const p of fieldPaths) {
          const paths = JSONPath.paths(credential, p);
          if (paths.length > 0) {
            score++;
            break;
          }
        }
      } catch {
        // ignore
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = descriptor;
    }
  }

  return bestMatch;
}
