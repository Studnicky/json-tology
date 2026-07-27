/**
 * ShaclValidationReportEntity — the top-level SHACL conformance report.
 *
 * Aligned with the SHACL specification `sh:ValidationReport` shape.
 * Returned by `ShaclValidator.validate()` and `JsonTology.validateWithShacl()`.
 *
 * `conforms` is `true` if and only if there are zero results with
 * `resultSeverity === 'Violation'`.
 *
 * @category SHACL
 * @since 0.20.0
 * @see {@link https://www.w3.org/TR/shacl/#validation-report SHACL Validation Report}
 * @group Entities
 */
import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ShaclValidationResultEntity } from './ShaclValidationResultEntity.js';

export namespace ShaclValidationReportEntity {
  export const Schema = {
    'properties': {
      /**
       * Whether the data graph conforms to the shapes graph.
       * `true` iff `results` contains no entries with `resultSeverity === 'Violation'`.
       */
      'conforms': { 'type': 'boolean' },
      /**
       * All validation results produced during shape evaluation.
       * Empty when the data conforms.
       */
      'results': {
        'items': ShaclValidationResultEntity.Schema,
        'type': 'array'
      }
    },
    'required': [
      'conforms',
      'results'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.conforms === 'boolean' && Array.isArray(value.results);
  }
}
