/**
 * Schema composition utilities
 *
 * Functions that derive new schemas from existing ones.
 * All functions produce correct JSON Schemas at runtime so the runtime schema
 * stays in sync with the TypeScript return type — no manual annotation needed.
 */

import type { JSONSchema } from 'json-schema-to-ts';
import type {
  ExtendSchema,
  IntersectionSchema,
  DiscriminatedUnionSchema,
  PartialSchema,
  RequiredSchema,
  PickSchema,
  OmitSchema,
} from '../types/compose.js';

export class Compose {
  /**
   * Derive a schema with additional properties merged in.
   * The `required` array is inherited unchanged; list new required fields
   * explicitly or use intersection() to combine with a schema that requires them.
   *
   * @example
   * const AdminSchema = Compose.extend(
   *   UserSchema,
   *   { role: { type: 'string', enum: ['admin', 'superadmin'] } } as const,
   *   'https://myapp.io/Admin'
   * );
   */
  public static extend<
    TSchema extends JSONSchema & { readonly $id: string },
    TAdditional extends Record<string, JSONSchema>,
    TId extends string,
  >(
    schema: TSchema,
    additionalProperties: TAdditional,
    newId: TId,
  ): ExtendSchema<TSchema, TAdditional, TId> {
    const source = schema as Record<string, unknown>;
    const sourceProps = (source['properties'] as Record<string, unknown>) ?? {};
    return {
      ...source,
      $id: newId,
      properties: { ...sourceProps, ...(additionalProperties as Record<string, unknown>) },
    } as unknown as ExtendSchema<TSchema, TAdditional, TId>;
  }

  /**
   * Combine multiple schemas using allOf (TypeScript intersection semantics).
   *
   * Infer<typeof result> will produce the intersection of all constituent types.
   * AJV validates all schemas against the data at runtime.
   *
   * @example
   * const PersonWithAddress = Compose.intersection(
   *   [PersonSchema, AddressSchema] as const,
   *   'https://example.io/PersonWithAddress'
   * );
   * type PersonWithAddress = Infer<typeof PersonWithAddress>;
   */
  public static intersection<
    TSchemas extends ReadonlyArray<JSONSchema>,
    TId extends string,
  >(schemas: TSchemas, newId: TId): IntersectionSchema<TSchemas, TId> {
    return {
      $id: newId,
      allOf: schemas,
    } as unknown as IntersectionSchema<TSchemas, TId>;
  }

  /**
   * Create a oneOf schema with a type discriminator field.
   *
   * Each variant schema should include the discriminator property with a const value.
   * The discriminator hint allows AJV (and OpenAPI tools) to optimise validation.
   *
   * Infer<typeof result> produces a TypeScript union of all variant types.
   *
   * @example
   * const ShapeSchema = Compose.discriminatedUnion(
   *   'kind',
   *   [CircleSchema, RectSchema] as const,
   *   'https://example.io/Shape'
   * );
   * type Shape = Infer<typeof ShapeSchema>;
   */
  public static discriminatedUnion<
    TDiscriminator extends string,
    TVariants extends ReadonlyArray<JSONSchema>,
    TId extends string,
  >(
    discriminatorProperty: TDiscriminator,
    variants: TVariants,
    newId: TId,
  ): DiscriminatedUnionSchema<TDiscriminator, TVariants, TId> {
    return {
      $id: newId,
      oneOf: variants,
      discriminator: { propertyName: discriminatorProperty },
    } as unknown as DiscriminatedUnionSchema<TDiscriminator, TVariants, TId>;
  }

  /**
   * Type guard that narrows a discriminated union value to the variant whose
   * discriminant property matches `expected`.
   *
   * @example
   * type Shape = Circle | Rect;
   * if (Compose.narrow(shape, 'kind', 'circle')) {
   *   // shape is Circle here
   * }
   */
  public static narrow<
    TUnion,
    TDiscriminant extends string,
    TValue extends string,
  >(
    value: TUnion,
    discriminant: TDiscriminant,
    expected: TValue,
  ): value is Extract<TUnion, Record<TDiscriminant, TValue>> {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Record<string, unknown>)[discriminant] === expected
    );
  }

  /**
   * Derive a schema where all properties are optional (no `required` array).
   * Produces a valid JSON Schema; `Infer<typeof result>` gives all-optional props.
   *
   * @example
   * const PatchUserSchema = Compose.partial(UserSchema, 'https://myapp.io/PatchUser');
   * type PatchUser = Infer<typeof PatchUserSchema>; // { name?: string; email?: string }
   */
  public static partial<
    TSchema extends JSONSchema & { readonly $id: string },
    TId extends string,
  >(schema: TSchema, newId: TId): PartialSchema<TSchema, TId> {
    const source = { ...(schema as Record<string, unknown>) };
    delete source['required'];
    source['$id'] = newId;
    return source as unknown as PartialSchema<TSchema, TId>;
  }

  /**
   * Derive a schema where every declared property is required.
   * Produces a valid JSON Schema; `Infer<typeof result>` gives all-required props.
   *
   * @example
   * const StrictUserSchema = Compose.required(UserSchema, 'https://myapp.io/StrictUser');
   */
  public static required<
    TSchema extends JSONSchema & { readonly $id: string },
    TId extends string,
  >(schema: TSchema, newId: TId): RequiredSchema<TSchema, TId> {
    const source = schema as Record<string, unknown>;
    const props = (source['properties'] as Record<string, unknown>) ?? {};
    return {
      ...source,
      $id: newId,
      required: Object.keys(props),
    } as unknown as RequiredSchema<TSchema, TId>;
  }

  /**
   * Derive a schema with only the specified property keys.
   * Non-picked required fields are dropped from `required`.
   * Produces a valid JSON Schema; `Infer<typeof result>` gives only the picked props.
   *
   * @example
   * const UserSummarySchema = Compose.pick(UserSchema, ['id', 'name'] as const, 'https://myapp.io/UserSummary');
   */
  public static pick<
    TSchema extends JSONSchema & { readonly $id: string },
    TKeys extends string,
    TId extends string,
  >(schema: TSchema, keys: ReadonlyArray<TKeys>, newId: TId): PickSchema<TSchema, TKeys, TId> {
    const source = schema as Record<string, unknown>;
    const sourceProps = (source['properties'] as Record<string, unknown>) ?? {};
    const sourceRequired = Array.isArray(source['required']) ? (source['required'] as string[]) : [];

    const pickedProps: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in sourceProps) pickedProps[key] = sourceProps[key];
    }

    const pickedRequired = sourceRequired.filter((r) => (keys as readonly string[]).includes(r));

    const result: Record<string, unknown> = { $id: newId, type: 'object', properties: pickedProps };
    if (pickedRequired.length > 0) result['required'] = pickedRequired;
    return result as unknown as PickSchema<TSchema, TKeys, TId>;
  }

  /**
   * Derive a schema with specified properties removed.
   * Removed required fields are also dropped from `required`.
   * Produces a valid JSON Schema; `Infer<typeof result>` excludes the omitted props.
   *
   * @example
   * const PublicUserSchema = Compose.omit(UserSchema, ['passwordHash'] as const, 'https://myapp.io/PublicUser');
   */
  public static omit<
    TSchema extends JSONSchema & { readonly $id: string },
    TKeys extends string,
    TId extends string,
  >(schema: TSchema, keys: ReadonlyArray<TKeys>, newId: TId): OmitSchema<TSchema, TKeys, TId> {
    const source = schema as Record<string, unknown>;
    const sourceProps = { ...(source['properties'] as Record<string, unknown> ?? {}) };
    const sourceRequired = Array.isArray(source['required']) ? (source['required'] as string[]) : [];

    for (const key of keys) delete sourceProps[key];
    const remainingRequired = sourceRequired.filter((r) => !(keys as readonly string[]).includes(r));

    const result: Record<string, unknown> = { $id: newId, type: 'object', properties: sourceProps };
    if (remainingRequired.length > 0) result['required'] = remainingRequired;
    return result as unknown as OmitSchema<TSchema, TKeys, TId>;
  }

  /**
   * Extract default values from a schema without building an instance.
   *
   * Recursively walks the schema's properties and returns a plain object
   * containing the `default` values declared on each property.
   * Properties with no `default` are omitted from the result.
   *
   * Note: $ref properties are not traversed — this operates on inline schemas only.
   *
   * @example
   * const schema = {
   *   type: 'object',
   *   properties: {
   *     name:   { type: 'string', default: 'Alice' },
   *     active: { type: 'boolean', default: true },
   *   }
   * } as const;
   *
   * Compose.getDefaults(schema);
   * // => { name: 'Alice', active: true }
   */
  public static getDefaults(schema: Record<string, unknown>): Record<string, unknown> {
    const props = schema['properties'];
    if (props === null || typeof props !== 'object' || Array.isArray(props)) return {};

    const result: Record<string, unknown> = {};

    for (const [key, propSchema] of Object.entries(props as Record<string, unknown>)) {
      if (typeof propSchema !== 'object' || propSchema === null) continue;
      const propertySchema = propSchema as Record<string, unknown>;

      if ('default' in propertySchema) {
        result[key] = structuredClone(propertySchema['default']);
      } else if (propertySchema['type'] === 'object' && propertySchema['properties']) {
        const nested = Compose.getDefaults(propertySchema);
        if (Object.keys(nested).length > 0) {
          result[key] = nested;
        }
      }
    }

    return result;
  }
}
