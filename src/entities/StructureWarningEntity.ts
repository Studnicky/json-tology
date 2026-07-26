import type { InferType } from '../types/Schema.js';

/**
 * A single diagnostic warning produced by `SchemaGraphInterface.validateStructure`.
 *
 * @remarks
 * Structure warnings surface schema graph inconsistencies that do not prevent
 * execution but indicate modelling issues: missing `$id` on referenced nodes,
 * dangling `$ref` IRIs, unreachable `$defs` entries, or other structural
 * invariants that the graph enforces. Each warning identifies the rule that
 * fired, the JSON Pointer path within the schema document where the issue was
 * detected, and a human-readable message describing the problem.
 *
 * @example
 * ```ts
 * const warnings = graph.validateStructure();
 * for (const w of warnings) {
 *   console.warn(`[${w.rule}] at ${w.path}: ${w.message}`);
 * }
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @group SchemaGraph
 */
export namespace StructureWarningEntity {
  export const Schema = {
    'properties': {
      'message': { 'type': 'string' },
      'path': { 'type': 'string' },
      'rule': { 'type': 'string' }
    },
    'required': [
      'message',
      'path',
      'rule'
    ],
    'type': 'object'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.message === 'string'
      && typeof value.path === 'string'
      && typeof value.rule === 'string';
  }
}
