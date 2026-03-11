/**
 * Ontology Builder
 *
 * Builds JSON-LD and N3/Turtle ontologies from parameterized configuration.
 * Accepts custom base IRIs, prefix maps, and graph builder callbacks.
 */

import type { OntologyBuilderOptions } from '../interfaces/ontology.js';

export type { OntologyBuilderOptions } from '../interfaces/ontology.js';

// Matches a CURIE (prefix:local) but NOT a full IRI (http://... / https://...)
const CURIE_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*:[^/]/u;
const FULL_IRI_PATTERN = /^https?:\/\//u;

/**
 * Ontology Builder
 *
 * Builds JSON-LD and N3/Turtle representations from parameterized graph data.
 */
export class OntologyBuilder {
  private readonly baseIRI: string;
  private readonly prefixes: Record<string, string>;
  private readonly graphBuilders: ReadonlyArray<(graph: unknown[]) => void>;

  public constructor(config: Readonly<OntologyBuilderOptions>) {
    this.baseIRI = config.baseIRI;
    this.prefixes = config.prefixes;
    this.graphBuilders = config.graphBuilders;
  }

  /**
   * Get the prefix to IRI map.
   */
  public context(): Record<string, string> {
    return { ...this.prefixes };
  }

  /**
   * Get the raw graph data by invoking all graph builder callbacks.
   */
  public raw(): unknown[] {
    const graph: unknown[] = [];
    for (let i = 0; i < this.graphBuilders.length; i++) {
      this.graphBuilders[i](graph);
    }
    return graph;
  }

  /**
   * Generate a full JSON-LD document.
   *
   * @returns JSON-LD object with @context, @graph, @id, @type
   */
  public jsonLdObject(): Record<string, unknown> {
    return {
      '@context': this.prefixes,
      '@graph': this.raw(),
      '@id': `${this.baseIRI}/ontology/`,
      '@type': 'owl:Ontology',
      'rdfs:label': 'Generated Ontology',
    };
  }

  /**
   * Generate JSON-LD as a JSON string.
   */
  public jsonLd(): string {
    return JSON.stringify(this.jsonLdObject(), undefined, 2);
  }

  /**
   * Generate N3/Turtle format with prefix declarations and full triple serialization.
   *
   * Supports:
   *   - Full IRIs: <http://...>
   *   - CURIEs: prefix:local
   *   - Typed literals: "value"^^xsd:type
   *   - Numeric/boolean literals: 42, true
   *   - Plain string literals: "quoted"
   *   - RDF lists via @list: (item1 item2 ...)
   *   - Blank nodes via anonymous objects (no @id): [ pred obj ; pred obj ]
   */
  public n3(): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(this.prefixes)) {
      if (key === '@vocab') {
        lines.push(`@prefix : <${value}>.`);
      } else {
        lines.push(`@prefix ${key}: <${value}>.`);
      }
    }

    const graph = this.raw();
    if (graph.length > 0) lines.push('');

    for (const node of graph) {
      if (typeof node !== 'object' || node === null) continue;
      const triple = this.nodeToN3(node as Record<string, unknown>);
      if (triple) lines.push(triple);
    }

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Private serialization helpers
  // ---------------------------------------------------------------------------

  private nodeToN3(node: Record<string, unknown>): string {
    const subjectId = node['@id'];
    if (typeof subjectId !== 'string') return '';

    const subject = this.renderTerm(subjectId, true);
    const predicateParts: string[] = [];

    for (const [key, value] of Object.entries(node)) {
      if (key === '@id') continue;

      const predicate = key === '@type' ? 'a' : key;
      const objectStr = this.renderValue(value, key === '@type');

      if (objectStr !== null) {
        predicateParts.push(`${predicate} ${objectStr}`);
      }
    }

    if (predicateParts.length === 0) return '';
    return `${subject}\n    ${predicateParts.join(' ;\n    ')} .`;
  }

  /**
   * Render a predicate value to N3 string.
   * Handles: scalars, arrays (comma-separated), @list (RDF list), @value typed literals,
   * and anonymous blank node objects.
   *
   * @param forceResource - treat all string values as resources (used for @type)
   */
  private renderValue(value: unknown, forceResource = false): string | null {
    if (Array.isArray(value)) {
      // Plain array = multiple values, rendered as comma-separated
      const parts = value
        .map((item) => this.renderScalar(item, forceResource))
        .filter((item): item is string => item !== null);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    return this.renderScalar(value, forceResource);
  }

  private renderScalar(value: unknown, forceResource = false): string | null {
    if (typeof value === 'string') {
      return this.renderTerm(value, forceResource);
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return String(value);
    }

    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;

      // { '@list': [...] } — RDF list: (item1 item2 ...)
      if ('@list' in obj) {
        const items = obj['@list'];
        if (Array.isArray(items)) {
          const rendered = items
            .map((item) => this.renderScalar(item, false))
            .filter((s): s is string => s !== null);
          return `(${rendered.join(' ')})`;
        }
        return '()';
      }

      // { '@value': v, '@type': t } — typed literal: "value"^^xsd:type
      if ('@value' in obj) {
        const rawValue = obj['@value'];
        const rawType = obj['@type'];

        if (typeof rawType === 'string') {
          const type = this.renderTerm(rawType, true);
          if (typeof rawValue === 'string') {
            const escaped = rawValue.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
            return `"${escaped}"^^${type}`;
          }
          if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
            return `"${rawValue}"^^${type}`;
          }
        }
        // No type — plain literal
        if (typeof rawValue === 'string') {
          const escaped = rawValue.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
          return `"${escaped}"`;
        }
        return String(rawValue);
      }

      // { '@id': iri } — named resource
      if ('@id' in obj) {
        const id = obj['@id'];
        if (typeof id === 'string') return this.renderTerm(id, true);
      }

      // Anonymous object (no @id) — blank node: [ pred obj ; pred obj ]
      return this.renderBlankNode(obj);
    }

    return null;
  }

  /**
   * Render an anonymous object as a Turtle blank node: [ pred obj ; pred obj ]
   */
  private renderBlankNode(node: Record<string, unknown>): string {
    const parts: string[] = [];

    for (const [key, val] of Object.entries(node)) {
      if (key.startsWith('@') && key !== '@type') continue;

      const predicate = key === '@type' ? 'a' : key;
      const rendered = this.renderValue(val, key === '@type');
      if (rendered !== null) {
        parts.push(`${predicate} ${rendered}`);
      }
    }

    if (parts.length === 0) return '[]';
    return `[ ${parts.join(' ; ')} ]`;
  }

  /**
   * Render a string term as a Turtle token.
   * - Full IRI (http/https) → <IRI>
   * - CURIE (prefix:local) → prefix:local
   * - Otherwise → "quoted literal"
   */
  private renderTerm(value: string, forceResource = false): string {
    if (FULL_IRI_PATTERN.test(value)) {
      return `<${value}>`;
    }
    if (CURIE_PATTERN.test(value) || forceResource) {
      return value;
    }
    return `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;
  }
}
