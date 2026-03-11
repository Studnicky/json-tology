/**
 * Schema transforms
 *
 * Attach decode/encode functions to a schema so parse() automatically
 * transforms validated data into a richer type (e.g. string → Date).
 *
 * The schema object is never mutated — transforms are stored in a WeakMap.
 * The output type is tracked via a phantom brand on the schema's TypeScript type.
 *
 * @example
 * const DateSchema = Transform.create(
 *   { $id: 'Date', type: 'string', format: 'date-time' } as const,
 *   {
 *     decode: (s: string) => new Date(s),
 *     encode: (d: Date) => d.toISOString(),
 *   },
 * );
 * type Decoded = ParseOutput<typeof DateSchema>; // Date
 */

import type { JSONSchema } from 'json-schema-to-ts';
import type { Transformed, WithCatchSchema, ParseOutput } from '../types/transform.js';
import type { Branded } from '../types/brand.js';

export type { Transformed, WithCatchSchema, ParseOutput } from '../types/transform.js';
export type { BrandTag, Branded, BrandOutput } from '../types/brand.js';

// ---------------------------------------------------------------------------
// Internal registry — never mutates schema objects
// ---------------------------------------------------------------------------

interface TransformFns {
  decode: (input: unknown) => unknown;
  encode: (output: unknown) => unknown;
}

const transformRegistry = new WeakMap<object, TransformFns>();
const catchRegistry     = new WeakMap<object, unknown>();

// ---------------------------------------------------------------------------
// Transform class
// ---------------------------------------------------------------------------

export class Transform {
  /**
   * Attach decode and encode functions to a schema.
   *
   * - `decode` is called by parse() / safeParse() after validation succeeds.
   * - `encode` converts a decoded value back to the wire representation for
   *   validation or serialization via jt.encode().
   *
   * The schema object is returned unchanged at runtime; only the TypeScript
   * return type is widened to carry `ParseOutput<T>` information.
   */
  public static create<
    TSchema extends JSONSchema & { readonly $id: string },
    TOut,
  >(
    schema: TSchema,
    fns: {
      decode: (input: any) => TOut;  // `any` avoids deep FromSchema instantiation in the body
      encode: (output: TOut) => any;
    },
  ): Transformed<TSchema, TOut> {
    transformRegistry.set(schema, fns as TransformFns);
    return schema as unknown as Transformed<TSchema, TOut>;
  }

  /**
   * Attach a fallback value to a schema.
   * When safeParse() fails, the fallback is returned instead of an error result.
   *
   * @example
   * const SafeUserSchema = Transform.withCatch(UserSchema, defaultUser);
   * const result = jt.safeParse(SafeUserSchema, unknownData);
   * // result.success is always true; result.data is either parsed data or defaultUser
   */
  public static withCatch<
    TSchema extends JSONSchema & { readonly $id: string },
    TFallback extends ParseOutput<TSchema>,
  >(schema: TSchema, fallback: TFallback): WithCatchSchema<TSchema, TFallback> {
    catchRegistry.set(schema, fallback);
    return schema as unknown as WithCatchSchema<TSchema, TFallback>;
  }

  /**
   * Attach a compile-time brand name to a schema.
   * The schema object is returned unchanged at runtime.
   *
   * Use `BrandOutput<typeof schema>` to obtain the branded TypeScript type.
   *
   * @example
   * const UserIdSchema = Transform.brand(
   *   { $id: 'https://myapp.io/UserId', type: 'string' } as const,
   *   'UserId',
   * );
   * type UserId = BrandOutput<typeof UserIdSchema>;
   * // UserId = string & { readonly __brand: 'UserId' }
   */
  public static brand<
    TSchema extends JSONSchema,
    TBrand extends string,
  >(schema: TSchema, _brandName: TBrand): Branded<TSchema, TBrand> {
    return schema as unknown as Branded<TSchema, TBrand>;
  }

  /**
   * Compose multiple transforms into a single pipeline attached to a schema.
   *
   * Decode runs left-to-right: T1.decode → T2.decode → …
   * Encode runs right-to-left: … → T2.encode → T1.encode
   *
   * @example
   * const DateRangeSchema = Transform.pipe(
   *   { $id: 'DateRange', type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } as const,
   *   [
   *     { decode: (v: any) => ({ start: new Date(v.start), end: new Date(v.end) }), encode: (v: any) => ({ start: v.start.toISOString(), end: v.end.toISOString() }) },
   *     { decode: (v: any) => ({ ...v, duration: v.end.getTime() - v.start.getTime() }), encode: (v: any) => v },
   *   ],
   * );
   */
  public static pipe<
    TSchema extends JSONSchema & { readonly $id: string },
    TOut,
  >(
    schema: TSchema,
    transforms: Array<{ decode: (v: any) => any; encode: (v: any) => any }>,
  ): Transformed<TSchema, TOut> {
    const composed: TransformFns = {
      decode: (v: unknown) => transforms.reduce((acc, t) => t.decode(acc), v),
      encode: (v: unknown) => [...transforms].reverse().reduce((acc, t) => t.encode(acc), v),
    };
    transformRegistry.set(schema, composed);
    return schema as unknown as Transformed<TSchema, TOut>;
  }

  // ---------------------------------------------------------------------------
  // Internal accessors used by SchemaRegistry / JsonTology
  // ---------------------------------------------------------------------------

  /** Returns the decode/encode functions registered for a schema, or undefined. */
  public static getDecoder(schema: object): TransformFns | undefined {
    return transformRegistry.get(schema);
  }

  /** Returns the fallback value registered for a schema via withCatch(). */
  public static getFallback(schema: object): unknown {
    return catchRegistry.get(schema);
  }

  /** Returns true if the schema has a fallback value registered via withCatch(). */
  public static hasFallback(schema: object): boolean {
    return catchRegistry.has(schema);
  }
}
