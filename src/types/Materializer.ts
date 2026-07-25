import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { LoggerInterface } from '../interfaces/LoggerInterface.js';
import type { AboxProjectorInterface } from '../interfaces/AboxProjectorInterface.js';
import type { AboxOptionsType } from './AboxOptionsType.js';
import type { InferType } from './Schema.js';
import type {
  MATERIALIZER_OPTIONS_SCHEMA, MATERIALIZER_RUN_OPTIONS_SCHEMA
} from '../constants/SCHEMAS.js';

export type MaterializationResultType = {
  'abox': QuadInterface[];
  'errors': string[];
  'valid': boolean;
  'value': unknown;
};

export type MaterializerRunOptionsType = InferType<typeof MATERIALIZER_RUN_OPTIONS_SCHEMA> & {
  /** Overrides passed through to ABox projection when baseIri is set. */
  'aboxOptions'?: AboxOptionsType;
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
} & InferType<typeof MATERIALIZER_OPTIONS_SCHEMA>;
