/**
 * RefDecoderInterface — static contract for RefDecoder.
 *
 * Captures the public static surface of RefDecoder as a named type so that
 * consumers can depend on the interface rather than the concrete class.
 */

import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { RefDecoderRegistryType } from '../types/RefDecoderRegistry.js';

export interface RefDecoderInterface {
  /**
   * Apply registered Transform decoders along every `$ref` boundary in the
   * graph rooted at `graph`.
   *
   * @param graph - Canonical graph for the root schema being instantiated.
   * @param value - Value already coerced through validation.
   * @param registry - Cross-schema lookup callbacks.
   * @returns The walked value (same reference as `value` for objects/arrays).
   */
  run(
    graph: SchemaGraphInterface,
    value: unknown,
    registry: RefDecoderRegistryType
  ): unknown;
}
