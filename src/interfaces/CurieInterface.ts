/**
 * CURIE (Compact URI) prefix handler for IRI expansion and compaction.
 *
 * Maps between compact notation (e.g., `ex:name`) and full IRIs (e.g., `https://example.com/name`).
 */
export interface CurieInterface {
  /**
   * Compacts a full IRI to compact notation using registered prefixes.
   *
   * @param iri - A full IRI (e.g., `https://example.com/property`)
   * @returns The compacted form if a matching prefix is found, otherwise the original IRI
   */
  compact(iri: string): string;

  /**
   * Expands a compact IRI (CURIE) or full IRI to its complete form.
   *
   * @param value - A compact IRI (e.g., `ex:property`) or full IRI (e.g., `https://example.com/property`)
   * @returns The expanded IRI, or the original value if no prefix match is found
   */
  expand(value: string): string;

  /**
   * Expand a value to a full IRI when needed, passing through blank nodes,
   * absolute IRIs, and empty strings unchanged. Returns the original value
   * if CURIE expansion fails (unregistered prefix).
   *
   * @param value - A CURIE, full IRI, blank node ID, or empty string
   * @returns The expanded IRI, or the original value unchanged
   */
  expandIfNeeded(value: string): string;
}
