import type { InferType } from '../types/Schema.js';

/** Structured JSON representation of a `BaseError`, including its recursive `cause` chain. */
export namespace ErrorJsonEntity {
  export const Schema = {
    '$recursiveAnchor': true,
    'properties': {
      'cause': { '$recursiveRef': '#' },
      'code': { 'type': 'string' },
      'message': { 'type': 'string' },
      'retryable': { 'type': 'boolean' }
    },
    'required': [
      'code',
      'message',
      'retryable'
    ],
    'type': 'object'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.code === 'string'
      && typeof value.message === 'string'
      && typeof value.retryable === 'boolean';
  }
}
