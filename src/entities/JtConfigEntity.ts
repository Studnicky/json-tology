import type { InferType } from '../types/Schema.js';
import { JtExtraEntity } from './JtExtraEntity.js';

/** Per-node `jt:` vocabulary configuration (strict/frozen/extra policy). */
export namespace JtConfigEntity {
  export const Schema = {
    'properties': {
      'extra': JtExtraEntity.Schema,
      'frozen': { 'type': 'boolean' },
      'strict': { 'type': 'boolean' }
    },
    'type': 'object'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    if (value.extra !== undefined && !(JtExtraEntity.Schema.enum as readonly string[]).includes(value.extra as string)) {
      return false;
    }

    return (value.frozen === undefined || typeof value.frozen === 'boolean')
      && (value.strict === undefined || typeof value.strict === 'boolean');
  }
}
