import type { QuadInterface } from './Quad.js';

/**
 * Accepted JSON-LD document shapes for `addFromJsonLd` / `addShaclFromJsonLd`.
 */
export type JsonLdDocInput = ReadonlyArray<Record<string, unknown>> | Record<string, unknown>;

export interface OntologyBuilderOptionsInterface {
  /**
   * Base IRI for the ontology (e.g., 'https://my-project.io')
   */
  'baseIRI': string;

  /**
   * Prefix to IRI map (e.g., { myns: 'https://my-project.io/ns#', rdf: '...' })
   */
  'prefixes': Record<string, string>;
}

/**
 * Contract for the quad-native ontology builder.
 *
 * All graph data enters through labeled entry points that converge on an internal
 * rdf/js quad store. Every output derives from that store.
 */
export interface OntologyBuilderInterface {
  addFromJsonLd(doc: JsonLdDocInput): Promise<this>;
  addFromQuads(quads: readonly QuadInterface[]): this;
  addShaclFromJsonLd(doc: JsonLdDocInput): Promise<this>;
  addShaclFromQuads(quads: readonly QuadInterface[]): this;
  context(): Record<string, string>;
  jsonLd(): string;
  jsonLdObject(): Record<string, unknown>;
  quads(): QuadInterface[];
  shaclObject(): Record<string, unknown>;
  shaclQuads(): QuadInterface[];
}
