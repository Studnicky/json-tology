import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { StringValueEntity } from './StringValueEntity.js';

/**
 * String form of the `iriFor` subject-minting option: either an arbitrary IRI
 * used as the depth-0 root subject override, or the `'blank-node'` sentinel
 * ({@link BLANK_NODE_IRI_FOR}) that switches every subject to anonymous
 * blank-node minting.
 */
export namespace IriForValueEntity {
  export const Schema = { ...StringValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isString = StringValueEntity.validate(candidate);

    return isString;
  }
}
