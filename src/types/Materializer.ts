import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { LoggerInterface } from '../interfaces/LoggerInterface.js';
import type { AboxProjectorInterface } from '../interfaces/AboxProjectorInterface.js';
import type { AboxOptionsType } from './AboxOptionsType.js';

export type MaterializationResultType = {
  'abox': QuadInterface[];
  'errors': string[];
  'valid': boolean;
  'value': unknown;
};

export type MaterializerRunOptionsType = {
  /** Overrides passed through to ABox projection when baseIri is set. */
  'aboxOptions'?: AboxOptionsType;
  /** Base IRI for generated quad subjects; ABox projection runs only when set. */
  'baseIri'?: string;
  /** When true, synthesizes zero values for required properties instead of validating against provided data. */
  'synthesizeDefaults'?: boolean;
};

export type MaterializerOptionsType = {
  /**
   * ABox projector injected by the facade (JsonTology) so the materialization
   * layer need not import rdf/ directly. The facade passes the concrete
   * `Projection`, which satisfies AboxProjectorInterface; this inverts the
   * materialization → rdf dependency. Required for ABox projection.
   */
  'aboxProjector'?: AboxProjectorInterface;
  /**
   * Logger for observability. Defaults to SILENT_LOGGER (no-op).
   * Receives warn on materialization failure and error on unresolvable $ref.
   */
  'logger'?: LoggerInterface;
  /**
   * When true, extra keys not declared in schema properties are allowed through
   * even if the schema has additionalProperties: false.
   * Default: false.
   */
  'passAdditionalProperties'?: boolean;
};
