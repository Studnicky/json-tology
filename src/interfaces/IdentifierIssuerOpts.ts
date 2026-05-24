/**
 * Construction options for `IdentifierIssuer`.
 *
 * Every field is optional; defaults preserve the previous positional contract.
 *
 * - `prefix` — String prepended to every issued identifier
 *   (default `'_:b'`, the RDF blank-node syntax).
 * - `existingMap` — Seed mapping. Used by `clone()` to fork an issuer with
 *   the same issued history.
 * - `counter` — Counter seed. Used by `clone()` to preserve the issuance
 *   position when forking.
 */
export interface IdentifierIssuerOptsInterface {
  'counter'?: number;
  'existingMap'?: Map<string, string>;
  'prefix'?: string;
}
