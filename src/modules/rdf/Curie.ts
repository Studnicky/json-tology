/**
 * CURIE (Compact URI) namespace handler.
 *
 * Expands compact notation (e.g., `ex:name`) to full IRIs and compacts full IRIs to compact form using a prefix map.
 */

import type { CurieInterface } from '../../interfaces/curie.js';

export class Curie implements CurieInterface {
  private readonly prefixes: Record<string, string>;

  /**
   * Creates a new CURIE namespace handler.
   *
   * @param prefixes - Map of prefix names to namespace IRIs (e.g., `{ ex: 'https://example.com/' }`)
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

    if (bestNamespace.length > 0) {
      return `${bestPrefix}:${iri.slice(bestNamespace.length)}`;
    }

    return iri;
  }

  /**
   * Expands a compact IRI (CURIE) or full IRI to its complete form.
   *
   * @param value - A compact IRI (e.g., `ex:property`) or full IRI
   * @returns The expanded IRI, or the original value if no prefix match is found
   */
  public expand(value: string): string {
    if (!value.includes(':')) {
      return value;
    }

    const [
      prefix,
      localPart
    ] = value.split(':', 2) as [string, string];
    const namespace = this.prefixes[prefix];

    if (!namespace) {
      return value;
    }

    return `${namespace}${localPart}`;
  }
}
