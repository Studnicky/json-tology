/**
 * IdentifierIssuer — per-call blank-node counter.
 *
 * Each projector call (Projection.graph, Projection.abox, OwlProjection.graph,
 * ShaclProjection.graph) constructs its own IdentifierIssuer so that concurrent
 * serializations never share mutable counter state.
 *
 * Ported from the W3C RDF Dataset Canonicalization algorithm implementation in
 * the semantics/rdf-canonicalize package. The minimal surface needed here is
 * getId(existing?) for sequential bnode naming — clone(), hasId(), etc. are
 * retained for interface completeness and future use.
 *
 * @see https://w3c.github.io/rdf-canon/spec/#algorithm-0
 */

import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import type { IdentifierIssuerOptionsType } from '../../types/IdentifierIssuerOptionsType.js';

export class IdentifierIssuer implements IdentifierIssuerInterface {
  private counter: number;

  private readonly issued: Map<string, string>;

  // V8 Hidden Class Optimization: properties initialized in consistent order
  // so all IdentifierIssuer instances share the same hidden class, enabling
  // monomorphic property access throughout the projection pipeline.
  private readonly prefix: string;
  /**
   * Construct an issuer.
   *
   * All fields are optional. Defaults: `prefix: '_:b'` (RDF blank-node
   * syntax), no seeded mapping, counter starts at zero.
   *
   * `existingMap` and `counter` are primarily used by `clone()` to fork
   * an issuer with the same prefix, issued history, and counter position.
   *
   * @param options - Optional bag typed as {@link IdentifierIssuerOptionsType}:
   *   - `prefix` — string prepended to every issued identifier (default `'_:b'`).
   *   - `counter` — starting counter value (default `0`); used by `clone()`.
   *   - `existingMap` — seed mapping from existing identifiers to issued ids;
   *     used by `clone()` to preserve issuance history.
   */
  constructor(options?: IdentifierIssuerOptionsType) {
    this.prefix = options?.prefix ?? '_:b';
    this.counter = options?.counter ?? 0;
    this.issued = options?.existingMap
      ? new Map<string, string>(options.existingMap.entries())
      : new Map<string, string>();
  }
  /**
   * Create an independent copy with the same prefix, counter value, and
   * issued mappings. Mutations to the clone do not affect the original.
   *
   * @returns A new `IdentifierIssuer` snapshotting the current state.
   */
  clone(): IdentifierIssuer {
    return new IdentifierIssuer({
      'counter': this.counter,
      'existingMap': this.issued,
      'prefix': this.prefix
    });
  }

  /**
   * Number of identifiers issued so far (mapped or unmapped).
   */
  get count(): number {
    return this.counter;
  }

  /**
   * Issue (or retrieve) a deterministic identifier for `existing`.
   *
   * If `existing` is provided and has already been mapped, returns the
   * previously issued identifier. Otherwise issues a new identifier and
   * optionally records the mapping.
   *
   * Calling without `existing` always issues a new identifier without
   * creating a mapping — suitable for anonymous blank nodes.
   *
   * @param existing - Optional key to record (or look up) a stable mapping for.
   * @returns The mapped identifier when `existing` matches a prior call,
   *   otherwise a newly minted `prefix + counter` identifier.
   *
   * @example
   * const issuer = new IdentifierIssuer();
   * issuer.getId('a'); // '_:b0' — new mapping for 'a'
   * issuer.getId('a'); // '_:b0' — same identifier returned
   * issuer.getId();    // '_:b1' — anonymous, no mapping recorded
   */
  getId(existing?: string): string {
    if (existing !== undefined) {
      const existingId = this.issued.get(existing);

      if (existingId !== undefined) {
        return existingId;
      }
    }

    const issued = this.prefix + this.counter;

    this.counter++;

    if (existing !== undefined) {
      this.issued.set(existing, issued);
    }

    return issued;
  }

  /** Returns all existing identifiers in issuance order. */
  getIssuedIdentifiers(): string[] {
    return [...this.issued.keys()];
  }

  /** Read-only view of the current identifier map. */
  getIssuedMap(): ReadonlyMap<string, string> {
    return this.issued;
  }

  /** Returns true if `existing` has already been mapped. */
  hasId(existing: string): boolean {
    const result = this.issued.has(existing);

    return result;
  }

  /**
   * The prefix string prepended to every issued identifier.
   */
  get identifierPrefix(): string {
    return this.prefix;
  }

  /** Reset counter and clear all issued mappings. */
  reset(): void {
    this.counter = 0;
    this.issued.clear();
  }
}
