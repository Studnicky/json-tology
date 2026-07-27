/**
 * Skolemize — strategies for minting IRIs for ABox subjects.
 *
 * Each static method returns a {@link SkolemizeFunctionInterface} suitable for the
 * `iriFor` option on `toQuads`. Strategies can be composed via
 * `Skolemize.compose(...)` — the first non-undefined return wins. When a
 * strategy returns `undefined`, the projection's built-in default IRI minter
 * takes over, emitting `<baseIri>/instances/<classId>-<contentHash>`.
 *
 * Background: in RDF, a node without an explicit IRI is typically a
 * blank node. Skolemization replaces blank nodes with deterministic
 * IRIs so downstream consumers can refer to them stably. See W3C
 * RDF 1.1 §3.5 (Replacing Blank Nodes with IRIs).
 */

import type { SkolemizeFunctionInterface } from '../../interfaces/SkolemizeFunctionInterface.js';
import { Hash } from '../hash/Hash.js';
import { WELL_KNOWN_GENID_PATTERN } from '../../constants/GRAPH_REGEXES.js';
import {
  UUID_BYTE_LENGTH,
  UUID_BYTE_MAXIMUM_PLUS_ONE,
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
const HEX_LOOKUP: string[] = Array.from({ 'length': UUID_BYTE_MAXIMUM_PLUS_ONE });

for (let byteValue = 0; byteValue < UUID_BYTE_MAXIMUM_PLUS_ONE; byteValue += 1) {
  HEX_LOOKUP[byteValue] = byteValue.toString(HEX_RADIX).padStart(UUID_HEX_PAD_LENGTH, '0');
}

/**
 * IRI minting strategies for RDF blank-node Skolemization.
 *
 * @remarks
 * Each static method returns a `SkolemizeFunctionInterface` suitable for the `iriFor`
 * option on `toQuads`. Strategies compose via `Skolemize.compose(...)` —
 * the first non-`undefined` return wins. When a strategy returns `undefined`,
 * the projection's built-in default IRI minter takes over, emitting
 * `<baseIri>/instances/<contentHash>`.
 *
 * In RDF a node without an explicit IRI is typically a blank node.
 * Skolemization replaces blank nodes with deterministic IRIs so downstream
 * consumers can refer to them stably. See W3C RDF 1.1 §3.5.
 *
 * @example
 * ```ts
 * const strategy = Skolemize.compose(
 *   Skolemize.fromProperty('id'),
 *   Skolemize.hash({ baseIri: 'https://example.com' })
 * );
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link SkolemizeFunctionInterface}
 * @group Skolemize
 */
export class Skolemize {
  /**
   * Pattern matched by `Skolemize.wellKnownGenid` IRIs. Exposed for
   * `fromQuads({ deskolemize: true })` and consumers writing custom
   * deskolemization passes.
   */
  public static readonly WELL_KNOWN_GENID_PATTERN = WELL_KNOWN_GENID_PATTERN;

  /**
   * Compose multiple strategies. The first strategy returning a defined
   * IRI wins; later strategies are not consulted.
   */
  public static compose(...strategies: readonly SkolemizeFunctionInterface[]): SkolemizeFunctionInterface {
    return (context: Parameters<SkolemizeFunctionInterface>[0]): string | undefined => {
      let resolved: string | undefined;

      for (const strategy of strategies) {
        const candidate = strategy(context);

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
   * `<baseIri>/<value[name]>` where the property value is
   * percent-encoded via `encodeURIComponent` before being appended.
   * Otherwise, delegates to `fallback` (defaults to `Skolemize.hash()`).
   */
  public static fromProperty(
    name: string,
    options?: { 'baseIri'?: string;
      'fallback'?: SkolemizeFunctionInterface }
  ): SkolemizeFunctionInterface {
    const fallback = options?.fallback
      ?? Skolemize.hash(options?.baseIri === undefined ? undefined : { 'baseIri': options.baseIri });

    return (context: Parameters<SkolemizeFunctionInterface>[0]): string | undefined => {
      const { value } = context;

      if (value !== null && typeof value === 'object' && name in value) {
        const candidate = (value as Record<string, unknown>)[name];

        if (typeof candidate === 'string' && candidate.length > 0) {
          const base = options?.baseIri;

          return base === undefined
            ? candidate
            : `${Skolemize.stripTrailingSlash(base)}/${encodeURIComponent(candidate)}`;
        }
      }

      return fallback(context);
    };
  }

  /**
   * Default strategy. Mints `<baseIri>/instances/<contentHash>` from a
   * deterministic hash of the value. Returns `undefined` when no
   * baseIri is configured at any layer (registry or strategy), letting
   * the caller's default kick in.
   */
  public static hash(options?: { 'baseIri'?: string }): SkolemizeFunctionInterface {
    const base = options?.baseIri;

    return (context: Parameters<SkolemizeFunctionInterface>[0]): string | undefined => {
      let result: string | undefined;

      if (base !== undefined) {
        const contentHash = Hash.value(context.value);

        result = `${Skolemize.stripTrailingSlash(base)}/instances/${contentHash}`;
      }

      return result;
    };
  }

  /** Return the hex string for a byte value, throwing if out of range. */
  private static hexAt(byte: number | undefined): string {
    if (byte === undefined) {
      throw new Error('UUID byte index out of bounds');
    }

    const hex = HEX_LOOKUP.at(byte);

    if (hex === undefined) {
      throw new Error(`HEX_LOOKUP out of bounds: ${byte}`);
    }

    return hex;
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

  private static randomUuidV4(): string {
    const cryptoObject = (globalThis as { 'crypto'?: { 'getRandomValues'?: (b: Uint8Array) => Uint8Array;
      'randomUUID'?: () => string } }).crypto;

    if (cryptoObject?.randomUUID !== undefined) {
      return cryptoObject.randomUUID();
    }

    const bytes = new Uint8Array(UUID_BYTE_LENGTH);

    if (cryptoObject?.getRandomValues === undefined) {
      const { length } = bytes;

      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * UUID_BYTE_MAXIMUM_PLUS_ONE);
      }
    } else {
      cryptoObject.getRandomValues(bytes);
    }

    const versionByte = bytes.at(UUID_VERSION_BYTE_INDEX);
    const variantByte = bytes.at(UUID_VARIANT_BYTE_INDEX);

    if (versionByte === undefined || variantByte === undefined) {
      throw new Error('UUID byte array too short');
    }

    bytes[UUID_VERSION_BYTE_INDEX] = (versionByte & UUID_VERSION_MASK) | UUID_VERSION_SET;
    bytes[UUID_VARIANT_BYTE_INDEX] = (variantByte & UUID_VARIANT_MASK) | UUID_VARIANT_SET;

    return (
      `${Skolemize.hexAt(bytes.at(UUID_SEG0_B0)) + Skolemize.hexAt(bytes.at(UUID_SEG0_B1))
      + Skolemize.hexAt(bytes.at(UUID_SEG0_B2)) + Skolemize.hexAt(bytes.at(UUID_SEG0_B3))}-${
        Skolemize.hexAt(bytes.at(UUID_SEG1_B0))}${Skolemize.hexAt(bytes.at(UUID_SEG1_B1))}-${
        Skolemize.hexAt(bytes.at(UUID_SEG2_B0))}${Skolemize.hexAt(bytes.at(UUID_SEG2_B1))}-${
        Skolemize.hexAt(bytes.at(UUID_SEG3_B0))}${Skolemize.hexAt(bytes.at(UUID_SEG3_B1))}-${
        Skolemize.hexAt(bytes.at(UUID_SEG4_B0))}${Skolemize.hexAt(bytes.at(UUID_SEG4_B1))
      }${Skolemize.hexAt(bytes.at(UUID_SEG4_B2))}${Skolemize.hexAt(bytes.at(UUID_SEG4_B3))
      }${Skolemize.hexAt(bytes.at(UUID_SEG4_B4))}${Skolemize.hexAt(bytes.at(UUID_SEG4_B5))}`
    );
  }

  private static stripTrailingSlash(iri: string): string {
    let result = iri;

    while (result.endsWith('/')) {
      result = result.slice(0, -1);
    }

    return result;
  }

  /**
   * Mint a URN UUID v4 IRI. Non-deterministic — useful when fresh
   * identity on every emission is desired.
   */
  public static uuid(): SkolemizeFunctionInterface {
    return (_context: Parameters<SkolemizeFunctionInterface>[0]): string => {
      const result = `urn:uuid:${Skolemize.randomUuidV4()}`;

      return result;
    };
  }

  /**
   * Mint an IRI matching the W3C RDF 1.1 §3.5 well-known genid pattern:
   * `<baseIri>/.well-known/genid/<contentHash>`.
   *
   * IRIs of this shape are reversible by `fromQuads({ deskolemize: true })`,
   * which treats them as blank nodes when reconstructing typed objects.
   */
  public static wellKnownGenid(baseIri: string): SkolemizeFunctionInterface {
    const root = Skolemize.stripTrailingSlash(baseIri);

    return (context: Parameters<SkolemizeFunctionInterface>[0]): string => {
      const contentHash = Hash.value(context.value);

      return `${root}/.well-known/genid/${contentHash}`;
    };
  }
}
