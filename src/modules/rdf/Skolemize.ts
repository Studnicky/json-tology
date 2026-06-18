/**
 * Skolemize — strategies for minting IRIs for ABox subjects.
 *
 * Each static method returns a {@link SkolemizeFnType} suitable for the
 * `iriFor` option on `toQuads`. Strategies can be composed via
 * `Skolemize.compose(...)` — the first non-undefined return wins. When a
 * strategy returns `undefined`, the projection's built-in default IRI minter
 * takes over, emitting `<baseIRI>/instances/<classId>-<contentHash>`.
 *
 * Background: in RDF, a node without an explicit IRI is typically a
 * blank node. Skolemization replaces blank nodes with deterministic
 * IRIs so downstream consumers can refer to them stably. See W3C
 * RDF 1.1 §3.5 (Replacing Blank Nodes with IRIs).
 */

import type { SkolemizeFnType } from '../../types/SkolemizeFnType.js';
import { Hash } from '../hash/Hash.js';
import {
  UUID_BYTE_LENGTH,
  UUID_BYTE_MAX_PLUS_ONE,
  UUID_HEX_PAD_LENGTH,
  UUID_SEG0_B0,
  UUID_SEG0_B1,
  UUID_SEG0_B2,
  UUID_SEG0_B3,
  UUID_SEG1_B0,
  UUID_SEG1_B1,
  UUID_SEG2_B0,
  UUID_SEG2_B1,
  UUID_SEG3_B0,
  UUID_SEG3_B1,
  UUID_SEG4_B0,
  UUID_SEG4_B1,
  UUID_SEG4_B2,
  UUID_SEG4_B3,
  UUID_SEG4_B4,
  UUID_SEG4_B5,
  UUID_VARIANT_BYTE_INDEX,
  UUID_VARIANT_MASK,
  UUID_VARIANT_SET,
  UUID_VERSION_BYTE_INDEX,
  UUID_VERSION_MASK,
  UUID_VERSION_SET
} from '../../constants/UUID.js';

/** Radix for hexadecimal string conversion. */
const HEX_RADIX = 16;

/** Lookup table mapping byte values (0–255) to two-digit hex strings. */
const HEX_LOOKUP: readonly string[] = Array.from({ 'length': UUID_BYTE_MAX_PLUS_ONE }, (_: unknown, i: number): string => {
  return i.toString(HEX_RADIX).padStart(UUID_HEX_PAD_LENGTH, '0');
});

/** Return the hex string for a byte value, throwing if out of range. */
function hexAt(byte: number | undefined): string {
  if (byte === undefined) {
    throw new Error('UUID byte index out of bounds');
  }

  const hex = HEX_LOOKUP.at(byte);

  if (hex === undefined) {
    throw new Error(`HEX_LOOKUP out of bounds: ${byte}`);
  }

  return hex;
}

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

  const versionByte = bytes.at(UUID_VERSION_BYTE_INDEX);
  const variantByte = bytes.at(UUID_VARIANT_BYTE_INDEX);

  if (versionByte === undefined || variantByte === undefined) {
    throw new Error('UUID byte array too short');
  }

  bytes[UUID_VERSION_BYTE_INDEX] = (versionByte & UUID_VERSION_MASK) | UUID_VERSION_SET;
  bytes[UUID_VARIANT_BYTE_INDEX] = (variantByte & UUID_VARIANT_MASK) | UUID_VARIANT_SET;

  return (
    `${hexAt(bytes.at(UUID_SEG0_B0)) + hexAt(bytes.at(UUID_SEG0_B1))
    + hexAt(bytes.at(UUID_SEG0_B2)) + hexAt(bytes.at(UUID_SEG0_B3))}-${
      hexAt(bytes.at(UUID_SEG1_B0))}${hexAt(bytes.at(UUID_SEG1_B1))}-${
      hexAt(bytes.at(UUID_SEG2_B0))}${hexAt(bytes.at(UUID_SEG2_B1))}-${
      hexAt(bytes.at(UUID_SEG3_B0))}${hexAt(bytes.at(UUID_SEG3_B1))}-${
      hexAt(bytes.at(UUID_SEG4_B0))}${hexAt(bytes.at(UUID_SEG4_B1))
    }${hexAt(bytes.at(UUID_SEG4_B2))}${hexAt(bytes.at(UUID_SEG4_B3))
    }${hexAt(bytes.at(UUID_SEG4_B4))}${hexAt(bytes.at(UUID_SEG4_B5))}`
  );
}


/**
 * IRI minting strategies for RDF blank-node Skolemization.
 *
 * @remarks
 * Each static method returns a `SkolemizeFnType` suitable for the `iriFor`
 * option on `toQuads`. Strategies compose via `Skolemize.compose(...)` —
 * the first non-`undefined` return wins. When a strategy returns `undefined`,
 * the projection's built-in default IRI minter takes over, emitting
 * `<baseIRI>/instances/<contentHash>`.
 *
 * In RDF a node without an explicit IRI is typically a blank node.
 * Skolemization replaces blank nodes with deterministic IRIs so downstream
 * consumers can refer to them stably. See W3C RDF 1.1 §3.5.
 *
 * @example
 * ```ts
 * const strategy = Skolemize.compose(
 *   Skolemize.fromProperty('id'),
 *   Skolemize.hash({ baseIRI: 'https://example.com' })
 * );
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link SkolemizeFnType}
 * @group Skolemize
 */
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
    return (ctx: Parameters<SkolemizeFnType>[0]): string | undefined => {
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
   * `<baseIRI>/<value[name]>` where the property value is
   * percent-encoded via `encodeURIComponent` before being appended.
   * Otherwise, delegates to `fallback` (defaults to `Skolemize.hash()`).
   */
  public static fromProperty(
    name: string,
    options?: { 'baseIRI'?: string;
      'fallback'?: SkolemizeFnType }
  ): SkolemizeFnType {
    const fallback = options?.fallback
      ?? Skolemize.hash(options?.baseIRI === undefined ? undefined : { 'baseIRI': options.baseIRI });

    return (ctx: Parameters<SkolemizeFnType>[0]): string | undefined => {
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

    return (ctx: Parameters<SkolemizeFnType>[0]): string | undefined => {
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
    if (iri.length === 0) {
      return false;
    }

    return Skolemize.WELL_KNOWN_GENID_PATTERN.test(iri);
  }

  /**
   * Mint a URN UUID v4 IRI. Non-deterministic — useful when fresh
   * identity on every emission is desired.
   */
  public static uuid(): SkolemizeFnType {
    return (_ctx: Parameters<SkolemizeFnType>[0]): string => {
      return `urn:uuid:${randomUuidV4()}`;
    };
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

    return (ctx: Parameters<SkolemizeFnType>[0]): string => {
      const contentHash = Hash.value(ctx.value);

      return `${root}/.well-known/genid/${contentHash}`;
    };
  }
}
