import type { JsonLdDocInputType } from '../types/JsonLdDocInputType.js';
import type { QuadInterface } from './QuadInterface.js';

/**
 * Contract for the quad-native ontology builder.
 *
 * All graph data enters through labeled entry points that converge on an internal
 * rdf/js quad store. Every output derives from that store.
 */
export interface OntologyBuilderInterface {
  addFromJsonLd(doc: JsonLdDocInputType): Promise<this>;
  addFromQuads(quads: readonly QuadInterface[]): this;
  addShaclFromJsonLd(doc: JsonLdDocInputType): Promise<this>;
  addShaclFromQuads(quads: readonly QuadInterface[]): this;
  context(): Record<string, string>;
  jsonLd(): string;
  jsonLdObject(): Record<string, unknown>;
  quads(): QuadInterface[];
  shaclObject(): Record<string, unknown>;
  shaclQuads(): QuadInterface[];
}
