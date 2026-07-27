/**
 * Compile-time schema validator.
 *
 * `ValidateSchemaType<T>` walks a schema's keywords and verifies cross-keyword
 * references are sound. If every reference resolves, the validator passes `T`
 * through unchanged. If a reference is bad, the validator surfaces a structured
 * error type that makes the schema literal incompatible with the parameter
 * (so the type-checker rejects the call site).
 *
 * Currently checks:
 *   - `required: ['key']` — every entry must be a key of `properties`
 *   - `dependentRequired: { x: ['y', 'z'] }` — every key and every value-array
 *     entry must be a key of `properties`
 *   - `if: { properties: { kind: { const: 'X' } } }` — every property name in
 *     `if.properties` must be a key of the parent schema's `properties`
 *
 * The validator is intended to be applied:
 *   1. By `Compose.*` builders that produce these keywords (so Compose-built
 *      schemas are correct by construction), and
 *   2. By authors at the call site as a self-check on hand-written schemas:
 *      `const _ok: ValidateSchemaType<typeof MySchema> = MySchema;`.
 *
 * Recursion is bounded by the schema literal depth — each rule is a single
 * `extends` test that does not recurse, so no per-rule cap is needed.
 */

import type {
  DependentRequiredKeyNotInPropertiesType,
  IfDiscriminatorNotInPropertiesType,
  RequiredKeyNotInPropertiesType
} from './TypeErrors.js';

/** The set of valid property keys for a schema, or `never` if no properties. */
type SchemaPropertyKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? Extract<keyof P, string>
    : never;

/**
 * Walk `required` and emit a brand for any entry not in `properties`.
 *
 * The result is a union of `RequiredKeyNotInPropertiesType<bad-key, ...>`
 * brands; if every entry resolves, the union is `never`.
 */
type RequiredErrorsType<T, TPropKeys extends string>
  = T extends { readonly 'required': infer R extends readonly unknown[] }
    ? R[number] extends infer TEntry
      ? TEntry extends string
        ? TEntry extends TPropKeys
          ? never
          : RequiredKeyNotInPropertiesType<TEntry, TPropKeys>
        : never
      : never
    : never;

/**
 * Walk `dependentRequired` and emit brands for any bad map-key or value-array
 * entry.
 */
type DependentRequiredErrorsType<T, TPropKeys extends string>
  = T extends { readonly 'dependentRequired': infer D }
    ? D extends Record<string, readonly string[]>
      ? (Extract<keyof D, string> extends infer TKey
        ? TKey extends string
          ? TKey extends TPropKeys
            ? D[TKey][number] extends infer TDep
              ? TDep extends string
                ? TDep extends TPropKeys
                  ? never
                  : DependentRequiredKeyNotInPropertiesType<TDep>
                : never
              : never
            : DependentRequiredKeyNotInPropertiesType<TKey>
          : never
        : never)
      : never
    : never;

/** Walk `if.properties` keys and emit brands for any name not in parent properties. */
type IfDiscriminatorErrorsType<T, TPropKeys extends string>
  = T extends { readonly 'if': { readonly 'properties': infer IfProps } }
    ? Extract<keyof IfProps, string> extends infer TKey
      ? TKey extends string
        ? TKey extends TPropKeys
          ? never
          : IfDiscriminatorNotInPropertiesType<TKey>
        : never
      : never
    : never;

/**
 * Aggregate every cross-keyword error for a schema into a single union.
 * `never` when the schema is sound.
 */
export type SchemaValidationErrorsType<T>
  = [T] extends [unknown]
    ? DependentRequiredErrorsType<T, SchemaPropertyKeysType<T>>
      | IfDiscriminatorErrorsType<T, SchemaPropertyKeysType<T>>
      | RequiredErrorsType<T, SchemaPropertyKeysType<T>>
    : never;

/**
 * Pass `T` through if it has no cross-keyword errors. Otherwise produce a
 * sibling-keyed error type that makes the schema literal incompatible with the
 * validator's expected shape.
 *
 * The error case intersects `T` with `{ readonly 'schemaErrors': <errors> }`,
 * which the literal does not declare, so TypeScript reports the call as
 * incompatible. The IDE hover surfaces the structured error brand union.
 */
export type ValidateSchemaType<T>
  = [SchemaValidationErrorsType<T>] extends [never]
    ? T
    : T & { 'schemaErrors': SchemaValidationErrorsType<T> };
