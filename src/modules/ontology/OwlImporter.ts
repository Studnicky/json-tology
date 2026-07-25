/**
 * OwlImporter — top-level orchestrator for OWL 2 TBox import.
 *
 * Converts OWL 2 quads (JSON-LD, raw quad array, or JSON-LD string) into
 * OwlImportResultType: reconstructed JSON Schema objects, invariants, property
 * characteristics, owl:sameAs pairs, named individuals, and an unsupported-
 * axiom log for anything no dispatcher could handle.
 *
 * Quads.normalize resolves JSON-LD string/object inputs via the synchronous
 * compact-walker (no external dependency for OwlProjection output). For arbitrary
 * JSON-LD, importAsync() delegates to the optional `jsonld` peerDependency.
 * SchemaGraph.fromQuads (the structural inverse of OwlProjection.graph) populates
 * the import context graph so dispatchers can traverse it via allRelations() and nodes().
 */

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type {
  DispatcherFunctionType,
  OwlImportContextType,
  OwlImporterOptionsType,
  OwlImportFragmentType,
  OwlImportResultType,
  PrefixMapType
} from '../../types/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../types/Schema.js';
import type { InvariantType } from '../../types/Invariant.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { JsonLdModuleType } from '../../types/JsonLdModuleType.js';
import type { ExternalRdfJsQuadType } from '../../types/ExternalRdfJsQuadType.js';
import { Curie } from '../quads/Curie.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import { LogScope } from '../data/LogScope.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import {
  OWL, RDF, XSD
} from '../../constants/IRI.js';
import {
  CLASS_TYPE_IRIS,
  RDF_TYPE_PREDICATES,
  RDFS_DATATYPE_IRIS
} from '../../constants/ONTOLOGY_PREDICATES.js';
import { SUPPORTED_XSD_DATATYPES } from '../../constants/XSD_REVERSE_MAPS.js';
import { OwlImportError } from '../../errors/OwlImportError.js';
import { OWL_IMPORT_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { DataType } from '../data/DataType.js';
import { Terms } from '../quads/Terms.js';
import { JsonLdToQuads } from '../rdf/JsonLdToQuads.js';
import { Annotations } from './importDispatch/Annotations.js';
import { Characteristics } from './importDispatch/Characteristics.js';
import { ClassAxioms } from './importDispatch/ClassAxioms.js';
import { ClassExpressions } from './importDispatch/ClassExpressions.js';
import { Datatypes } from './importDispatch/Datatypes.js';
import { Individuals } from './importDispatch/Individuals.js';
import { Properties } from './importDispatch/Properties.js';
import { PropertyRestrictions } from './importDispatch/PropertyRestrictions.js';


// ---------------------------------------------------------------------------
// Fragments — merge OwlImportFragmentType[] and resolve schema deltas
// ---------------------------------------------------------------------------

/** Merge, deduplicate, and resolve dispatcher-produced OwlImportFragmentType instances. */
class Fragments {
  /** Flatten a list of fragment arrays into a single array. */
  public static flattenFragmentArrays<T>(fragments: OwlImportFragmentType[], key: keyof OwlImportFragmentType): T[] {
    const result: T[] = [];

    for (const fragment of fragments) {
      for (const item of fragment[key] as Iterable<T>) {
        result.push(item);
      }
    }

    return result;
  }

  public static merge(fragments: OwlImportFragmentType[]): OwlImportFragmentType {
    const schemaDeltas = Fragments.mergeDeltas(fragments);
    const invariants = Fragments.flattenFragmentArrays<{ 'invariant': InvariantType;
      'schemaId': string; }>(fragments, 'invariants');
    const characteristics = Fragments.flattenFragmentArrays<{ 'characteristic': string;
      'propertyIri': string; }>(fragments, 'characteristics');
    const sameAs = Fragments.flattenFragmentArrays<[string, string]>(fragments, 'sameAs');
    const individuals = Fragments.flattenFragmentArrays<{
      'iri': string;
      'properties': Record<string, unknown>;
      'types': string[];
    }>(fragments, 'individuals');
    const differentFromRaw = Fragments.flattenFragmentArrays<[string, string]>(fragments, 'differentFrom');

    // Deduplicate differentFrom pairs by canonical key
    const seenDiff = new Set<string>();
    const differentFrom: Array<[string, string]> = [];

    for (const [
      a,
      b
    ] of differentFromRaw) {
      const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;

      if (!seenDiff.has(key)) {
        seenDiff.add(key);
        differentFrom.push([
          a,
          b
        ]);
      }
    }

    return {
      characteristics,
      differentFrom,
      individuals,
      invariants,
      sameAs,
      'schemaDeltas': schemaDeltas
    };
  }

  /** Merge all schema deltas from a list of fragments into a single map. */
  public static mergeDeltas(fragments: OwlImportFragmentType[]): Map<string, JsonSchemaDocumentObjectType> {
    const schemaDeltas = new Map<string, JsonSchemaDocumentObjectType>();

    for (const fragment of fragments) {
      for (const [
        iri,
        delta
      ] of fragment.schemaDeltas) {
        const existing = schemaDeltas.get(iri);

        if (existing === undefined) {
          schemaDeltas.set(iri, { ...delta });
        } else {
          schemaDeltas.set(iri, {
            ...existing,
            ...delta
          });
        }
      }
    }

    return schemaDeltas;
  }

  /**
   * Convert the merged schemaDeltas map into final JsonSchemaDocumentObjectType
   * objects, resolving cross-class $ref IRIs where possible.
   *
   * All class IRIs from the input graph receive a minimal schema object
   * `{ $id: classIri }` as a baseline. Dispatcher-populated deltas are merged
   * in before the final schema objects are emitted.
   */
  public static resolveSchemas(
    merged: OwlImportFragmentType,
    allClassIris: ReadonlySet<string>
  ): JsonSchemaDocumentObjectType[] {
    const schemas: JsonSchemaDocumentObjectType[] = [];

    for (const classIri of allClassIris) {
      const delta = merged.schemaDeltas.get(classIri) ?? {};
      const schema: JsonSchemaDocumentObjectType = {
        '$id': classIri,
        ...delta
      };

      schemas.push(schema);
    }

    // Also emit schemas for delta keys not in allClassIris (defensive — should
    // not happen in practice, but guards against dispatcher bugs).
    for (const [
      iri,
      delta
    ] of merged.schemaDeltas) {
      if (!allClassIris.has(iri)) {
        schemas.push({
          '$id': iri,
          ...delta
        });
      }
    }

    return schemas;
  }
}

// ---------------------------------------------------------------------------
// Quads — normalise import input (JSON-LD string/object/RDF-JS output) into
// QuadInterface[]
// ---------------------------------------------------------------------------

/** Normalise import input formats (JSON-LD compact docs, jsonld.js RDF output) into QuadInterface[]. */
class Quads {
  /**
   * Extract class IRIs from an array of quads.
   * A subject is treated as a class IRI when a quad asserts
   * `<subject> rdf:type owl:Class` or `<subject> rdf:type rdfs:Class`.
   */
  public static collectClassIris(quads: QuadInterface[]): ReadonlySet<string> {
    const classIris = new Set<string>();

    for (const quad of quads) {
      if (
        RDF_TYPE_PREDICATES.has(quad.predicate.value)
        && quad.object.termType === 'NamedNode'
        && CLASS_TYPE_IRIS.has(quad.object.value)
      ) {
        classIris.add(quad.subject.value);
      }
    }

    return classIris;
  }

  /**
   * Extract rdfs:Datatype subject IRIs from an array of quads.
   * Used to extend ctx.isDatatype() with custom named datatypes.
   */
  public static collectDatatypeIris(quads: QuadInterface[]): ReadonlySet<string> {
    const datatypeIris = new Set<string>();

    for (const quad of quads) {
      if (
        RDF_TYPE_PREDICATES.has(quad.predicate.value)
        && quad.object.termType === 'NamedNode'
        && RDFS_DATATYPE_IRIS.has(quad.object.value)
      ) {
        datatypeIris.add(quad.subject.value);
      }
    }

    return datatypeIris;
  }

  /**
   * Extract property IRIs (owl:ObjectProperty, owl:DatatypeProperty,
   * rdf:Property) from an array of quads.
   */
  public static collectPropertyIris(quads: QuadInterface[]): ReadonlySet<string> {
    const propertyIris = new Set<string>();
    const PROPERTY_TYPES = new Set([
      OWL.DatatypeProperty,
      OWL.ObjectProperty,
      'owl:DatatypeProperty',
      'owl:ObjectProperty',
      RDF.Property,
      'rdf:Property'
    ]);

    for (const quad of quads) {
      if (
        RDF_TYPE_PREDICATES.has(quad.predicate.value)
        && quad.object.termType === 'NamedNode'
        && PROPERTY_TYPES.has(quad.object.value)
      ) {
        propertyIris.add(quad.subject.value);
      }
    }

    return propertyIris;
  }

  /** Build a single QuadInterface from an external RDF/JS quad shape. */
  public static fromExternal(quad: ExternalRdfJsQuadType): QuadInterface {
    const object = quad.object;
    let objectTerm: QuadObjectType;

    if (object.termType === 'Literal') {
      const datatypeIri = object.datatype?.value !== undefined && object.datatype.value !== ''
        ? object.datatype.value
        : XSD.string;
      const language = object.language !== undefined && object.language !== '' ? object.language : undefined;

      objectTerm = Terms.literal(object.value, {
        'datatype': Terms.iri(datatypeIri),
        ...(!(language === undefined) && { language })
      });
    } else if (object.termType === 'BlankNode') {
      objectTerm = Terms.blank(object.value);
    } else {
      objectTerm = Terms.iri(object.value);
    }

    return Terms.quad(
      Terms.iri(quad.subject.value),
      Terms.iri(quad.predicate.value),
      objectTerm,
      Terms.defaultGraph()
    );
  }

  /**
   * Normalise a JSON-LD object (already parsed from string) to QuadInterface[].
   *
   * Handles the compact JSON-LD format that OntologyBuilder produces:
   * - @context: prefix-to-IRI map (prefix label to IRI prefix string)
   * - @graph: array of subject nodes with @id, @type, and predicate entries
   *
   * For arbitrary JSON-LD documents, use importAsync() with jsonld.toRDF.
   */
  public static fromJsonLd(document: Record<string, unknown>): QuadInterface[] {
    const rawContext = document['@context'];
    const context: Record<string, string> = (
      typeof rawContext === 'object'
      && rawContext !== null
      && !Array.isArray(rawContext)
    )
      ? (rawContext as Record<string, string>)
      : {};

    const rawGraph = document['@graph'];

    if (Array.isArray(rawGraph)) {
      return JsonLdToQuads.fromNodes(rawGraph as Array<Record<string, unknown>>, context);
    }

    return [];
  }

  /**
   * Convert jsonld.js v8 N-Quads or object graph output to QuadInterface[].
   */
  public static fromJsonLdRdf(rdfOutput: unknown): QuadInterface[] {
    if (typeof rdfOutput === 'string') {
      return JsonLdToQuads.fromNQuads(rdfOutput);
    }

    // Object graph: { '@default': [ { subject, predicate, object } ] }
    if (typeof rdfOutput !== 'object' || rdfOutput === null) {
      return [];
    }
    const rdfObject = rdfOutput as Record<string, unknown>;
    const defaultGraph = rdfObject['@default'];

    if (!Array.isArray(defaultGraph)) {
      return [];
    }

    return defaultGraph.reduce((acc: QuadInterface[], quad: unknown): QuadInterface[] => {
      if (typeof quad === 'object' && quad !== null) {
        acc.push(Quads.fromExternal(quad as ExternalRdfJsQuadType));
      }

      return acc;
    }, []);
  }

  public static isDatatypeIri(iri: string): boolean {
    const result = SUPPORTED_XSD_DATATYPES.has(iri);

    return result;
  }

  /**
   * Normalise the import input into a flat QuadInterface[].
   *
   * - `QuadInterface[]` → passthrough (already canonical).
   * - `string` → JSON.parse then treated as a JSON-LD object.
   * - `object` → walked as a compact JSON-LD document.
   *
   * The synchronous walker handles the compact format that OwlProjection +
   * OntologyBuilder emit. For arbitrary JSON-LD documents use importAsync()
   * which calls jsonld.toRDF via the optional peerDependency.
   */
  public static normalize(jsonLd: QuadInterface[] | Record<string, unknown> | string): QuadInterface[] {
    if (Array.isArray(jsonLd)) {
      return jsonLd;
    }

    if (typeof jsonLd === 'string') {
      let parsed: unknown;

      try {
        parsed = JSON.parse(jsonLd);
      } catch (error) {
        const message = `Failed to parse JSON-LD string: ${error instanceof Error ? error.message : String(error)}`;
        const base = {
          'axiomIri': 'https://www.w3.org/TR/json-ld/',
          'code': OWL_IMPORT_ERROR_CODE.PARSE_FAILED,
          'subjectIri': null
        } as const;

        throw error instanceof Error
          ? new OwlImportError(message, {
            ...base,
            'cause': error
          })
          : new OwlImportError(message, base);
      }

      if (!DataType.isRecord(parsed)) {
        let parsedKind: string = typeof parsed;

        if (parsed === null) {
          parsedKind = 'null';
        } else if (Array.isArray(parsed)) {
          parsedKind = 'array';
        }

        throw new OwlImportError(
          `JSON-LD string must parse to a JSON object; got ${parsedKind}`,
          {
            'axiomIri': 'https://www.w3.org/TR/json-ld/',
            'code': OWL_IMPORT_ERROR_CODE.PARSE_FAILED,
            'subjectIri': null
          }
        );
      }

      return Quads.fromJsonLd(parsed);
    }

    return Quads.fromJsonLd(jsonLd);
  }

  /**
   * jsonld (v8) — optional peerDependency.
   *
   * When installed, provides a full JSON-LD processor for arbitrary JSON-LD
   * input beyond the compact format that the synchronous walker handles.
   * Not required when the caller passes QuadInterface[] or string/object input
   * that follows the OntologyBuilder compact format.
   */
  public static async tryLoadJsonLd(): Promise<JsonLdModuleType | null> {
    try {
      // jsonld is an optional peerDependency. Dynamic import is used so that
      // the missing package is caught at runtime rather than compile time.
      // The `catch` returns null, which the caller handles gracefully.
      const mod = await import('jsonld').catch((): null => {
        const result = null;

        return result;
      });

      if (mod === null) {
        return null;
      }

      return mod as unknown as JsonLdModuleType;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatcher table
// ---------------------------------------------------------------------------

const DISPATCHERS: readonly DispatcherFunctionType[] = [
  ClassAxioms.dispatch,
  ClassExpressions.dispatch,
  PropertyRestrictions.dispatch,
  Properties.dispatch,
  Characteristics.dispatch,
  Datatypes.dispatch,
  Individuals.dispatch,
  Annotations.dispatch
];

// ---------------------------------------------------------------------------
// Public class
// ---------------------------------------------------------------------------

/**
 * OwlImporter — orchestrates the OWL 2 TBox import pipeline.
 *
 * @remarks
 * Construct once and call `import()` for each input document.
 * The importer is stateless across calls. For synchronous use pass a
 * `QuadInterface[]` or a compact JSON-LD string/object produced by
 * `OntologyBuilder`. For arbitrary JSON-LD, call `importAsync()` which
 * requires the optional `jsonld` peerDependency.
 *
 * @example
 * ```ts
 * const importer = new OwlImporter({ baseIri: 'https://example.com/' });
 * const result = importer.import(jsonLdDoc);
 * ```
 *
 * @category OWL Import
 * @since 0.18.0
 * @see {@link OwlImportResultType}
 * @group OWL Import
 */
export class OwlImporter {
  private readonly baseIri: string;
  private readonly curie: CurieInterface;
  private readonly logger: LoggerInterface;
  private readonly prefixes: PrefixMapType;

  public constructor(options: OwlImporterOptionsType) {
    this.baseIri = options.baseIri;
    this.logger = options.logger ?? SILENT_LOGGER;

    const mergedPrefixes: PrefixMapType = Object.fromEntries([
      ...Object.entries(STANDARD_PREFIXES),
      ...Object.entries(options.prefixes ?? {})
    ]);

    this.prefixes = mergedPrefixes;
    this.curie = new Curie(this.prefixes);
  }

  /**
   * Import an OWL 2 TBox document and return a structured result.
   *
   * Quads are normalised via the synchronous JSON-LD compact walker (handles
   * OwlProjection output without external dependencies) and then ingested into a
   * SchemaGraph via SchemaGraph.fromQuads — the structural inverse of
   * OwlProjection.graph(). The populated graph is threaded into the import context
   * so dispatchers can traverse it via allRelations() and nodes(). If a dispatcher
   * encounters an unsupported axiom it calls ctx.reportUnsupported(); errors that
   * do not originate from a dispatcher bubble up normally.
   *
   * @param jsonLd - The input in one of three forms:
   *   - `QuadInterface[]` — already-parsed quads (pass-through).
   *   - `string` — a JSON-LD string (synchronous compact-walker parse).
   *   - `object` — a JSON-LD document (synchronous compact-walker parse).
   *   For arbitrary JSON-LD documents, use `importAsync()` which calls
   *   `jsonld.toRDF` via the optional peerDependency.
   * @returns OwlImportResultType with schemas, invariants, characteristics,
   *   sameAs, individuals, and unsupported entries.
   */
  public import(jsonLd: QuadInterface[] | Record<string, unknown> | string): OwlImportResultType {
    const quads = Quads.normalize(jsonLd);
    const graph = SchemaGraph.fromQuads(quads, {
      'baseIri': this.baseIri,
      'prefixes': this.prefixes
    });
    const allClassIris = Quads.collectClassIris(quads);
    const allDatatypeIris = Quads.collectDatatypeIris(quads);
    const allPropertyIris = Quads.collectPropertyIris(quads);

    const unsupported: Array<{ 'axiomIri': string;
      'subjectIri': null | string }> = [];

    const isDatatype = (iri: string): boolean => {
      return Quads.isDatatypeIri(iri) || allDatatypeIris.has(iri);
    };

    const reportUnsupported = (axiomIri: string, subjectIri: null | string): void => {
      unsupported.push({
        axiomIri,
        subjectIri
      });
    };

    const context: OwlImportContextType = {
      allClassIris,
      allPropertyIris,
      'baseIri': this.baseIri,
      'curie': this.curie,
      graph,
      isDatatype,
      'logger': this.logger,
      'prefixes': this.prefixes,
      reportUnsupported
    };

    const fragments: OwlImportFragmentType[] = [];

    // Every dispatcher is fully implemented; valid-but-unsupported constructs are
    // recorded via context.reportUnsupported (into `unsupported`). A dispatcher that
    // throws signals a real failure (e.g. malformed input) and propagates.
    for (const dispatcher of DISPATCHERS) {
      fragments.push(dispatcher(quads, context));
    }

    const merged = Fragments.merge(fragments);
    const schemas = Fragments.resolveSchemas(merged, allClassIris);

    if (unsupported.length > 0) {
      this.logger.warn(LogScope.format('OwlImporter', 'import', `${unsupported.length} unsupported construct(s) recorded`));
    }

    this.logger.info(LogScope.format('OwlImporter', 'import', `OWL TBox import complete: ${schemas.length} schema(s), ${merged.individuals.length} individual(s)`));

    return {
      'characteristics': merged.characteristics,
      'differentFrom': merged.differentFrom,
      'individuals': merged.individuals,
      'invariants': merged.invariants,
      'sameAs': merged.sameAs,
      schemas,
      unsupported
    };
  }

  /**
   * Import an OWL 2 TBox document asynchronously.
   *
   * Extends `import()` with full JSON-LD support via the optional `jsonld`
   * peerDependency. For `QuadInterface[]` input this is identical to `import()`.
   * For string/object JSON-LD input the `jsonld.toRDF` pipeline is used, which
   * handles arbitrary JSON-LD (not just the compact format OwlProjection emits).
   *
   * Requires `jsonld` (v8+) to be installed:
   *   npm install jsonld
   *
   * @param jsonLd - The input in one of three forms (same as `import()`).
   * @returns Promise<OwlImportResultType>
   */
  public async importAsync(jsonLd: QuadInterface[] | Record<string, unknown> | string): Promise<OwlImportResultType> {
    let quads: QuadInterface[];

    if (Array.isArray(jsonLd)) {
      quads = jsonLd;
    } else {
      const syncResult = Quads.normalize(jsonLd);

      if (syncResult.length > 0) {
        quads = syncResult;
      } else {
        const jsonLdModule = await Quads.tryLoadJsonLd();

        if (jsonLdModule === null) {
          this.logger.error(LogScope.format('OwlImporter', 'importAsync', 'optional jsonld peerDependency not installed; cannot process non-quad JSON-LD input'));
          throw new OwlImportError(
            'importAsync() with non-quad JSON-LD input requires the optional `jsonld` peerDependency. '
            + 'Install it with: npm install jsonld',
            {
              'axiomIri': 'https://www.w3.org/TR/json-ld/',
              'code': OWL_IMPORT_ERROR_CODE.PEER_DEPENDENCY_MISSING,
              'subjectIri': null
            }
          );
        }

        const document = typeof jsonLd === 'string'
          ? (JSON.parse(jsonLd) as unknown)
          : jsonLd;
        const rdfOutput = await jsonLdModule.toRDF(document, { 'format': 'application/n-quads' });

        quads = Quads.fromJsonLdRdf(rdfOutput);
      }
    }

    return this.import(quads);
  }
}
