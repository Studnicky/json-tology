import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ProtoKeywordEntity } from './ProtoKeywordEntity.js';
import { ConstructorKeywordEntity } from './ConstructorKeywordEntity.js';
import { PrototypeKeywordEntity } from './PrototypeKeywordEntity.js';

/**
 * An object-key literal that can be used to pollute `Object.prototype` when
 * assigned through an unguarded dynamic path (`__proto__`, `constructor`, or
 * `prototype`). Composed from the three atomic keyword entities rather than a
 * hand-rolled literal union.
 */
export namespace DangerousObjectKeyEntity {
  export const Schema = {
    'anyOf': [
      ProtoKeywordEntity.Schema,
      ConstructorKeywordEntity.Schema,
      PrototypeKeywordEntity.Schema
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return ProtoKeywordEntity.validate(candidate)
      || ConstructorKeywordEntity.validate(candidate)
      || PrototypeKeywordEntity.validate(candidate);
  }
}
