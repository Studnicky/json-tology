/**
 * Bookstore Transform chain demo — ISBN normalisation.
 *
 * Demonstrates `Transform.create` and `Transform.chain` with pairwise
 * chain-compatibility checking.
 *
 * Pairwise compatibility
 * ----------------------
 * `Transform.chain` enforces at compile time that stage N's `decode` return
 * type is assignable to stage N+1's `decode` parameter type.  A mismatch
 * surfaces a `ChainMismatchInterface` brand at the offending tuple
 * position so the call is rejected before runtime.  The validator also checks
 * that the first stage's input accepts the schema's wire type — a first-stage
 * mismatch surfaces a `ChainSchemaMismatchInterface` brand.
 *
 * Transform.create vs Transform.chain
 * ------------------------------------
 * `Transform.create` attaches a single decode/encode pair to a schema.  The
 * decode function receives the schema's inferred wire type and returns the
 * desired output type.  The encode function is the inverse.
 *
 * `Transform.chain` composes multiple stages.  Each stage is a plain object
 * with `decode` and `encode`.  Stages run left-to-right on decode and
 * right-to-left on encode.
 *
 * Chain (using Transform.chain)
 * ------------------------------
 * wire string (e.g. "978-0-525-55947-4")
 *   → validateLength   : string → string      (asserts exactly 13 digits)
 *   → parseIsbn        : string → ParsedIsbnInterface (extracts EAN prefix, group code, etc.)
 */

import { Transform } from '../../../src/index.js';
import type { TransformStageInterface } from '../../../src/interfaces/TransformStage.js';
import { IsbnSchema } from './entities/Isbn.js';

// ---------------------------------------------------------------------------
// Domain type produced at the end of the pipeline
// ---------------------------------------------------------------------------

export interface ParsedIsbnInterface {
  /** EAN / GS1 prefix — always "978" or "979" for books. */
  readonly 'ean': string;
  /** Registration group (language / country). */
  readonly 'group': string;
  /** The 13-digit digit string stripped of all separators. */
  readonly 'normalized': string;
  /** Publisher prefix. */
  readonly 'publisher': string;
  /** Title identifier. */
  readonly 'title': string;
}

// ---------------------------------------------------------------------------
// Transform.create — single-stage: attach a decode/encode pair to a schema
//
// Uses a self-contained schema without a pattern brand so the wire type is
// plain `string`, making encode/decode annotations straightforward.
//
// The RawIsbnSchema accepts any string.  After validation passes, `decode`
// strips hyphens and spaces so callers receive a clean digit-only string.
// ---------------------------------------------------------------------------

const RawIsbnSchema = {
  '$id': 'urn:bookstore:_RawIsbn',
  'type': 'string'
} as const;

/**
 * Single-stage transform: strip separators from raw input.
 *
 * `Transform.create` attaches the decode/encode pair directly to the schema.
 * The returned schema value carries a phantom brand so `ParseOutputType<typeof
 * stripHyphensSchema>` resolves to `string` (the decode output type) rather
 * than the schema's wire type.
 */
export const stripHyphensSchema = Transform.create(RawIsbnSchema, {
  'decode': (rawIsbn: string): string => {
    return rawIsbn.replaceAll(/[- ]/gu, '');
  },
  'encode': (clean: string): string => {
    // ISBN-13 canonical format: EAN-group-publisher-title-check
    // e.g. 9780525559474 → 978-0-5255-5947-4
    return `${clean.slice(0, 3)}-${clean.slice(3, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12)}`;
  }
});

// ---------------------------------------------------------------------------
// Transform.chain — multi-stage chain bound to IsbnSchema
//
// Stage declarations as standalone TransformStageInterface objects so they
// can be unit-tested or reused in other chains independently.
// ---------------------------------------------------------------------------

/**
 * Stage 1 — validate that the input is exactly 13 digits.
 *
 * Precondition: the string is already stripped of separators (digits only).
 * Throws `RangeError` at runtime when the constraint is violated.
 */
const validateIsbnLength: TransformStageInterface<string, string> = {
  'decode': (stripped: string): string => {
    if (!/^\d{13}$/u.test(stripped)) {
      throw new RangeError(`Expected 13 digits after stripping; got "${stripped}"`);
    }

    return stripped;
  },
  'encode': (clean: string): string => {
    return clean;
  }
};

/**
 * Stage 2 — parse the validated 13-digit string into a structured value.
 */
const parseIsbnSegments: TransformStageInterface<string, ParsedIsbnInterface> = {
  'decode': (normalized: string): ParsedIsbnInterface => {
    return {
      'ean': normalized.slice(0, 3),
      'group': normalized.slice(3, 4),
      'normalized': normalized,
      'publisher': normalized.slice(4, 8),
      'title': normalized.slice(8, 12)
    };
  },
  'encode': (parsed: ParsedIsbnInterface): string => {
    return parsed.normalized;
  }
};

/**
 * Full ISBN chain composed via `Transform.chain`.
 *
 * `ParseOutputType<typeof IsbnPipelineSchema>` resolves to `ParsedIsbnInterface`.
 * Pass this schema to `jt.instantiate()` to get a structured `ParsedIsbnInterface`
 * back instead of the raw wire string.
 *
 * Compile-time pairwise chain compatibility:
 *   • validateIsbnLength.decode  : string → string           (matches IsbnSchema wire type)
 *   • parseIsbnSegments.decode   : string → ParsedIsbnInterface (matches validateIsbnLength output)
 *
 * Swapping the order (parseIsbnSegments before validateIsbnLength) would produce a
 * `ChainMismatchInterface` brand error because `ParsedIsbnInterface` is not
 * assignable to validateIsbnLength's `string` parameter.
 */
export const IsbnPipelineSchema = Transform.chain(IsbnSchema, [
  validateIsbnLength,
  parseIsbnSegments
] as const);
