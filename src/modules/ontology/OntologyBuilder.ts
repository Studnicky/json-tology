/**
 * Ontology Builder
 *
 * Quad-native builder for JSON-LD ontology and SHACL documents.
 * All graph data enters through labeled entry points that converge on
 * an internal rdf/js quad store. Every output derives from that store.
 */

import type { OntologyBuilderInterface } from '../../interfaces/Ontology.js';
import type { JsonLdDocInput } from '../../types/JsonLdDocInput.js';
import type { OntologyBuilderOptionsType } from '../../types/OntologyBuilderOptionsType.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import type { JsonLdDatasetQuadType } from '../../types/JsonLdDatasetQuadType.js';
import jsonld from 'jsonld';
import { JSONLD } from '../../constants/JSONLD.js';
import { RDFS } from '../../constants/IRI.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import { SHACL_ARRAY_KEYS } from '../../constants/SHACL.js';
import { BaseGraphSerializer } from './BaseGraphSerializer.js';
import { JsonLdFormatter } from '../rdf/JsonLdFormatter.js';
import { QuadFactory } from '../rdf/QuadFactory.js';

/**
 * Ontology Builder
 *
 * Builds JSON-LD representations from rdf/js quad stores.
 * JSON-LD documents are parsed to quads via `jsonld.toRDF`.
 * All outputs derive from the canonical internal quad store.
 */
export class OntologyBuilder implements OntologyBuilderInterface {
  private readonly baseIRI: string;
  private readonly prefixes: Record<string, string>;
  private readonly quadStore: QuadInterface[] = [];
  private readonly shaclStore: QuadInterface[] = [];

  /**
   * Create an OntologyBuilder with base IRI and prefix map.
   * Graph data enters through `addFromQuads` / `addFromJsonLd` and their SHACL variants.
   */
  public constructor(config: Readonly<OntologyBuilderOptionsType>) {
    this.baseIRI = config.baseIRI;
    this.prefixes = config.prefixes;
  }

  /**
   * Parse a JSON-LD document to rdf/js quads via `jsonld.toRDF` and append
   * them to the canonical ontology store.
   */
  public async addFromJsonLd(doc: JsonLdDocInput): Promise<this> {
    const dataset = await jsonld.toRDF(doc as object) as JsonLdDatasetQuadType[];
    const quads = dataset.map((datasetQuad) => {
      return QuadFactory.fromDatasetQuad(datasetQuad);
    });

    return this.addFromQuads(quads);
  }

  /**
   * Append rdf/js quads to the canonical ontology store.
   */
  public addFromQuads(quads: readonly QuadInterface[]): this {
    for (const quad of quads) {
      this.quadStore.push(quad);
    }

    return this;
  }

  /**
   * Parse a JSON-LD document to rdf/js quads via `jsonld.toRDF` and append
   * them to the SHACL store.
   */
  public async addShaclFromJsonLd(doc: JsonLdDocInput): Promise<this> {
    const dataset = await jsonld.toRDF(doc as object) as JsonLdDatasetQuadType[];
    const quads = dataset.map((datasetQuad) => {
      return QuadFactory.fromDatasetQuad(datasetQuad);
    });

    return this.addShaclFromQuads(quads);
  }

  /**
   * Append rdf/js quads to the SHACL store.
   */
  public addShaclFromQuads(quads: readonly QuadInterface[]): this {
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
    return JSON.stringify(this.jsonLdObject(), undefined, 2);
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

    return {
      [JSONLD.context]: this.prefixes,
      [JSONLD.graph]: nodes,
      [JSONLD.id]: `${this.baseIRI}/ontology/`,
      [JSONLD.type]: 'owl:Ontology',
      'rdfs:label': 'Generated Ontology'
    };
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

    return {
      [JSONLD.context]: shaclPrefixes,
      [JSONLD.graph]: nodes
    };
  }

  /**
   * Return a fresh array of all quads in the SHACL store.
   */
  public shaclQuads(): QuadInterface[] {
    return [...this.shaclStore];
  }
}
