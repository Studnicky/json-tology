/**
 * Entity Builder
 *
 * Builds entity instances using JSON schema defaults.
 * Uses the registry's AJV (useDefaults: true) — no separate schema storage;
 * the registry is the single source of truth for all schemas.
 *
 * Accepts the schema object directly so the return type is inferred
 * automatically from the schema via FromSchema<TSchema>.
 *
 * Non-required properties with no value and no default are set to undefined
 * explicitly — they are never omitted from the output.
 */

import type { ValidateFunction } from 'ajv';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';
import type { SchemaRegistry } from './SchemaRegistry.js';
import type { EntityBuilderOptions } from '../interfaces/builder.js';

export type { EntityBuilderOptions } from '../interfaces/builder.js';
export type { Infer, InferSchema } from '../types/schema.js';

export class EntityBuilder {
  /** Compiled default-filling validators, keyed by schemaId */
  private readonly defaultFillers = new Map<string, ValidateFunction>();

  public constructor(
    private readonly registry: SchemaRegistry,
    private readonly options: EntityBuilderOptions = {},
  ) {}

  /**
   * Build an entity instance with schema defaults.
   *
   * The schema is auto-registered (idempotent) so a prior registry.register()
   * call is not required when using this method.
   *
   * The return type is inferred from the schema — no manual type annotation needed:
   *
   * @example
   * const user = builder.build(UserSchema, { name: 'Alice' });
   * // user is typed as FromSchema<typeof UserSchema>
   *
   * @param schema  - JSON Schema object with $id (as const)
   * @param partial - Partial entity values; merged with schema defaults
   * @returns Fully typed entity instance with all defaults applied
   */
  // Typed overload: infers return type from the schema via FromSchema<TSchema>
  public build<TSchema extends JSONSchema & { readonly $id: string }>(
    schema: TSchema,
    partial?: Partial<FromSchema<TSchema>>,
  ): FromSchema<TSchema>;

  // Implementation: uses loose types to avoid triggering FromSchema's deep
  // recursive type instantiation inside the function body.
  public build(
    schema: Record<string, unknown> & { $id: string },
    partial?: Record<string, unknown>,
  ): unknown {
    // Auto-register — idempotent, safe to call on every build
    this.registry.register(schema);

    const schemaId = schema.$id;

    // Shallow-clone so we never mutate the caller's object.
    // registry.ajv mutates the working object in place to apply defaults.
    const instance: Record<string, unknown> = { ...(partial ?? {}) };

    // Extract property entries once — reused by preInit, applyDefaults, and fill.
    const propEntries = this.propertyEntries(schema);

    // Pre-initialise $ref properties to {} so AJV useDefaults can fill
    // their nested defaults (AJV only fills defaults on existing objects).
    this.preInitRefProperties(propEntries, instance);

    // Apply defaults (and optionally coerce types) via the registry's AJV.
    this.applyDefaults(schemaId, schema, instance);

    // Ensure every declared property key is present on the output.
    // Non-required properties with no default and no provided value become undefined.
    this.fillMissingAsUndefined(propEntries, instance);

    // Final validation
    const errors = this.validate(schemaId, schema, instance);
    if (errors.length > 0) {
      throw new Error(`Invalid ${schemaId}: ${errors.join('; ')}`);
    }

    return instance;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Extract [key, propSchema] entries from a schema's properties once. */
  private propertyEntries(
    schema: Record<string, unknown>,
  ): Array<[string, Record<string, unknown>]> {
    const props = schema['properties'];
    if (!props || typeof props !== 'object') return [];
    return Object.entries(props as Record<string, unknown>).filter(
      (entry): entry is [string, Record<string, unknown>] =>
        typeof entry[1] === 'object' && entry[1] !== null,
    );
  }

  private preInitRefProperties(
    propEntries: Array<[string, Record<string, unknown>]>,
    instance: Record<string, unknown>,
  ): void {
    for (const [key, propSchema] of propEntries) {
      if (key in instance) continue;
      if ('$ref' in propSchema) {
        instance[key] = {};
      }
    }
  }

  private applyDefaults(
    schemaId: string,
    schema: Record<string, unknown>,
    instance: Record<string, unknown>,
  ): void {
    let filler = this.defaultFillers.get(schemaId);
    if (!filler) {
      filler = this.registry.ajv.compile(schema) as ValidateFunction;
      this.defaultFillers.set(schemaId, filler);
    }
    (filler as ValidateFunction)(instance);
  }

  private fillMissingAsUndefined(
    propEntries: Array<[string, Record<string, unknown>]>,
    instance: Record<string, unknown>,
  ): void {
    for (const [key] of propEntries) {
      if (!(key in instance)) {
        instance[key] = undefined;
      }
    }
  }

  private validate(
    schemaId: string,
    schema: Record<string, unknown>,
    instance: Record<string, unknown>,
  ): string[] {
    if (this.options.passAdditionalProperties) {
      const relaxed = { ...schema };
      delete relaxed['$id'];
      delete relaxed['additionalProperties'];
      try {
        const validator = this.registry.ajv.compile(relaxed);
        const valid = validator(instance);
        if (!valid) {
          return (
            validator.errors?.map(
              (ajvError: { instancePath: string; message?: string }) =>
                `${ajvError.instancePath || 'root'}: ${ajvError.message}`,
            ) ?? ['Unknown validation error']
          );
        }
        return [];
      } catch (error) {
        return [`Failed to compile relaxed validator: ${error}`];
      }
    }

    return this.registry.validate(schemaId, instance);
  }
}
