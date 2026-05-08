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
 * const date = jt.parse(DateSchema.$id, '2026-01-01'); // typed as Date
 */

import type { JSONSchema7Definition } from 'json-schema';
import type {
  PipeChainOutputType,
  TransformedType,
  ValidatePipeChainType
} from '../../types/Transform.js';
import type { BrandedType } from '../../types/Brand.js';
import type { InferSchemaType } from '../../types/Infer.js';
import type { TransformFnsInterface } from '../../interfaces/TransformFns.js';
import type {
  AnyTransformStageInterface,
  TransformStageInterface
} from '../../interfaces/TransformStage.js';


// ---------------------------------------------------------------------------
// Internal registry — never mutates schema objects
// ---------------------------------------------------------------------------

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
    TSchema extends JSONSchema7Definition,
    TBrand extends string
  >(schema: TSchema, _: TBrand): BrandedType<TSchema, TBrand> {
    return schema as unknown as BrandedType<TSchema, TBrand>;
  }

  /**
   * Attach decode and encode functions to a schema.
   *
   * - `decode` is called by parse() after validation succeeds.
   * - `encode` converts a decoded value back to the wire representation.
   *
   * The schema object is returned unchanged at runtime; only the TypeScript
   * return type is widened so `parse()` returns the decoded type.
   */
  public static create<
    TSchema extends JSONSchema7Definition & { readonly '$id': string; },
    TOut extends unknown
  >(
    schema: TSchema,
    fns: {
      'decode': (input: InferSchemaType<TSchema>) => TOut;
      'encode': (output: TOut) => InferSchemaType<TSchema>;
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
   *
   * Pairwise chain compatibility is enforced at compile time:
   *   - the first stage's `decode` input must accept the schema's wire type,
   *   - each stage N's `decode` output must match stage N+1's `decode` input.
   * Mismatches surface as a `PipeChainMismatchInterface` brand at the
   * offending tuple position, which is not assignable from the user's
   * literal stage object — so the call site is rejected.
   */
  public static pipe<
    TSchema extends JSONSchema7Definition & { readonly '$id': string; },
    TStages extends readonly AnyTransformStageInterface[]
  >(
    schema: TSchema,
    transforms: TStages & ValidatePipeChainType<TStages, InferSchemaType<TSchema>>
  ): TransformedType<TSchema, PipeChainOutputType<TStages>> {
    const stages = transforms as ReadonlyArray<TransformStageInterface<unknown, unknown>>;
    const composed: TransformFnsInterface = {
      'decode': (value: unknown) => {
        return stages.reduce<unknown>((accumulator, transform) => {
          return transform.decode(accumulator);
        }, value);
      },
      'encode': (value: unknown) => {
        return [...stages].reverse().reduce<unknown>((accumulator, transform) => {
          return transform.encode(accumulator);
        }, value);
      }
    };

    transformRegistry.set(schema, composed);

    return schema as unknown as TransformedType<TSchema, PipeChainOutputType<TStages>>;
  }
}
