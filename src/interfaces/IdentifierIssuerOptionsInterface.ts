import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Construction options for `IdentifierIssuer`.
 *
 * Every field is optional; defaults preserve the previous positional contract.
 *
 * - `prefix` — String prepended to every issued identifier
 *   (default `'_:b'`, the RDF blank-node syntax).
 * - `existingMap` — Seed mapping (read-only). Used by `clone()` to fork an
 *   issuer with the same issued history. The constructor copies entries into
 *   a new internal `Map` and never mutates the passed map.
 * - `counter` — Counter seed. Used by `clone()` to preserve the issuance
 *   position when forking.
 */
export interface IdentifierIssuerOptionsInterface {
  'counter'?: NumberValueEntity.Type;
  'existingMap'?: ReadonlyMap<string, string>;
  'prefix'?: StringValueEntity.Type;
}
