import type { AboxProjectorInterface } from './AboxProjectorInterface.js';
import type { LoggerInterface } from './LoggerInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';

/** Options accepted by the {@link MaterializerInterface} constructor. */
export interface MaterializerOptionsInterface {
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
  'passAdditionalProperties'?: BooleanValueEntity.Type;
}
