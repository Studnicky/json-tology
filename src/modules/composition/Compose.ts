/**
 * Schema composition utilities
 *
 * Functions that derive new schemas from existing ones.
 * All functions produce correct JSON Schemas at runtime so the runtime schema
 * stays in sync with the TypeScript return type — no manual annotation needed.
 */

import type {
  AnnotatedEdgeSchemaType,
  ComplementOfSchemaType,
  DiscriminatedUnionSchemaType,
  DisjointWithSchemaType,
  IntersectionSchemaType,
  OmitSchemaType,
  PickSchemaType,
  SubClassOfSchemaType
} from '../../types/Compose.js';
import type {
  ExtendSchemaType,
  ExtractPropertiesType,
  PartialSchemaType,
  RequiredSchemaType,
  ValidateDiscriminatedVariantsType,
  ValidateEquivalentOptionsType,
  ValidateIntersectionIdType,
  ValidateSubClassOfBodyType
} from '../../types/Compose.js';
import type {
  RestrictionDescriptorType, RestrictionKindType, RestrictionRefType, TypedRestrictionRefType
} from '../../types/Restriction.js';
import type { ValidateSchemaType } from '../../types/SchemaValidation.js';
import {
  isRestrictionRef, RESTRICTION_TAG
} from '../../types/Restriction.js';
import { DataType } from '../data/DataType.js';
import { Brand } from '../../modules/data/Brand.js';
import {
  CLASS_AXIOM_BODY_SKIP_KEYS,
  EXTEND_SKIP_KEYS,
  RESTRICTIONS_KEY
} from '../../constants/COMPOSITION.js';

function makeRestriction<
  TKind extends RestrictionKindType,
  TProp extends string,
  TValue extends boolean | number | string
>(
  kind: TKind,
  onProperty: TProp,
  value: TValue
): TypedRestrictionRefType<TKind, TProp, TValue> {
  return {
    [RESTRICTION_TAG]: {
      kind,
      onProperty,
      value
    }
  };
}

/**
 * Schema composition utilities.
 *
 * Static methods that derive new JSON Schema documents from existing ones.
 * Every method produces a valid JSON Schema at runtime so the runtime schema
 * stays in sync with the TypeScript return type — no manual annotation needed.
 *
 * @remarks
 * All composition operations are pure functions. They do not mutate their
 * inputs and produce plain JSON-serialisable objects. The resulting schemas
 * are compatible with JSON Schema 2020-12 and may be registered with
 * {@link SchemaRegistry} directly.
 *
 * @example
 * ```ts
 * const AdminSchema = Compose.extend(UserSchema, { role: { type: 'string' } } as const, 'https://myapp.io/Admin');
 * const PublicSchema = Compose.omit(UserSchema, ['passwordHash'] as const, 'https://myapp.io/PublicUser');
 * ```
 *
 * @category Composition
 * @since 0.1.0
 * @see {@link SchemaRegistry}
 * @group Composition
 */
export class Compose {
  /**
   * Restrict a property so all values satisfy `rangeClassIri`.
   *
   * Compose with `Compose.subClassOf` to attach the restriction to a class. The
   * OWL TBox emits `_:b{n} rdf:type owl:Restriction; owl:onProperty <propIri>;
   * owl:allValuesFrom <rangeClassIri>` and links the class via `rdfs:subClassOf`.
   */
  public static allValuesFrom<TProp extends string, TRange extends string>(
    propIri: TProp,
    rangeClassIri: TRange
  ): TypedRestrictionRefType<'allValuesFrom', TProp, TRange> {
    return makeRestriction('allValuesFrom', propIri, rangeClassIri);
  }

  /**
   * Declare a property as an annotated edge (RDF 1.2 triple-term pattern).
   *
   * An annotated edge carries a base triple `s predicate o` plus one annotation
   * quad per entry in `annotations`. Each annotation quad has the base triple as
   * its subject (a Quad-typed term / `<< s p o >>`), an annotation predicate,
   * and an annotation value. All quads share the same named graph.
   *
   * ABox emission requires a `graphIri` — supplying none raises an error.
   *
   * `predicate` and every `$ref` in `annotations` are preserved as literal types
   * so `$ref` resolution and graph keying operate on the concrete IRI.
   *
   * @example
   * const ReviewsBook = Compose.annotatedEdge({
   *   predicate: 'https://bookstore.example/reviews',
   *   targetRef: BookSchema.$id,
   *   annotations: {
   *     ratingGiven:       { $ref: RatingScoreSchema.$id },
   *     verifiedPurchase:  { $ref: VerifiedPurchaseSchema.$id },
   *   },
   * });
   */
  public static annotatedEdge<
    const TPredicate extends string,
    const TTargetRef extends string,
    const TAnnotations extends Record<string, { readonly '$ref': string }>
  >(options: {
    readonly 'annotations': TAnnotations;
    readonly 'predicate': TPredicate;
    readonly 'targetRef': TTargetRef;
  }): AnnotatedEdgeSchemaType<TPredicate, TTargetRef, TAnnotations> {
    return {
      'jt:annotatedEdge': {
        'annotations': options.annotations,
        'predicate': options.predicate,
        'targetRef': options.targetRef
      }
    };
  }

  /**
   * Derive a schema with additional properties merged in via allOf + $ref.
   * The parent schema is referenced via $ref in the first allOf entry;
   * the additions are the second entry with type: 'object' and any new properties.
   * When both parent and child carry `jt:config`, child keys win per-key.
   *
   * @example
   * const AdminSchema = Compose.extend(
   *   UserSchema,
   *   { role: { type: 'string', enum: ['admin', 'superadmin'] } } as const,
   *   'https://myapp.io/Admin'
   * );
   */
  private static buildAdditionsProperties(additions: Record<string, unknown>): Record<string, unknown> | undefined {
    if (DataType.isRecord(additions.properties)) {
      return additions.properties;
    }

    const propKeys = Object.keys(additions).filter((k: string): boolean => {
      return k !== '$id' && k !== 'type' && k !== 'required' && k !== 'jt:config';
    });

    if (propKeys.length === 0) {
      return undefined;
    }

    const props: Record<string, unknown> = {};

    for (const k of propKeys) {
      props[k] = additions[k];
    }

    return props;
  }

  /**
   * Restrict a property to exactly `n` values.
   *
   * Compose with `Compose.subClassOf` to attach the restriction to a class. The
   * OWL TBox emits `_:b{n} rdf:type owl:Restriction; owl:onProperty <propIri>;
   * owl:cardinality "n"^^xsd:nonNegativeInteger`.
   */
  public static cardinality<TProp extends string, TN extends number>(
    propIri: TProp,
    n: TN
  ): TypedRestrictionRefType<'cardinality', TProp, TN> {
    return makeRestriction('cardinality', propIri, n);
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
  private static collectAllOfDefaults(allOf: unknown[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const member of allOf) {
      if (member === null || typeof member !== 'object' || Array.isArray(member)) {
        continue;
      }
      const memberSchema = member as Record<string, unknown>;

      // Skip pure $ref members — no properties to traverse without a registry.
      if (typeof memberSchema.$ref === 'string' && memberSchema.properties === undefined) {
        continue;
      }

      const memberDefaults = Compose.getDefaults(memberSchema);

      for (const [
        key,
        val
      ] of Object.entries(memberDefaults)) {
        merged[key] = val;
      }
    }

    return merged;
  }

  private static collectPropertyDefaults(props: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [
      key,
      propSchema
    ] of Object.entries(props)) {
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
   * Declare a class as the OWL complement of another class.
   *
   * The result is a schema that validates anything which is NOT an instance of `other`,
   * plus any keywords supplied in `body`. The TBox emission carries `owl:complementOf`
   * pointing at `other`.
   *
   * Wire shape: `{ $id, not: { $ref: other.$id }, ...body }`. Stays a valid
   * JSON Schema 2020-12 document — `not` is a native keyword.
   *
   * @example
   * const NonHumanRace = Compose.complementOf(HumanRaceSchema, {
   *   $id: 'aonprd:NonHumanRace',
   *   type: 'object'
   * });
   */
  public static complementOf<
    TOther extends { readonly '$id': string },
    const TBody extends Record<string, unknown> & { readonly '$id': string }
  >(other: TOther, body: ValidateSchemaType<TBody>): ComplementOfSchemaType<TOther, TBody> {
    const result: Record<string, unknown> = {
      '$id': body.$id,
      'not': { '$ref': other.$id }
    };

    for (const [
      key,
      val
    ] of Object.entries(body as Record<string, unknown>)) {
      if (!CLASS_AXIOM_BODY_SKIP_KEYS.has(key) && key !== 'not') {
        result[key] = val;
      }
    }

    return Brand.cast<ComplementOfSchemaType<TOther, TBody>>(result);
  }

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
    variants: TVariants & ValidateDiscriminatedVariantsType<TVariants, TDiscriminator>,
    newId: TId
  ): DiscriminatedUnionSchemaType<TDiscriminator, TVariants, TId> {
    return {
      '$id': newId,
      'discriminator': { 'propertyName': discriminatorProperty },
      'oneOf': variants
    };
  }

  /**
   * Declare a class as disjoint with another class.
   *
   * Two classes are disjoint when they share no instances. The result is a schema
   * carrying body keywords plus the `disjointWith` annotation pointing at `other.$id`.
   * In the OWL TBox, `owl:disjointWith` links the two classes.
   *
   * Wire shape: `{ $id, disjointWith: other.$id, ...body }`. The `disjointWith`
   * annotation is a json-tology graph keyword (not a JSON Schema validation keyword);
   * it's projected into the OWL/SHACL output.
   *
   * @example
   * const Armor = Compose.disjointWith(WeaponSchema, {
   *   $id: 'aonprd:Armor',
   *   type: 'object',
   *   properties: { ac: { type: 'integer' } }
   * });
   */
  public static disjointWith<
    TOther extends { readonly '$id': string },
    const TBody extends Record<string, unknown> & { readonly '$id': string }
  >(other: TOther, body: ValidateSchemaType<TBody>): DisjointWithSchemaType<TOther, TBody> {
    const result: Record<string, unknown> = {
      '$id': body.$id,
      'disjointWith': other.$id
    };

    for (const [
      key,
      val
    ] of Object.entries(body as Record<string, unknown>)) {
      if (!CLASS_AXIOM_BODY_SKIP_KEYS.has(key) && key !== 'disjointWith') {
        result[key] = val;
      }
    }

    return Brand.cast<DisjointWithSchemaType<TOther, TBody>>(result);
  }

  /**
   * Creates a thin $ref alias giving a domain-distinct name to an existing schema.
   *
   * Use to create semantically distinct names for structurally equivalent types
   * (e.g. `PrimaryIsbn` is-a `Isbn`). In OWL TBox output, the two schemas are linked
   * via `owl:equivalentClass`.
   *
   * @example
   * const PrimaryIsbn = Compose.equivalent(IsbnSchema, {
   *   $id: 'urn:bookstore:PrimaryIsbn',
   *   description: 'The canonical ISBN used for catalog lookup.'
   * });
   */
  public static equivalent<
    TSource extends { readonly '$id': string },
    const TOptions extends {
      readonly '$id': string;
      readonly 'description'?: string;
      readonly 'examples'?: readonly unknown[];
      readonly 'title'?: string;
    }
  >(
    source: TSource,
    options: TOptions & ValidateEquivalentOptionsType<TSource, TOptions>
  ): {
    readonly '$id': TOptions['$id'];
    readonly '$ref': TSource['$id'];
    readonly 'description'?: string;
    readonly 'examples'?: readonly unknown[];
    readonly 'title'?: string;
  } {
    const result: Record<string, unknown> = {
      '$id': options.$id,
      '$ref': source.$id
    };

    if (options.description !== undefined) {
      result.description = options.description;
    }
    if (options.title !== undefined) {
      result.title = options.title;
    }
    if (options.examples !== undefined) {
      result.examples = options.examples;
    }

    return result as {
      readonly '$id': TOptions['$id'];
      readonly '$ref': TSource['$id'];
      readonly 'description'?: string;
      readonly 'examples'?: readonly unknown[];
      readonly 'title'?: string;
    };
  }

  public static extend<
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TAdditional extends Record<string, unknown>,
    TId extends string
  >(
    schema: TSchema,
    additionalProperties: ValidateSchemaType<TAdditional>,
    newId: TId
  ): ExtendSchemaType<TSchema, TAdditional, TId> {
    const source: Record<string, unknown> = schema;
    const parentId = source.$id as string;
    const additions = additionalProperties as Record<string, unknown>;

    // Build the additions sub-schema (the child's own structure declaration)
    const additionsSchema: Record<string, unknown> = { 'type': 'object' };
    const addedProps = Compose.buildAdditionsProperties(additions);

    if (addedProps !== undefined) {
      additionsSchema.properties = addedProps;
    }

    if (Array.isArray(additions.required)) {
      additionsSchema.required = additions.required;
    }

    Compose.mergeJtConfig(source, additions, additionsSchema);

    const child: Record<string, unknown> = {
      '$id': newId,
      'allOf': [
        { '$ref': parentId },
        additionsSchema
      ]
    };

    for (const [
      key,
      val
    ] of Object.entries(additions)) {
      if (!EXTEND_SKIP_KEYS.has(key)) {
        child[key] = val;
      }
    }

    return Brand.cast<ExtendSchemaType<TSchema, TAdditional, TId>>(child);
  }

  public static getDefaults(schema: Record<string, unknown>): Record<string, unknown> {
    const props = schema.properties;
    const hasNoOwnProperties = props === null || typeof props !== 'object' || Array.isArray(props);

    // allOf-composed schema: no own properties — collect from each inline member.
    // $ref-only members (e.g. { $ref: 'urn:...' }) cannot be resolved without a
    // registry and are skipped; only inline members with a `properties` key are
    // traversed. Later members override earlier on key conflict.
    if (hasNoOwnProperties && Array.isArray(schema.allOf)) {
      return Compose.collectAllOfDefaults(schema.allOf as unknown[]);
    }

    if (hasNoOwnProperties) {
      return {};
    }

    return Compose.collectPropertyDefaults(props as Record<string, unknown>);
  }

  /**
   * Restrict a property to a fixed value (`owl:hasValue`).
   *
   * Compose with `Compose.subClassOf` to attach the restriction. The OWL TBox
   * emits `_:b{n} rdf:type owl:Restriction; owl:onProperty <propIri>;
   * owl:hasValue <literal>`. Strings, numbers, and booleans are emitted as
   * typed literals.
   */
  public static hasValue<TProp extends string, TValue extends boolean | number | string>(
    propIri: TProp,
    value: TValue
  ): TypedRestrictionRefType<'hasValue', TProp, TValue> {
    return makeRestriction('hasValue', propIri, value);
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
  >(
    schemas: TSchemas,
    newId: TId & ValidateIntersectionIdType<TSchemas, TId>
  ): IntersectionSchemaType<TSchemas, TId> {
    return {
      '$id': newId,
      'allOf': schemas
    };
  }

  /**
   * Restrict a property to at most `n` values (`owl:maxCardinality`).
   */
  public static maxCardinality<TProp extends string, TN extends number>(
    propIri: TProp,
    n: TN
  ): TypedRestrictionRefType<'maxCardinality', TProp, TN> {
    return makeRestriction('maxCardinality', propIri, n);
  }

  private static mergeJtConfig(
    source: Record<string, unknown>,
    additions: Record<string, unknown>,
    additionsSchema: Record<string, unknown>
  ): void {
    const parentConfig = source['jt:config'];
    const childConfig = additions['jt:config'];

    if (DataType.isRecord(parentConfig) || DataType.isRecord(childConfig)) {
      additionsSchema['jt:config'] = {
        ...(DataType.isRecord(parentConfig) && parentConfig),
        ...(DataType.isRecord(childConfig) && childConfig)
      };
    }
  }

  /**
   * Restrict a property to at least `n` values (`owl:minCardinality`).
   */
  public static minCardinality<TProp extends string, TN extends number>(
    propIri: TProp,
    n: TN
  ): TypedRestrictionRefType<'minCardinality', TProp, TN> {
    return makeRestriction('minCardinality', propIri, n);
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
   * `jt:config` is carried from the source schema unchanged.
   *
   * @example
   * const PublicUserSchema = Compose.omit(UserSchema, ['passwordHash'] as const, 'https://myapp.io/PublicUser');
   */
  public static omit<
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TKeys extends keyof ExtractPropertiesType<TSchema> & string,
    TId extends string
  >(schema: TSchema, keys: readonly TKeys[], newId: TId): OmitSchemaType<TSchema, TKeys, TId> {
    const source: Record<string, unknown> = schema;
    const rawOmitProps = source.properties;
    const sourceProps = DataType.isRecord(rawOmitProps)
      ? { ...rawOmitProps }
      : {};
    const sourceRequired = Array.isArray(source.required) ? (source.required as string[]) : [];

    const keysToOmit = new Set(keys as readonly string[]);

    for (const key of keys) {
      delete sourceProps[key];
    }
    const remainingRequired = sourceRequired.filter((requiredKey: string): boolean => {
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

    if (source['jt:config'] !== undefined) {
      result['jt:config'] = source['jt:config'];
    }

    return Brand.cast<OmitSchemaType<TSchema, TKeys, TId>>(result);
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
    const source: Record<string, unknown> = { ...schema };

    delete source.required;
    source.$id = newId;

    return Brand.cast<PartialSchemaType<TSchema, TId>>(source);
  }

  /**
   * Derive a schema with only the specified property keys.
   * Non-picked required fields are dropped from `required`.
   * Produces a valid JSON Schema; `InferType<typeof result>` gives only the picked props.
   * `jt:config` is carried from the source schema unchanged.
   *
   * @example
   * const UserSummarySchema = Compose.pick(UserSchema, ['id', 'name'] as const, 'https://myapp.io/UserSummary');
   */
  public static pick<
    TSchema extends Record<string, unknown> & { readonly '$id': string; },
    TKeys extends keyof ExtractPropertiesType<TSchema> & string,
    TId extends string
  >(schema: TSchema, keys: readonly TKeys[], newId: TId): PickSchemaType<TSchema, TKeys, TId> {
    const source: Record<string, unknown> = schema;
    const rawPickProps = source.properties;
    const sourceProps = DataType.isRecord(rawPickProps)
      ? rawPickProps
      : {};
    const sourceRequired = Array.isArray(source.required) ? (source.required as string[]) : [];

    const pickedProps: Record<string, unknown> = {};

    for (const key of keys) {
      if (key in sourceProps) {
        pickedProps[key] = sourceProps[key];
      }
    }

    const pickedRequired = sourceRequired.filter((requiredKey: string): boolean => {
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

    if (source['jt:config'] !== undefined) {
      result['jt:config'] = source['jt:config'];
    }

    return Brand.cast<PickSchemaType<TSchema, TKeys, TId>>(result);
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
    const source: Record<string, unknown> = schema;
    const rawRequiredProps = source.properties;
    const props = DataType.isRecord(rawRequiredProps)
      ? rawRequiredProps
      : {};

    return Brand.cast<RequiredSchemaType<TSchema, TId>>({
      ...source,
      '$id': newId,
      'required': Object.keys(props)
    });
  }

  /**
   * Restrict a property so at least one value satisfies `rangeClassIri`.
   *
   * Compose with `Compose.subClassOf` to attach the restriction to a class. The
   * OWL TBox emits `_:b{n} rdf:type owl:Restriction; owl:onProperty <propIri>;
   * owl:someValuesFrom <rangeClassIri>`.
   */
  public static someValuesFrom<TProp extends string, TRange extends string>(
    propIri: TProp,
    rangeClassIri: TRange
  ): TypedRestrictionRefType<'someValuesFrom', TProp, TRange> {
    return makeRestriction('someValuesFrom', propIri, rangeClassIri);
  }

  /**
   * Declare a class as a subclass of one or more parent classes.
   *
   * Produces an `allOf + $ref` schema referencing each parent, with body keywords
   * carried in a trailing object schema. The TBox emits `rdfs:subClassOf` for each parent.
   *
   * Differs from `Compose.extend`:
   *   - `extend` is property-merging and accepts a single parent.
   *   - `subClassOf` is taxonomic (explicit subclass intent) and accepts one OR
   *     multiple parents.
   *
   * @example
   * const Weapon = Compose.subClassOf(EquipmentSchema, {
   *   $id: 'aonprd:Weapon',
   *   type: 'object',
   *   properties: { damage: { type: 'string' } }
   * });
   *
   * const ScopedAuthorityToken = Compose.subClassOf(
   *   [BearerTokenSchema, ScopedTokenSchema],
   *   {
   *     $id: 'urn:auth:ScopedAuthorityToken',
   *     type: 'object',
   *     properties: { scope: { type: 'string' } }
   *   }
   * );
   */
  public static subClassOf<
    TKind extends RestrictionKindType,
    TProp extends string,
    TValue extends boolean | number | string,
    const TBody extends Record<string, unknown> & { readonly '$id': string }
  >(
    parent: TypedRestrictionRefType<TKind, TProp, TValue>,
    body: ValidateSchemaType<TBody>
  ): TBody extends { readonly 'jt:restrictions': infer TExisting extends readonly unknown[] }
    ? Omit<TBody, 'jt:restrictions'> & {
      readonly 'jt:restrictions': readonly [
        ...TExisting,
        { readonly 'kind': TKind;
          readonly 'onProperty': TProp;
          readonly 'value': TValue }
      ];
    }
    : TBody & {
      readonly 'jt:restrictions': readonly [
        { readonly 'kind': TKind;
          readonly 'onProperty': TProp;
          readonly 'value': TValue }
      ];
    };
  public static subClassOf<
    TParent extends ReadonlyArray<{ readonly '$id': string }> | { readonly '$id': string },
    const TBody extends Record<string, unknown> & { readonly '$id': string }
  >(
    parent: TParent,
    body: ValidateSchemaType<TBody> & ValidateSubClassOfBodyType<TParent, TBody>
  ): SubClassOfSchemaType<TParent, TBody>;
  public static subClassOf<
    TBody extends Record<string, unknown> & { readonly '$id': string }
  >(
    parent: ReadonlyArray<{ readonly '$id': string }> | RestrictionRefType | { readonly '$id': string },
    body: TBody
  ): SubClassOfSchemaType<ReadonlyArray<{ readonly '$id': string }> | { readonly '$id': string }, TBody> | TBody {
    if (isRestrictionRef(parent)) {
      const bodyCopy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
      const existing = bodyCopy[RESTRICTIONS_KEY];
      const list: RestrictionDescriptorType[] = Array.isArray(existing)
        ? [...(existing as RestrictionDescriptorType[])]
        : [];

      list.push(parent[RESTRICTION_TAG]);
      bodyCopy[RESTRICTIONS_KEY] = list;

      return bodyCopy as TBody;
    }

    const parents = Array.isArray(parent)
      ? (parent as ReadonlyArray<{ readonly '$id': string }>)
      : [parent as { readonly '$id': string }];

    const allOf: Array<Record<string, unknown>> = [];

    for (const parentSchema of parents) {
      allOf.push({ '$ref': parentSchema.$id });
    }

    const bodySchema: Record<string, unknown> = {};

    for (const [
      key,
      val
    ] of Object.entries(body as Record<string, unknown>)) {
      if (!CLASS_AXIOM_BODY_SKIP_KEYS.has(key)) {
        bodySchema[key] = val;
      }
    }

    if (Object.keys(bodySchema).length > 0) {
      allOf.push(bodySchema);
    }

    return Brand.cast<SubClassOfSchemaType<ReadonlyArray<{ readonly '$id': string }> | { readonly '$id': string }, TBody>>({
      '$id': body.$id,
      allOf
    });
  }
}

