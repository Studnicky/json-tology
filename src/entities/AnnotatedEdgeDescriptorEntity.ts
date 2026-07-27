import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * AnnotatedEdgeDescriptorEntity — raw descriptor parsed from
 * `node.schema['jt:annotatedEdge']` by `extractSemantics`.
 *
 * Captures the three authored fields before IRI resolution so that
 * `pushAnnotatedEdgeRelations` can resolve them once via `graph.resolveReferenceId`
 * and build the `RelationStructureType` without re-reading `node.schema`.
 *
 * `annotations` holds raw authored JSON Schema sub-schemas keyed by annotation
 * predicate name (each carrying a required range `$ref` plus optional
 * predicate-binding keywords such as `x-jt-predicate` / `$id`), so the
 * annotation predicate IRI can be resolved late via `PredicateResolver` —
 * consistent with every other predicate. The sub-schema shape is authored
 * dynamically, so `annotations` is declared with `additionalProperties: true`
 * rather than a fixed nested schema.
 */
export namespace AnnotatedEdgeDescriptorEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'annotations': {
        'additionalProperties': true,
        'type': 'object'
      },
      'predicate': { 'type': 'string' },
      'targetRef': { 'type': 'string' }
    },
    'required': [
      'annotations',
      'predicate',
      'targetRef'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.predicate === 'string'
      && typeof value.targetRef === 'string'
      && typeof value.annotations === 'object' && value.annotations !== null;
  }
}
