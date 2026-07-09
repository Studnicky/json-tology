/**
 * Schema transforms
 *
 * Attach decode/encode functions to a schema so instantiate() normalizes a raw
 * wire payload into the schema's canonical form. `decode` consumes the raw wire
 * type and produces the canonical value; the schema describes decode's OUTPUT,
 * so validation runs on the decoded result (decode → validate → strip).
 *
 * The schema object is never mutated — transforms are stored in a WeakMap.
 * The raw wire type is tracked via a phantom brand on the schema's TypeScript type.
 *
 * @example
 * const BookSchema = {
 *   $id: 'https://bookstore.example/schema/Book',
 *   type: 'object',
 *   properties: { isbn: { type: 'string' }, title: { type: 'string' } },
 *   required: ['isbn', 'title'],
 * } as const;
 * const BookCodec = Transform.create(BookSchema, {
 *   decode: (raw: { isbn_13: string; title: string }) => ({ isbn: raw.isbn_13, title: raw.title }),
 *   encode: (book) => ({ isbn_13: book.isbn, title: book.title }),
 * });
 * // raw wire { isbn_13, title } → canonical { isbn, title }
 * const book = jt.instantiate(BookCodec.$id, { isbn_13: '9780743273565', title: 'Gatsby' });
 */

import type {
  JsonSchemaDocumentObjectType, JsonSchemaDocumentType
} from '../../types/Schema.js';
import type {
  ChainWireType,
  TransformedType,
  ValidateChainType
} from '../../types/Transform.js';
import type { BrandedType } from '../../types/Brand.js';
import { Brand } from '../data/Brand.js';
import type {
  CanonicalShapeType
} from '../../types/Infer.js';
import type { JsonTologyReferencesInterface } from '../../types/SchemaReferences.js';
import type { TransformFnsType } from '../../types/TransformFnsType.js';
import type {
  AnyTransformStageType,
  TransformStageType
} from '../../types/TransformStage.js';


// ---------------------------------------------------------------------------
// Internal registry — never mutates schema objects
// ---------------------------------------------------------------------------

const transformRegistry = new WeakMap<object, TransformFnsType>();

// ---------------------------------------------------------------------------
// Transform class
// ---------------------------------------------------------------------------

/**
 * Attaches decode/encode transform functions to a JSON Schema so that
 * `instantiate()` normalizes a raw wire payload into the schema's canonical
 * form (decode → validate → strip). The schema describes decode's OUTPUT.
 *
 * @remarks
 * Schema objects are never mutated — transforms are stored in a `WeakMap`
 * keyed on the schema reference. The raw wire type is tracked via a phantom
 * brand on the schema's TypeScript type; `instantiate()` returns the canonical
 * type (the schema's `InferSchemaType`) without any runtime cast.
 *
 * @example
 * ```ts
 * const BookSchema = {
 *   $id: 'https://bookstore.example/schema/Book',
 *   type: 'object',
 *   properties: { isbn: { type: 'string' }, title: { type: 'string' } },
 *   required: ['isbn', 'title'],
 * } as const;
 * const BookCodec = Transform.create(BookSchema, {
 *   decode: (raw: { isbn_13: string; title: string }) => ({ isbn: raw.isbn_13, title: raw.title }),
 *   encode: (book) => ({ isbn_13: book.isbn, title: book.title }),
 * });
 * // raw wire { isbn_13, title } → canonical { isbn, title }
 * const book = jt.instantiate(BookCodec.$id, { isbn_13: '9780743273565', title: 'Gatsby' });
 * ```
 *
 * @category Transform
 * @since 0.1.0
 * @see {@link TransformFnsType}
 * @group Transform
 */
export class Transform {
  /**
   * Attach a compile-time brand name to a schema.
   * The schema object is returned unchanged at runtime.
   *
   * Use `BrandOutputType<typeof schema>` to obtain the branded TypeScript type.
   */
  public static brand<
    TSchema extends JsonSchemaDocumentType,
    TBrand extends string
  >(schema: TSchema, _: TBrand): BrandedType<TSchema, TBrand> {
    return Brand.cast<BrandedType<TSchema, TBrand>>(schema);
  }

  /**
   * Compose multiple transforms into a single chain attached to a schema.
   *
   * Decode runs left-to-right: T1.decode → T2.decode → …
   * Encode runs right-to-left: … → T2.encode → T1.encode
   *
   * Pairwise chain compatibility is enforced at compile time:
   *   - the first stage's `decode` input must accept the schema's wire type,
   *   - each stage N's `decode` output must match stage N+1's `decode` input.
   * Mismatches surface as a `ChainMismatchType` brand at the
   * offending tuple position, which is not assignable from the user's
   * literal stage object — so the call site is rejected.
   */
  public static chain<
    TSchema extends JsonSchemaDocumentType & { readonly '$id': string; },
    TStages extends readonly AnyTransformStageType[]
  >(
    schema: TSchema,
    transforms: TStages & ValidateChainType<TStages, CanonicalShapeType<TSchema>>
  ): TransformedType<TSchema, ChainWireType<TStages>> {
    const stages = transforms as ReadonlyArray<TransformStageType<unknown, unknown>>;
    const composed: TransformFnsType = {
      'decode': (value: unknown): unknown => {
        return stages.reduce<unknown>((accumulator: unknown, transform: TransformStageType<unknown, unknown>): unknown => {
          return transform.decode(accumulator);
        }, value);
      },
      'encode': (value: unknown): unknown => {
        return [...stages].reverse().reduce<unknown>((accumulator: unknown, transform: TransformStageType<unknown, unknown>): unknown => {
          return transform.encode(accumulator);
        }, value);
      }
    };

    transformRegistry.set(schema, composed);

    return Brand.cast<TransformedType<TSchema, ChainWireType<TStages>>>(schema);
  }

  /**
   * Attach decode and encode functions to a schema.
   *
   * - `decode` is called by instantiate() after validation succeeds.
   * - `encode` converts a decoded value back to the wire representation.
   *
   * The schema object is returned unchanged at runtime; only the TypeScript
   * return type is widened so `instantiate()` returns the decoded type.
   */
  public static create<
    TSchema extends JsonSchemaDocumentType & { readonly '$id': string; },
    TWire = unknown,
    TReferences = JsonTologyReferencesInterface
  >(
    schema: TSchema,
    fns: {
      // A normalize transform's `decode` consumes the raw wire payload `TWire`
      // (author-supplied; not derived from the schema) and produces the schema's
      // canonical, branded form — or a subset of it. `instantiate()` runs
      // decode → applyDefaults → validate, so a `decode` used with
      // `enableDefaults: true` only needs to return the fields it actually
      // transforms; schema `default`s fill the rest before validation. `encode`
      // is the inverse and always consumes the full canonical value, since
      // `encode` runs on the validated, fully-defaulted result.
      //
      // `TReferences` is the ref-resolving canonical path: a `$ref`-bearing (or
      // composed) schema resolves its canonical output type instead of degrading
      // to `RefNotFound`. It defaults to the global, consumer-augmentable
      // `JsonTologyReferencesInterface`, so a transform authored against
      // registered schemas resolves cross-refs auto-magically — the same default
      // as `CanonicalShapeType`/`InferType`. Pass an explicit map to override.
      //
      // Both sides speak the brand-free structural canonical (`CanonicalShapeType`):
      // `decode` produces plain values (no per-leaf `Brand.cast()`), and `validate`
      // — run by `instantiate` — is the boundary that certifies the branded form.
      'decode': (raw: TWire) => Partial<CanonicalShapeType<TSchema, TReferences>>;
      'encode': (value: CanonicalShapeType<TSchema, TReferences>) => TWire;
    }
  ): TransformedType<TSchema, TWire> {
    Transform.register(schema, fns as TransformFnsType);

    return Brand.cast<TransformedType<TSchema, TWire>>(schema);
  }

  /**
   * Return the decode/encode functions registered for a schema, or `undefined`.
   *
   * @param schema - The schema object to look up.
   * @returns The registered decode/encode pair, or `undefined` if none.
   */
  public static getDecoder(schema: JsonSchemaDocumentObjectType): TransformFnsType | undefined {
    return transformRegistry.get(schema);
  }

  /**
   * Store decode/encode functions for a schema in the transform registry.
   *
   * The single type-erasure boundary for transforms: typed public callers
   * ({@link create}, `JsonTology.addTransform`) keep their precise lambda types
   * and pass the erased {@link TransformFnsType} here.
   *
   * @param schema - The schema object the decode/encode pair is keyed against.
   * @param fns - The decode/encode functions to store.
   */
  public static register(schema: JsonSchemaDocumentObjectType, fns: TransformFnsType): void {
    transformRegistry.set(schema, fns);
  }
}
