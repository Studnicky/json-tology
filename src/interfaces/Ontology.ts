import type { JsonLdDocInput } from '../types/JsonLdDocInput.js';
import type { QuadInterface } from './Quad.js';

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
