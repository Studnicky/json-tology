/**
 * Ontology Builder
 *
 * Quad-native builder for JSON-LD ontology and SHACL documents.
 * All graph data enters through labeled entry points that converge on
 * an internal rdf/js quad store. Every output derives from that store.
 */

import type { OntologyBuilderInterface } from '../../interfaces/OntologyBuilderInterface.js';
import type { JsonLdDocumentInputEntity } from '../../entities/JsonLdDocumentInputEntity.js';
import type { OntologyBuilderOptionsInterface } from '../../interfaces/OntologyBuilderOptionsInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { JsonLdDatasetQuadEntity } from '../../entities/JsonLdDatasetQuadEntity.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import jsonld from 'jsonld';
import { JSONLD } from '../../constants/JSONLD.js';
import { RDFS } from '../../constants/IRI.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import { SHACL_ARRAY_KEYS } from '../../constants/SHACL.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import { LogScope } from '../data/LogScope.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';
import { JsonLdFormatter } from '../rdf/JsonLdFormatter.js';
import { QuadFactory } from '../quads/QuadFactory.js';

/**
 * Ontology Builder
 *
 * Builds JSON-LD representations from rdf/js quad stores.
 * JSON-LD documents are parsed to quads via `jsonld.toRDF`.
 * All outputs derive from the canonical internal quad store.
 */
export class OntologyBuilder implements OntologyBuilderInterface {
  private readonly baseIri: string;
  private readonly logger: LoggerInterface;
  private readonly prefixes: Record<string, string>;
  private readonly quadStore: QuadInterface[] = [];
  private readonly shaclStore: QuadInterface[] = [];

  /**
   * Create an OntologyBuilder with base IRI and prefix map.
   * Graph data enters through `addFromQuads` / `addFromJsonLd` and their SHACL variants.
   */
  public constructor(config: Readonly<OntologyBuilderOptionsInterface>) {
    this.baseIri = config.baseIri;
    this.logger = config.logger ?? SILENT_LOGGER;
    this.prefixes = config.prefixes;
  }

  /**
   * Parse a JSON-LD document to rdf/js quads via `jsonld.toRDF` and append
   * them to the canonical ontology store.
   */
  public async addFromJsonLd(document: JsonLdDocumentInputEntity.Type): Promise<this> {
    const dataset = await jsonld.toRDF(document as object) as JsonLdDatasetQuadEntity.Type[];
    const quads = dataset.map((datasetQuad) => {
      const result = QuadFactory.fromDatasetQuad(datasetQuad);

      return result;
    });

    this.logger.debug(LogScope.format('OntologyBuilder', 'addFromJsonLd', `parsed ${quads.length} quads from JSON-LD`));

    return this.addFromQuads(quads);
  }

  /**
   * Append rdf/js quads to the canonical ontology store.
   */
  public addFromQuads(quads: readonly QuadInterface[]): this {
    this.logger.debug(LogScope.format('OntologyBuilder', 'addFromQuads', `adding ${quads.length} quads to ontology store`));

    for (const quad of quads) {
      this.quadStore.push(quad);
    }

    return this;
  }

  /**
   * Parse a JSON-LD document to rdf/js quads via `jsonld.toRDF` and append
   * them to the SHACL store.
   */
  public async addShaclFromJsonLd(document: JsonLdDocumentInputEntity.Type): Promise<this> {
    const dataset = await jsonld.toRDF(document as object) as JsonLdDatasetQuadEntity.Type[];
    const quads = dataset.map((datasetQuad) => {
      const result = QuadFactory.fromDatasetQuad(datasetQuad);

      return result;
    });

    this.logger.debug(LogScope.format('OntologyBuilder', 'addShaclFromJsonLd', `parsed ${quads.length} quads from JSON-LD`));

    return this.addShaclFromQuads(quads);
  }

  /**
   * Append rdf/js quads to the SHACL store.
   */
  public addShaclFromQuads(quads: readonly QuadInterface[]): this {
    this.logger.debug(LogScope.format('OntologyBuilder', 'addShaclFromQuads', `adding ${quads.length} quads to SHACL store`));

    for (const quad of quads) {
      this.shaclStore.push(quad);
    }

    return this;
  }

  /**
   * Get the prefix to IRI map.
   */
  public context(): Record<string, string> {
    return { ...this.prefixes };
  }

  /**
   * Generate JSON-LD as a JSON string.
   */
  public jsonLd(): string {
    const result = JSON.stringify(this.jsonLdObject(), undefined, 2);

    return result;
  }

  /**
   * Generate a full JSON-LD document derived from the canonical quad store.
   *
   * Applies OWL array normalization (`rdfs:subClassOf` is always an array)
   * consistent with the OWL serializer contract.
   *
   * @returns JSON-LD object with @context, @graph, @id, @type, rdfs:label
   */
  public jsonLdObject(): Record<string, unknown> {
    const nodes = JsonLdFormatter.fromQuads(this.quadStore);

    for (const node of nodes) {
      BaseGraphSerializer.ensureArray(node, RDFS.subClassOf);
    }

    const document: Record<string, unknown> = { 'rdfs:label': 'Generated Ontology' };

    document[JSONLD.context] = this.prefixes;
    document[JSONLD.graph] = nodes;
    document[JSONLD.id] = `${this.baseIri}/ontology/`;
    document[JSONLD.type] = 'owl:Ontology';

    return document;
  }

  /**
   * Return a fresh array of all quads in the canonical ontology store.
   */
  public quads(): QuadInterface[] {
    return [...this.quadStore];
  }

  /**
   * Get SHACL shapes as a JSON-LD object derived from the SHACL quad store.
   *
   * Applies SHACL array normalization (`sh:property` is always an array)
   * consistent with the SHACL serializer contract.
   */
  public shaclObject(): Record<string, unknown> {
    const shaclPrefixes = {
      ...this.prefixes,
      'sh': STANDARD_PREFIXES.sh
    };
    const nodes = JsonLdFormatter.fromQuads(this.shaclStore);

    for (const node of nodes) {
      BaseGraphSerializer.normalizeArrays(node, SHACL_ARRAY_KEYS);
    }

    const document: Record<string, unknown> = {};

    document[JSONLD.context] = shaclPrefixes;
    document[JSONLD.graph] = nodes;

    return document;
  }

  /**
   * Return a fresh array of all quads in the SHACL store.
   */
  public shaclQuads(): QuadInterface[] {
    return [...this.shaclStore];
  }
}
