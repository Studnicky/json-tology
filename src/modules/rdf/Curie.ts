/**
 * CURIE (Compact URI) prefix handler.
 *
 * Expands compact notation (e.g., `ex:name`) to full IRIs and compacts full IRIs to compact form using a prefix map.
 */

import type { CurieInterface } from '../../interfaces/Curie.js';

export class Curie implements CurieInterface {
  private readonly compactCache = new Map<string, string>();
  private readonly expandCache = new Map<string, string>();
  private readonly prefixes: Record<string, string>;

  /**
   * Creates a new CURIE prefix handler.
   *
   * @param prefixes - Map of prefix names to base IRIs (e.g., `{ ex: 'https://example.com/' }`)
   */
  public constructor(prefixes: Record<string, string>) {
    this.prefixes = prefixes;
  }

  /**
   * Compacts a full IRI to compact notation using registered prefixes.
   *
   * @param iri - A full IRI (e.g., `https://example.com/property`)
   * @returns The compacted form if a matching prefix is found, otherwise the original IRI
   */
  public compact(iri: string): string {
    const cached = this.compactCache.get(iri);

    if (cached !== undefined) {
      return cached;
    }

    let bestPrefix = '';
    let bestNamespace = '';

    for (const [
      prefix,
      namespace
    ] of Object.entries(this.prefixes)) {
      if (iri.startsWith(namespace) && namespace.length > bestNamespace.length) {
        bestPrefix = prefix;
        bestNamespace = namespace;
      }
    }

    const result = bestNamespace.length > 0
      ? `${bestPrefix}:${iri.slice(bestNamespace.length)}`
      : iri;

    this.compactCache.set(iri, result);

    return result;
  }

  /**
   * Expands a compact IRI (CURIE) or full IRI to its complete form.
   *
   * @param value - A compact IRI (e.g., `ex:property`) or full IRI
   * @returns The expanded IRI, or the original value if no prefix match is found
   */
  public expand(value: string): string {
    const cached = this.expandCache.get(value);

    if (cached !== undefined) {
      return cached;
    }

    if (!value.includes(':')) {
      this.expandCache.set(value, value);

      return value;
    }

    const [
      prefix,
      localPart
    ] = value.split(':', 2) as [string, string];
    const namespace = this.prefixes[prefix];

    if (!namespace) {
      this.expandCache.set(value, value);

      return value;
    }

    const result = `${namespace}${localPart}`;

    this.expandCache.set(value, result);

    return result;
  }
}
