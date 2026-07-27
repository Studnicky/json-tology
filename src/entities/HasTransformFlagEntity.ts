import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { BooleanValueEntity } from './BooleanValueEntity.js';

/**
 * True when a Transform decoder is attached to this schema's object at
 * registration time. Used by duplicate detection to give transform-bearing
 * schemas a distinct structural identity so they do not collide with
 * semantically plain schemas that share an identical JSON body.
 */
export namespace HasTransformFlagEntity {
  export const Schema = { ...BooleanValueEntity.Schema } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const isBoolean = BooleanValueEntity.validate(candidate);

    return isBoolean;
  }
}
