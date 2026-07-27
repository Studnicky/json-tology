import type { InferType } from '../types/Schema.js';

/** Effective value of the `jt:` vocabulary's `extra` (unhandled additional-properties) policy. */
export namespace JtExtraEntity {
  export const Schema = {
    'enum': [
      'allow',
      'forbid',
      'ignore'
    ],
    'type': 'string'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'allow' || candidate === 'forbid' || candidate === 'ignore';
  }
}
