import type { JsonLdDocumentInputEntity } from '../entities/JsonLdDocumentInputEntity.js';
import type { QuadInterface } from './QuadInterface.js';

/**
 * Contract for the quad-native ontology builder.
 *
 * All graph data enters through labeled entry points that converge on an internal
 * rdf/js quad store. Every output derives from that store.
 */
export interface OntologyBuilderInterface {
  addFromJsonLd(doc: JsonLdDocumentInputEntity.Type): Promise<this>;
  addFromQuads(quads: readonly QuadInterface[]): this;
  addShaclFromJsonLd(doc: JsonLdDocumentInputEntity.Type): Promise<this>;
  addShaclFromQuads(quads: readonly QuadInterface[]): this;
  context(): Record<string, string>;
  jsonLd(): string;
  jsonLdObject(): Record<string, unknown>;
  quads(): QuadInterface[];
  shaclObject(): Record<string, unknown>;
  shaclQuads(): QuadInterface[];
}
