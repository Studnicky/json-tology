import type { Options as AjvOptions } from 'ajv';
import type { RegistryLogger } from './registry.js';
import type { EntityBuilderOptions } from './builder.js';

export interface JsonTologyOptions {
  /**
   * Base IRI for the ontology and schema namespace.
   * Used as the ontology document IRI and as the root for derived property IRIs.
   *
   * @example 'https://myapp.io'
   */
  baseIRI: string;

  /**
   * Schemas to register at construction time.
   * Additional schemas can be registered later via .register().
   */
  schemas?: ReadonlyArray<Record<string, unknown>>;

  /**
   * Additional prefix declarations for ontology output.
   * owl, rdf, rdfs, and xsd are always included.
   */
  prefixes?: Record<string, string>;

  /** AJV options forwarded to the registry */
  ajv?: AjvOptions;

  /** Logger for duplicate/conflict warnings */
  logger?: RegistryLogger;

  /**
   * When true, AJV coerces types during validation and entity building
   * (e.g. 123 accepted where "123" is expected, and vice versa).
   */
  coerce?: boolean;

  /** EntityBuilder behaviour options */
  builder?: EntityBuilderOptions;
}
