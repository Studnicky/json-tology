/**
 * Ontology Builder
 *
 * Builds JSON-LD ontology and SHACL documents from parameterized configuration.
 * Accepts custom base IRIs, prefix maps, and graph node sources.
 */

import type { OntologyBuilderOptionsInterface } from '../../interfaces/Ontology.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import { JSONLD } from '../../constants/JSONLD.js';
import { Projection } from '../rdf/Projection.js';

/**
 * Ontology Builder
 *
 * Builds JSON-LD representations from parameterized graph data.
 */
export class OntologyBuilder {
  private readonly baseIRI: string;
  private graphSources: Array<() => readonly unknown[]>;
  private readonly prefixes: Record<string, string>;
  private shaclSource: (() => readonly unknown[]) | readonly unknown[] | undefined;

  /**
   * Create an OntologyBuilder from a configuration with base IRI, prefixes, and graph sources.
   *
   * @param config - Builder configuration with baseIRI, prefixes, and graphSources
   */
  public constructor(config: Readonly<OntologyBuilderOptionsInterface>) {
    this.baseIRI = config.baseIRI;
    this.prefixes = config.prefixes;
    this.graphSources = config.graphSources.map((source) => {
      if (typeof source === 'function') {
        return source;
      }

      return () => {
        return source;
      };
    });
  }

  /**
   * Add an array of RDF quads to the builder. The quads are projected
   * to JSON-LD nodes and appended to the graph sources. Use this when
   * combining the output of `entities.toQuads(schema, data)` with a
   * TBox or SHACL document.
   */
  public addQuads(quads: QuadInterface[]): this {
    const nodes = Projection.toJsonLdNodes(quads);
    const source = (): readonly unknown[] => {
      return nodes;
    };

    this.graphSources = [
      ...this.graphSources,
      source
    ];

    return this;
  }

  /**
   * Set the SHACL graph source for SHACL output methods.
   */
  public addShacl(source: (() => readonly unknown[]) | readonly unknown[]): this {
    this.shaclSource = source;

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
    const obj = this.jsonLdObject();
    const json = JSON.stringify(obj, undefined, 2);

    return json;
  }

  /**
   * Generate a full JSON-LD document.
   *
   * @returns JSON-LD object with @context, @graph, @id, @type
   */
  public jsonLdObject(): Record<string, unknown> {
    return {
      [JSONLD.context]: this.prefixes,
      [JSONLD.graph]: this.raw(),
      [JSONLD.id]: `${this.baseIRI}/ontology/`,
      [JSONLD.type]: 'owl:Ontology',
      'rdfs:label': 'Generated Ontology'
    };
  }

  /**
   * Get the raw graph data by resolving all graph node sources.
   */
  public raw(): unknown[] {
    return this.graphSources.flatMap((graphSource) => {
      return [...graphSource()];
    });
  }

  private rawShacl(): unknown[] {
    if (this.shaclSource === undefined) {
      return [];
    }

    return typeof this.shaclSource === 'function'
      ? [...this.shaclSource()]
      : [...this.shaclSource];
  }

  /**
   * Get raw SHACL shapes as a JSON-LD object.
   */
  public shaclObject(): Record<string, unknown> {
    const shaclPrefixes = {
      ...this.prefixes,
      'sh': 'http://www.w3.org/ns/shacl#'
    };

    return {
      [JSONLD.context]: shaclPrefixes,
      [JSONLD.graph]: this.rawShacl()
    };
  }
}
