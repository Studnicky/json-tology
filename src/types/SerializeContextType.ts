import type { InferType } from './Schema.js';

export const SERIALIZE_CONTEXT_SCHEMA = {
  'properties': {
    'indent': { 'type': 'number' },
    'innerPad': { 'type': 'string' },
    'pad': { 'type': 'string' }
  },
  'required': [
    'indent',
    'innerPad',
    'pad'
  ],
  'type': 'object'
} as const;

/**
 * Serialization context for the literal-serializer helpers.
 *
 * @remarks
 * Bundles the pad and innerPad strings with the current indent depth so
 * the array and object serializer helpers do not need separate parameters.
 *
 * @example
 * ```ts
 * const ctx: SerializeContextType = { pad, innerPad, indent };
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type SerializeContextType = InferType<typeof SERIALIZE_CONTEXT_SCHEMA>;
