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
 * surfaces a `ChainMismatchType` brand at the offending tuple
 * position so the call is rejected before runtime.  The validator also checks
 * that the first stage's input accepts the schema's wire type — a first-stage
 * mismatch surfaces a `ChainSchemaMismatchType` brand.
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
// Stage declarations as standalone TransformStageType objects so they
// can be unit-tested or reused in other chains independently.
// ---------------------------------------------------------------------------


/**
 * Full ISBN chain composed via `Transform.chain`.
 *
 * The chain is attached to a distinct string-typed sibling of `IsbnSchema`
 * (`IsbnPipelineBase`) so the canonical `IsbnSchema` object remains
 * transform-free. Any example that instantiates `IsbnSchema` directly (or via
 * `$ref: urn:bookstore:Isbn`) sees the plain string wire format — the decode
 * pipeline only fires when callers explicitly use `IsbnPipelineSchema.$id`.
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
 * `ChainMismatchType` brand error because `ParsedIsbnInterface` is not
 * assignable to validateIsbnLength's `string` parameter.
 */
// In the normalize model, the schema describes the CANONICAL OUTPUT form, not the wire.
// Transform.chain verifies:
// - each stage's `decode` output matches the next stage's input
// - the final stage's `decode` output matches the schema type
//
// Wire: string (ISBN digits or formatted) — the instantiate input type
// Stage 1: string → string (validate 13 digits)
// Stage 2: string → canonical object
// Canonical/Schema: { ean, group, normalized, publisher, title }
const IsbnPipelineBase = {
  '$id': 'urn:bookstore:_IsbnPipeline',
  'properties': {
    'ean': { 'type': 'string' },
    'group': { 'type': 'string' },
    'normalized': { 'type': 'string' },
    'publisher': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'required': [
    'ean',
    'group',
    'normalized',
    'publisher',
    'title'
  ],
  'type': 'object'
} as const;

/**
 * Full ISBN chain composed via `Transform.chain`.
 *
 * The chain processes wire strings through two stages:
 * 1. Validate that the input is exactly 13 digits
 * 2. Parse the 13-digit string into structured ParsedIsbnInterface
 *
 * Compile-time pairwise chain compatibility:
 *   • Stage 1: string → string           (matches IsbnPipelineBase wire type)
 *   • Stage 2: string → ParsedIsbnInterface (matches Stage 1 output)
 *
 * The canonical output (ParsedIsbnInterface) is JSON-expressible (plain object).
 */
export const IsbnPipelineSchema = Transform.chain(IsbnPipelineBase, [
  {
    'decode': (stripped: unknown) => {
      // Stage 1: Validate that the input is exactly 13 digits
      const s = stripped as string;

      if (!/^\d{13}$/u.test(s)) {
        throw new RangeError(`Expected 13 digits; got "${s}"`);
      }

      return s;
    },
    'encode': (clean: unknown) => {
      return clean as string;
    }
  },
  {
    'decode': (normalized: unknown) => {
      // Stage 2: Parse the 13-digit string into structured segments
      const s = normalized as string;

      return {
        'ean': s.slice(0, 3),
        'group': s.slice(3, 4),
        'normalized': s,
        'publisher': s.slice(4, 8),
        'title': s.slice(8, 12)
      };
    },
    'encode': (parsed: unknown) => {
      const isbnRecord = parsed as ParsedIsbnInterface;

      return isbnRecord.normalized;
    }
  }
] as const);
