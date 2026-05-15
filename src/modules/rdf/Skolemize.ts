/**
 * Skolemize — strategies for minting IRIs for ABox subjects.
 *
 * Each static method returns a {@link SkolemizeFnType} suitable for the
 * `iriFor` option on `toQuads`. Strategies can be composed via
 * `Skolemize.compose(...)` — the first non-undefined return wins.
 *
 * Background: in RDF, a node without an explicit IRI is typically a
 * blank node. Skolemization replaces blank nodes with deterministic
 * IRIs so downstream consumers can refer to them stably. See W3C
 * RDF 1.1 §3.5 (Replacing Blank Nodes with IRIs).
 */

import type { SkolemizeFnType } from '../../types/Skolemize.js';
import { Hash } from '../hash/Hash.js';
import { HEX_RADIX } from '../../constants/NUMERIC.js';
import {
  UUID_BYTE_LENGTH,
  UUID_BYTE_MAX_PLUS_ONE
} from '../../constants/UUID.js';

const UUID_VERSION_MASK = 0x0F;
const UUID_VERSION_SET = 0x40;
const UUID_VARIANT_MASK = 0x3F;
const UUID_VARIANT_SET = 0x80;
const UUID_VERSION_BYTE_INDEX = 6;
const UUID_VARIANT_BYTE_INDEX = 8;

function stripTrailingSlash(iri: string): string {
  let result = iri;

  while (result.endsWith('/')) {
    result = result.slice(0, -1);
  }

  return result;
}

function randomUuidV4(): string {
  const cryptoObj = (globalThis as { 'crypto'?: { 'getRandomValues'?: (b: Uint8Array) => Uint8Array;
    'randomUUID'?: () => string } }).crypto;

  if (cryptoObj?.randomUUID !== undefined) {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(UUID_BYTE_LENGTH);

  if (cryptoObj?.getRandomValues === undefined) {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * UUID_BYTE_MAX_PLUS_ONE);
    }
  } else {
    cryptoObj.getRandomValues(bytes);
  }

  bytes[UUID_VERSION_BYTE_INDEX] = (bytes[UUID_VERSION_BYTE_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_SET;
  bytes[UUID_VARIANT_BYTE_INDEX] = (bytes[UUID_VARIANT_BYTE_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_SET;

  const hex: string[] = [];

  for (const byte of bytes) {
    hex.push(byte.toString(HEX_RADIX).padStart(2, '0'));
  }

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

function mintUuidIri(): string {
  return `urn:uuid:${randomUuidV4()}`;
}

export class Skolemize {
  /**
   * Pattern matched by `Skolemize.wellKnownGenid` IRIs. Exposed for
   * `fromQuads({ deskolemize: true })` and consumers writing custom
   * deskolemization passes.
   */
  public static readonly WELL_KNOWN_GENID_PATTERN = /\/\.well-known\/genid\//u;

  /**
   * Compose multiple strategies. The first strategy returning a defined
   * IRI wins; later strategies are not consulted.
   */
  public static compose(...strategies: readonly SkolemizeFnType[]): SkolemizeFnType {
    return (ctx) => {
      let resolved: string | undefined;

      for (const strategy of strategies) {
        const candidate = strategy(ctx);

        if (candidate !== undefined) {
          resolved = candidate;
          break;
        }
      }

      return resolved;
    };
  }

  /**
   * Mint an IRI from a property of the value object.
   *
   * If `value[name]` is a non-empty string, returns
   * `<baseIRI>/<value[name]>`. Otherwise, delegates to `fallback`
   * (defaults to `Skolemize.hash()`).
   */
  public static fromProperty(
    name: string,
    options?: { 'baseIRI'?: string;
      'fallback'?: SkolemizeFnType }
  ): SkolemizeFnType {
    const fallback = options?.fallback
      ?? Skolemize.hash(options?.baseIRI === undefined ? undefined : { 'baseIRI': options.baseIRI });

    return (ctx) => {
      const { value } = ctx;

      if (value !== null && typeof value === 'object' && name in value) {
        const candidate = (value as Record<string, unknown>)[name];

        if (typeof candidate === 'string' && candidate.length > 0) {
          const base = options?.baseIRI;

          return base === undefined
            ? candidate
            : `${stripTrailingSlash(base)}/${encodeURIComponent(candidate)}`;
        }
      }

      return fallback(ctx);
    };
  }

  /**
   * Default strategy. Mints `<baseIRI>/instances/<contentHash>` from a
   * deterministic hash of the value. Returns `undefined` when no
   * baseIRI is configured at any layer (registry or strategy), letting
   * the caller's default kick in.
   */
  public static hash(options?: { 'baseIRI'?: string }): SkolemizeFnType {
    const base = options?.baseIRI;

    return (ctx) => {
      let result: string | undefined;

      if (base !== undefined) {
        const contentHash = Hash.value(ctx.value);

        result = `${stripTrailingSlash(base)}/instances/${contentHash}`;
      }

      return result;
    };
  }

  /**
   * Test whether an IRI matches the well-known genid pattern.
   */
  public static isWellKnownGenid(iri: string): boolean {
    return Skolemize.WELL_KNOWN_GENID_PATTERN.test(iri);
  }

  /**
   * Mint a URN UUID v4 IRI. Non-deterministic — useful when fresh
   * identity on every emission is desired.
   */
  public static uuid(): SkolemizeFnType {
    return mintUuidIri;
  }

  /**
   * Mint an IRI matching the W3C RDF 1.1 §3.5 well-known genid pattern:
   * `<baseIRI>/.well-known/genid/<contentHash>`.
   *
   * IRIs of this shape are reversible by `fromQuads({ deskolemize: true })`,
   * which treats them as blank nodes when reconstructing typed objects.
   */
  public static wellKnownGenid(baseIRI: string): SkolemizeFnType {
    const root = stripTrailingSlash(baseIRI);

    return (ctx) => {
      const contentHash = Hash.value(ctx.value);

      return `${root}/.well-known/genid/${contentHash}`;
    };
  }
}
