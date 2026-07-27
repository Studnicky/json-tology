import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ProblemDetailsEntity } from './ProblemDetailsEntity.js';

/**
 * Caller-supplied overrides accepted by `ValidationErrors.report()` — the
 * subset of {@link ProblemDetailsEntity.Type} fields a caller may retarget:
 * `instance`, `status`, `title`, and `type`. `detail` and `errors` are always
 * computed by `report()` and are not overridable. At least one of the four
 * fields must be present.
 *
 * @category Validation
 * @since 0.1.0
 */
export namespace ProblemDetailsOverridesEntity {
  const {
    instance, status, title, type
  } = ProblemDetailsEntity.Schema.properties;
  const properties = {
    instance,
    status,
    title,
    type
  } as const;

  export const Schema = {
    'anyOf': [
      {
        'properties': properties,
        'required': ['instance'],
        'type': 'object'
      },
      {
        'properties': properties,
        'required': ['status'],
        'type': 'object'
      },
      {
        'properties': properties,
        'required': ['title'],
        'type': 'object'
      },
      {
        'properties': properties,
        'required': ['type'],
        'type': 'object'
      }
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;
    const hasValidInstance = value.instance === undefined || typeof value.instance === 'string';
    const hasValidStatus = value.status === undefined || typeof value.status === 'number';
    const hasValidTitle = value.title === undefined || typeof value.title === 'string';
    const hasValidType = value.type === undefined || typeof value.type === 'string';

    if (!hasValidInstance || !hasValidStatus || !hasValidTitle || !hasValidType) {
      return false;
    }

    return typeof value.instance === 'string'
      || typeof value.status === 'number'
      || typeof value.title === 'string'
      || typeof value.type === 'string';
  }
}
