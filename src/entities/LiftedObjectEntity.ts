import type { InferType } from '../types/Schema.js';

/** Lifted JS object carrying the reconstructed property values. */
export namespace LiftedObjectEntity {
  export const Schema = { 'type': 'object' } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'object' && candidate !== null;
  }
}
