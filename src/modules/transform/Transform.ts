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
 * type Decoded = ParseOutputType<typeof DateSchema>; // Date
 */

import type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';
import type { TransformedType } from '../../types/transform.js';
import type { BrandedType } from '../../types/brand.js';


// ---------------------------------------------------------------------------
// Internal registry — never mutates schema objects
// ---------------------------------------------------------------------------

interface TransformFnsInterface {
  'decode': (input: unknown) => unknown;
  'encode': (output: unknown) => unknown;
}

const transformRegistry = new WeakMap<object, TransformFnsInterface>();

// ---------------------------------------------------------------------------
// Transform class
// ---------------------------------------------------------------------------

export class Transform {
  /**
   * Attach a compile-time brand name to a schema.
   * The schema object is returned unchanged at runtime.
   *
   * Use `BrandOutputType<typeof schema>` to obtain the branded TypeScript type.
   */
  public static brand<
    TSchema extends JSONSchemaType,
    TBrand extends string
  >(schema: TSchema, _brandName: TBrand): BrandedType<TSchema, TBrand> {
    return schema as unknown as BrandedType<TSchema, TBrand>;
  }

  /**
   * Attach decode and encode functions to a schema.
   *
   * - `decode` is called by parse() after validation succeeds.
   * - `encode` converts a decoded value back to the wire representation.
   *
   * The schema object is returned unchanged at runtime; only the TypeScript
   * return type is widened to carry `ParseOutputType<T>` information.
   */
  public static create<
    TSchema extends JSONSchemaType & { readonly '$id': string; },
    TOut
  >(
    schema: TSchema,
    fns: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'decode': (input: any) => TOut;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'encode': (output: TOut) => any;
    }
  ): TransformedType<TSchema, TOut> {
    transformRegistry.set(schema, fns as TransformFnsInterface);

    return schema as unknown as TransformedType<TSchema, TOut>;
  }

  /** Returns the decode/encode functions registered for a schema, or undefined. */
  public static getDecoder(schema: object): TransformFnsInterface | undefined {
    return transformRegistry.get(schema);
  }

  /**
   * Compose multiple transforms into a single pipeline attached to a schema.
   *
   * Decode runs left-to-right: T1.decode → T2.decode → …
   * Encode runs right-to-left: … → T2.encode → T1.encode
   */
  public static pipe<
    TSchema extends JSONSchemaType & { readonly '$id': string; },
    TOut
  >(
    schema: TSchema,

    transforms: Array<{
      'decode': (value: any) => any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'encode': (value: any) => any;
    }>
  ): TransformedType<TSchema, TOut> {
    const composed: TransformFnsInterface = {
      'decode': (value: unknown) => {
        return transforms.reduce((accumulator, transform) => {
          return transform.decode(accumulator);
        }, value);
      },
      'encode': (value: unknown) => {
        return [...transforms].reverse().reduce((accumulator, transform) => {
          return transform.encode(accumulator);
        }, value);
      }
    };

    transformRegistry.set(schema, composed);

    return schema as unknown as TransformedType<TSchema, TOut>;
  }
}
