import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Interface contract for per-call blank-node identifier issuers.
 *
 * An IdentifierIssuer owns a private counter and an optional stable mapping
 * from existing identifiers to issued identifiers. Each projector call
 * constructs its own issuer so concurrent serializations never share state.
 */
export interface IdentifierIssuerInterface {
  /**
   * Create an independent copy with the same prefix, counter value, and
   * issued mappings. Mutations to the clone do not affect the original.
   */
  clone(): IdentifierIssuerInterface;

  /** Number of identifiers issued so far (mapped or unmapped). */
  readonly 'count': NumberValueEntity.Type;

  /**
   * Issue (or retrieve) a deterministic identifier for `existing`.
   *
   * If `existing` is provided and has already been mapped, returns the same
   * identifier that was issued previously. Otherwise issues a new identifier
   * (`prefix + counter`) and optionally records the mapping.
   *
   * Calling without `existing` always issues a new identifier without
   * creating a mapping.
   */
  getId(existing?: string): string;

  /** Returns all existing identifiers in the order they were issued. */
  getIssuedIdentifiers(): string[];

  /** Read-only view of the current identifier map. */
  getIssuedMap(): ReadonlyMap<string, string>;

  /** Returns true if `existing` has already been mapped. */
  hasId(existing: string): boolean;

  /** The prefix string prepended to every issued identifier. */
  readonly 'identifierPrefix': StringValueEntity.Type;

  /** Reset counter and clear all issued mappings. */
  reset(): void;
}
