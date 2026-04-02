/**
 * Schema composition utilities
 *
 * Functions that derive new schemas from existing ones.
 * All functions produce correct JSON Schemas at runtime so the runtime schema
 * stays in sync with the TypeScript return type — no manual annotation needed.
 */

import type {
  DiscriminatedUnionSchemaInterface,
  IntersectionSchemaInterface,
  OmitSchemaInterface,
  PickSchemaInterface
} from '../../interfaces/Compose.js';
import type {
  ExtendSchemaType,
  PartialSchemaType,
  RequiredSchemaType
} from '../../types/Compose.js';
import { isRecord } from '../data/dataTypes.js';

export class Compose {
  /**
   * Create a oneOf schema with a type discriminator field.
   *
   * Each variant schema should include the discriminator property with a const value.
   * The discriminator hint allows validators and OpenAPI tools to optimise validation.
   *
   * InferType<typeof result> produces a TypeScript union of all variant types.
   *
   * @example
   * const ShapeSchema = Compose.discriminatedUnion(
   *   'kind',
   *   [CircleSchema, RectSchema] as const,
   *   'https://example.io/Shape'
   * );
   * type Shape = InferType<typeof ShapeSchema>;
   */
  public static discriminatedUnion<
    TDiscriminator extends string,
    TVariants extends ReadonlyArray<Record<string, unknown>>,
    TId extends string
  >(
    discriminatorProperty: TDiscriminator,
    variants: TVariants,
    newId: TId
  ): DiscriminatedUnionSchemaInterface<TDiscriminator, TVariants, TId> {
    return {
      '$id': newId,
      'discriminator': { 'propertyName': discriminatorProperty },
      'oneOf': variants
    } as unknown as DiscriminatedUnionSchemaInterface<TDiscriminator, TVariants, TId>;
  }

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
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TAdditional extends Record<string, unknown>,
    TId extends string
  >(
    schema: TSchema,
    additionalProperties: TAdditional,
    newId: TId
  ): ExtendSchemaType<TSchema, TAdditional, TId> {
    const source = schema as unknown as Record<string, unknown>;
    const rawProps = source.properties;
    const sourceProps = isRecord(rawProps)
      ? rawProps
      : {};

    return {
      ...source,
      '$id': newId,
      'properties': {
        ...sourceProps,
        ...(additionalProperties as Record<string, unknown>)
      }
    } as unknown as ExtendSchemaType<TSchema, TAdditional, TId>;
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
    const props = schema.properties;

    if (props === null || typeof props !== 'object' || Array.isArray(props)) {
      return {};
    }

    const result: Record<string, unknown> = {};

    for (const [
      key,
      propSchema
    ] of Object.entries(props as Record<string, unknown>)) {
      if (typeof propSchema !== 'object' || propSchema === null) {
        continue;
      }
      const propertySchema = propSchema as Record<string, unknown>;

      if ('default' in propertySchema) {
        result[key] = structuredClone(propertySchema.default);
      } else if (propertySchema.type === 'object' && propertySchema.properties !== undefined) {
        const nested = Compose.getDefaults(propertySchema);

        if (Object.keys(nested).length > 0) {
          result[key] = nested;
        }
      }
    }

    return result;
  }

  /**
   * Combine multiple schemas using allOf (TypeScript intersection semantics).
   *
   * InferType<typeof result> will produce the intersection of all constituent types.
   * Runtime validation checks all schemas against the data.
   *
   * @example
   * const PersonWithAddress = Compose.intersection(
   *   [PersonSchema, AddressSchema] as const,
   *   'https://example.io/PersonWithAddress'
   * );
   * type PersonWithAddress = InferType<typeof PersonWithAddress>;
   */
  public static intersection<
    TSchemas extends ReadonlyArray<Record<string, unknown>>,
    TId extends string
  >(schemas: TSchemas, newId: TId): IntersectionSchemaInterface<TSchemas, TId> {
    return {
      '$id': newId,
      'allOf': schemas
    } as unknown as IntersectionSchemaInterface<TSchemas, TId>;
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
    TUnion extends unknown,
    TDiscriminant extends string,
    TValue extends string
  >(
    value: TUnion,
    discriminant: TDiscriminant,
    expected: TValue
  ): value is Extract<TUnion, Record<TDiscriminant, TValue>> {
    return (
      typeof value === 'object'
      && value !== null
      && (value as Record<string, unknown>)[discriminant] === expected
    );
  }

  /**
   * Derive a schema with specified properties removed.
   * Removed required fields are also dropped from `required`.
   * Produces a valid JSON Schema; `InferType<typeof result>` excludes the omitted props.
   *
   * @example
   * const PublicUserSchema = Compose.omit(UserSchema, ['passwordHash'] as const, 'https://myapp.io/PublicUser');
   */
  public static omit<
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TKeys extends string,
    TId extends string
  >(schema: TSchema, keys: readonly TKeys[], newId: TId): OmitSchemaInterface<TSchema, TKeys, TId> {
    const source = schema as unknown as Record<string, unknown>;
    const rawOmitProps = source.properties;
    const sourceProps = isRecord(rawOmitProps)
      ? { ...rawOmitProps }
      : {};
    const sourceRequired = Array.isArray(source.required) ? (source.required as string[]) : [];

    const keysToOmit = new Set(keys as readonly string[]);

    for (const key of keys) {
      delete sourceProps[key];
    }
    const remainingRequired = sourceRequired.filter((requiredKey) => {
      return !keysToOmit.has(requiredKey);
    });

    const result: Record<string, unknown> = {
      '$id': newId,
      'properties': sourceProps,
      'type': 'object'
    };

    if (remainingRequired.length > 0) {
      result.required = remainingRequired;
    }

    return result as unknown as OmitSchemaInterface<TSchema, TKeys, TId>;
  }

  /**
   * Derive a schema where all properties are optional (no `required` array).
   * Produces a valid JSON Schema; `InferType<typeof result>` gives all-optional props.
   *
   * @example
   * const PatchUserSchema = Compose.partial(UserSchema, 'https://myapp.io/PatchUser');
   * type PatchUser = InferType<typeof PatchUserSchema>; // { name?: string; email?: string }
   */
  public static partial<
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TId extends string
  >(schema: TSchema, newId: TId): PartialSchemaType<TSchema, TId> {
    const source = { ...(schema as unknown as Record<string, unknown>) };

    delete source.required;
    source.$id = newId;

    return source as unknown as PartialSchemaType<TSchema, TId>;
  }

  /**
   * Derive a schema with only the specified property keys.
   * Non-picked required fields are dropped from `required`.
   * Produces a valid JSON Schema; `InferType<typeof result>` gives only the picked props.
   *
   * @example
   * const UserSummarySchema = Compose.pick(UserSchema, ['id', 'name'] as const, 'https://myapp.io/UserSummary');
   */
  public static pick<
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TKeys extends string,
    TId extends string
  >(schema: TSchema, keys: readonly TKeys[], newId: TId): PickSchemaInterface<TSchema, TKeys, TId> {
    const source = schema as unknown as Record<string, unknown>;
    const rawPickProps = source.properties;
    const sourceProps = isRecord(rawPickProps)
      ? rawPickProps
      : {};
    const sourceRequired = Array.isArray(source.required) ? (source.required as string[]) : [];

    const pickedProps: Record<string, unknown> = {};

    for (const key of keys) {
      if (key in sourceProps) {
        pickedProps[key] = sourceProps[key];
      }
    }

    const pickedRequired = sourceRequired.filter((requiredKey) => {
      return (keys as readonly string[]).includes(requiredKey);
    });

    const result: Record<string, unknown> = {
      '$id': newId,
      'properties': pickedProps,
      'type': 'object'
    };

    if (pickedRequired.length > 0) {
      result.required = pickedRequired;
    }

    return result as unknown as PickSchemaInterface<TSchema, TKeys, TId>;
  }

  /**
   * Derive a schema where every declared property is required.
   * Produces a valid JSON Schema; `InferType<typeof result>` gives all-required props.
   *
   * @example
   * const StrictUserSchema = Compose.required(UserSchema, 'https://myapp.io/StrictUser');
   */
  public static required<
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TId extends string
  >(schema: TSchema, newId: TId): RequiredSchemaType<TSchema, TId> {
    const source = schema as unknown as Record<string, unknown>;
    const rawRequiredProps = source.properties;
    const props = isRecord(rawRequiredProps)
      ? rawRequiredProps
      : {};

    return {
      ...source,
      '$id': newId,
      'required': Object.keys(props)
    } as unknown as RequiredSchemaType<TSchema, TId>;
  }
}
