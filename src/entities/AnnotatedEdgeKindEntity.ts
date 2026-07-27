import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Discriminant literal for the annotated-edge variant of `RelationStructureType`. */
export namespace AnnotatedEdgeKindEntity {
  export const Schema = {
    'const': 'annotatedEdge',
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'annotatedEdge';
  }
}
