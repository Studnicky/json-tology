/**
 * OwlImporter — top-level orchestrator for OWL 2 TBox import.
 *
 * Converts OWL 2 quads (JSON-LD, raw quad array, or JSON-LD string) into
 * OwlImportResultType: reconstructed JSON Schema objects, invariants, property
 * characteristics, owl:sameAs pairs, named individuals, and an unsupported-
 * axiom log for anything no dispatcher could handle.
 *
 * normalizeInput resolves JSON-LD string/object inputs via the synchronous
 * compact-walker (no external dependency for OwlProjection output). For arbitrary
 * JSON-LD, importAsync() delegates to the optional `jsonld` peerDependency.
 * SchemaGraph.fromQuads (the structural inverse of OwlProjection.graph) populates
 * the import context graph so dispatchers can traverse it via allRelations() and nodes().
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type {
  DispatcherFnInterface,
  OwlImportContextType,
  OwlImporterOptionsType,
  OwlImportFragmentType,
  OwlImportResultType,
  PrefixMap
} from '../../types/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../types/Schema.js';
import type { InvariantType } from '../../types/Invariant.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { JsonLdModuleType } from '../../types/JsonLdModuleType.js';
import type { ExternalRdfJsQuadType } from '../../types/ExternalRdfJsQuadType.js';
import { Curie } from '../rdf/Curie.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import {
  OWL, RDF, RDFS
} from '../../constants/IRI.js';
import { SUPPORTED_XSD_DATATYPES } from '../../constants/XSD_REVERSE_MAPS.js';
import { OwlImportError } from '../../errors/OwlImportError.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { Terms } from '../rdf/Terms.js';
import {
  jsonLdNodesToQuads,
  parseNQuads
} from '../rdf/JsonLdToQuads.js';
import { importAnnotations } from './importDispatch/Annotations.js';
import { importCharacteristics } from './importDispatch/Characteristics.js';
import { importClassAxioms } from './importDispatch/ClassAxioms.js';
import { importClassExpressions } from './importDispatch/ClassExpressions.js';
import { importDatatypes } from './importDispatch/Datatypes.js';
import { importIndividuals } from './importDispatch/Individuals.js';
import { importProperties } from './importDispatch/Properties.js';
import { importPropertyRestrictions } from './importDispatch/PropertyRestrictions.js';

// ---------------------------------------------------------------------------
// IRI constants — derive from STANDARD_PREFIXES to avoid embedded literal values
// ---------------------------------------------------------------------------

const OWL_NS = STANDARD_PREFIXES.owl;
const RDFS_NS_IRI = STANDARD_PREFIXES.rdfs;
const RDF_NS_IRI = STANDARD_PREFIXES.rdf;

/** Full-IRI forms of owl:Class and rdfs:Class. */
const OWL_CLASS_IRI = `${OWL_NS}Class`;
const RDFS_CLASS_IRI = `${RDFS_NS_IRI}Class`;

/** Full-IRI form of rdf:Property. */
const RDF_PROPERTY_IRI = `${RDF_NS_IRI}Property`;

/** Full-IRI forms of OWL property types. */
const OWL_OBJECT_PROPERTY_IRI = `${OWL_NS}ObjectProperty`;
const OWL_DATATYPE_PROPERTY_IRI = `${OWL_NS}DatatypeProperty`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isOwlImportNotImplemented(err: unknown): err is OwlImportError {
  return (
    err instanceof OwlImportError
    && err.code === 'OWL_IMPORT_NOT_IMPLEMENTED'
  );
}

// ---------------------------------------------------------------------------
// mergeFragments helpers
// ---------------------------------------------------------------------------

/** Merge all schema deltas from a list of fragments into a single map. */
function mergeSchemaDeltas(fragments: OwlImportFragmentType[]): Map<string, Partial<JsonSchemaDocumentObjectType>> {
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();

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

/** Flatten a list of fragment arrays into a single array. */
function flattenFragmentArrays<T>(fragments: OwlImportFragmentType[], key: keyof OwlImportFragmentType): T[] {
  const result: T[] = [];

  for (const fragment of fragments) {
    for (const item of fragment[key] as Iterable<T>) {
      result.push(item);
    }
  }

  return result;
}

function mergeFragments(fragments: OwlImportFragmentType[]): OwlImportFragmentType {
  const schemaDeltas = mergeSchemaDeltas(fragments);
  const invariants = flattenFragmentArrays<{ 'invariant': InvariantType;
    'schemaId': string; }>(fragments, 'invariants');
  const characteristics = flattenFragmentArrays<{ 'characteristic': string;
    'propertyIri': string; }>(fragments, 'characteristics');
  const sameAs = flattenFragmentArrays<readonly [string, string]>(fragments, 'sameAs');
  const individuals = flattenFragmentArrays<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }>(fragments, 'individuals');

  return {
    characteristics,
    individuals,
    invariants,
    sameAs,
    'schemaDeltas': schemaDeltas
  };
}

/**
 * Extract class IRIs from an array of quads.
 * A subject is treated as a class IRI when a quad asserts
 * `<subject> rdf:type owl:Class` or `<subject> rdf:type rdfs:Class`.
 */
function collectClassIris(quads: QuadInterface[]): ReadonlySet<string> {
  const classIris = new Set<string>();
  const CLASS_TYPES = new Set([
    OWL.Class,
    'owl:Class',
    OWL_CLASS_IRI,
    'rdfs:Class',
    RDFS_CLASS_IRI
  ]);
  const TYPE_PREDICATES = new Set([
    RDF.type,
    'rdf:type'
  ]);

  for (const quad of quads) {
    if (
      TYPE_PREDICATES.has(quad.predicate.value)
      && quad.object.termType === 'NamedNode'
      && CLASS_TYPES.has(quad.object.value)
    ) {
      classIris.add(quad.subject.value);
    }
  }

  return classIris;
}

/**
 * Extract property IRIs (owl:ObjectProperty, owl:DatatypeProperty,
 * rdf:Property) from an array of quads.
 */
function collectPropertyIris(quads: QuadInterface[]): ReadonlySet<string> {
  const propertyIris = new Set<string>();
  const PROPERTY_TYPES = new Set([
    OWL.DatatypeProperty,
    OWL.ObjectProperty,
    'owl:DatatypeProperty',
    'owl:ObjectProperty',
    OWL_DATATYPE_PROPERTY_IRI,
    OWL_OBJECT_PROPERTY_IRI,
    'rdf:Property',
    RDF_PROPERTY_IRI
  ]);
  const TYPE_PREDICATES = new Set([
    RDF.type,
    'rdf:type'
  ]);

  for (const quad of quads) {
    if (
      TYPE_PREDICATES.has(quad.predicate.value)
      && quad.object.termType === 'NamedNode'
      && PROPERTY_TYPES.has(quad.object.value)
    ) {
      propertyIris.add(quad.subject.value);
    }
  }

  return propertyIris;
}

/**
 * Extract rdfs:Datatype subject IRIs from an array of quads.
 * Used to extend ctx.isDatatype() with custom named datatypes.
 */
function collectDatatypeIris(quads: QuadInterface[]): ReadonlySet<string> {
  const datatypeIris = new Set<string>();
  const DATATYPE_TYPES = new Set([
    `${RDFS_NS_IRI}Datatype`,
    RDFS.Datatype,
    'rdfs:Datatype'
  ]);
  const TYPE_PREDICATES_DT = new Set([
    RDF.type,
    'rdf:type'
  ]);

  for (const quad of quads) {
    if (
      TYPE_PREDICATES_DT.has(quad.predicate.value)
      && quad.object.termType === 'NamedNode'
      && DATATYPE_TYPES.has(quad.object.value)
    ) {
      datatypeIris.add(quad.subject.value);
    }
  }

  return datatypeIris;
}

function isDatatypeIri(iri: string): boolean {
  return SUPPORTED_XSD_DATATYPES.has(iri);
}

// ---------------------------------------------------------------------------
// jsonld optional peerDependency (async pipeline only)
// ---------------------------------------------------------------------------

/**
 * jsonld (v8) — optional peerDependency.
 *
 * When installed, provides a full JSON-LD processor for arbitrary JSON-LD
 * input beyond the compact format that the synchronous walker handles.
 * Not required when the caller passes QuadInterface[] or string/object input
 * that follows the OntologyBuilder compact format.
 */
async function tryLoadJsonLd(): Promise<JsonLdModuleType | null> {
  try {
    // jsonld is an optional peerDependency. Dynamic import is used so that
    // the missing package is caught at runtime rather than compile time.
    // The `catch` returns null, which the caller handles gracefully.
    const mod = await import('jsonld').catch((): null => {
      return null;
    });

    if (mod === null) {
      return null;
    }

    return mod as unknown as JsonLdModuleType;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fromJsonLdRdfOutput — convert jsonld.js output to QuadInterface[]
// ---------------------------------------------------------------------------

/** Build a single QuadInterface from an external RDF/JS quad shape. */
function buildQuadFromExternal(quad: ExternalRdfJsQuadType): QuadInterface {
  const obj = quad.object;
  let objectTerm: QuadObjectType;

  if (obj.termType === 'Literal') {
    objectTerm = Terms.literal(obj.value, {
      'datatype': Terms.iri(obj.datatype?.value ?? ''),
      'language': obj.language ?? ''
    });
  } else if (obj.termType === 'BlankNode') {
    objectTerm = Terms.blank(obj.value);
  } else {
    objectTerm = Terms.iri(obj.value);
  }

  return Terms.quad(
    Terms.iri(quad.subject.value),
    Terms.iri(quad.predicate.value),
    objectTerm,
    Terms.defaultGraph()
  );
}

/**
 * Convert jsonld.js v8 N-Quads or object graph output to QuadInterface[].
 */
function fromJsonLdRdfOutput(rdfOutput: unknown): QuadInterface[] {
  if (typeof rdfOutput === 'string') {
    return parseNQuads(rdfOutput);
  }

  // Object graph: { '@default': [ { subject, predicate, object } ] }
  if (typeof rdfOutput !== 'object' || rdfOutput === null) {
    return [];
  }
  const rdfObj = rdfOutput as Record<string, unknown>;
  const defaultGraph = rdfObj['@default'];

  if (!Array.isArray(defaultGraph)) {
    return [];
  }

  return defaultGraph
    .filter((quad: unknown): quad is ExternalRdfJsQuadType => {
      return typeof quad === 'object' && quad !== null;
    })
    .map((quad: ExternalRdfJsQuadType): QuadInterface => {
      return buildQuadFromExternal(quad);
    });
}

// ---------------------------------------------------------------------------
// normalizeJsonLdInput — synchronous compact JSON-LD walker
// ---------------------------------------------------------------------------

/**
 * Normalise a JSON-LD object (already parsed from string) to QuadInterface[].
 *
 * Handles the compact JSON-LD format that OntologyBuilder produces:
 * - @context: prefix-to-IRI map (prefix label to IRI prefix string)
 * - @graph: array of subject nodes with @id, @type, and predicate entries
 *
 * For arbitrary JSON-LD documents, use importAsync() with jsonld.toRDF.
 */
function normalizeJsonLdInput(doc: object): QuadInterface[] {
  const docRecord = doc as Record<string, unknown>;
  const rawContext = docRecord['@context'];
  const context: Record<string, string> = (
    typeof rawContext === 'object'
    && rawContext !== null
    && !Array.isArray(rawContext)
  )
    ? (rawContext as Record<string, string>)
    : {};

  const rawGraph = docRecord['@graph'];

  if (Array.isArray(rawGraph)) {
    return jsonLdNodesToQuads(rawGraph as Array<Record<string, unknown>>, context);
  }

  // Flat JSON-LD array (no @graph wrapper)
  if (Array.isArray(doc)) {
    return jsonLdNodesToQuads(doc as Array<Record<string, unknown>>, context);
  }

  return [];
}

// ---------------------------------------------------------------------------
// normalizeInput — main sync entry point
// ---------------------------------------------------------------------------

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
function normalizeInput(jsonLd: object | QuadInterface[] | string): QuadInterface[] {
  if (Array.isArray(jsonLd)) {
    return jsonLd as QuadInterface[];
  }

  if (typeof jsonLd === 'string') {
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonLd);
    } catch {
      return [];
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return [];
    }

    return normalizeJsonLdInput(parsed);
  }

  return normalizeJsonLdInput(jsonLd);
}

// ---------------------------------------------------------------------------
// Dispatcher table
// ---------------------------------------------------------------------------

const DISPATCHERS: readonly DispatcherFnInterface[] = [
  importClassAxioms,
  importClassExpressions,
  importPropertyRestrictions,
  importProperties,
  importCharacteristics,
  importDatatypes,
  importIndividuals,
  importAnnotations
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
 * const importer = new OwlImporter({ baseIRI: 'https://example.com/' });
 * const result = importer.import(jsonLdDoc);
 * ```
 *
 * @category OWL Import
 * @since 0.18.0
 * @see {@link OwlImportResultType}
 * @group OWL Import
 */
export class OwlImporter {
  private readonly baseIRI: string;
  private readonly curie: CurieInterface;
  private readonly prefixes: PrefixMap;

  public constructor(options: OwlImporterOptionsType) {
    this.baseIRI = options.baseIRI;
    this.prefixes = {
      ...STANDARD_PREFIXES,
      ...options.prefixes
    };
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
  public import(jsonLd: object | QuadInterface[] | string): OwlImportResultType {
    const quads = normalizeInput(jsonLd);
    const graph = SchemaGraph.fromQuads(quads, {
      'baseIRI': this.baseIRI,
      'prefixes': this.prefixes
    });
    const allClassIris = collectClassIris(quads);
    const allDatatypeIris = collectDatatypeIris(quads);
    const allPropertyIris = collectPropertyIris(quads);

    const unsupported: Array<{ 'axiomIri': string;
      'subjectIri': null | string }> = [];

    const ctx: OwlImportContextType = {
      allClassIris,
      allPropertyIris,
      'baseIRI': this.baseIRI,
      'curie': this.curie,
      graph,
      'isDatatype': (iri: string): boolean => {
        return isDatatypeIri(iri) || allDatatypeIris.has(iri);
      },
      'prefixes': this.prefixes,
      'reportUnsupported': (axiomIri: string, subjectIri: null | string): void => {
        unsupported.push({
          axiomIri,
          subjectIri
        });
      }
    };

    const fragments: OwlImportFragmentType[] = [];

    for (const dispatcher of DISPATCHERS) {
      try {
        fragments.push(dispatcher(quads, ctx));
      } catch (error) {
        if (isOwlImportNotImplemented(error)) {
          unsupported.push({
            'axiomIri': error.axiomIri,
            'subjectIri': error.subjectIri
          });
        } else {
          throw error;
        }
      }
    }

    const merged = mergeFragments(fragments);
    const schemas = resolveSchemaDeltas(merged, allClassIris);

    return {
      'characteristics': merged.characteristics,
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
  public async importAsync(jsonLd: object | QuadInterface[] | string): Promise<OwlImportResultType> {
    let quads: QuadInterface[];

    if (Array.isArray(jsonLd)) {
      quads = jsonLd as QuadInterface[];
    } else {
      const syncResult = normalizeInput(jsonLd);

      if (syncResult.length > 0) {
        quads = syncResult;
      } else {
        const jsonLdModule = await tryLoadJsonLd();

        if (jsonLdModule === null) {
          throw new OwlImportError(
            'OWL_IMPORT_NOT_IMPLEMENTED',
            'importAsync() with non-quad JSON-LD input requires the optional `jsonld` peerDependency. '
            + 'Install it with: npm install jsonld',
            'https://www.w3.org/TR/json-ld/',
            null
          );
        }

        const doc = typeof jsonLd === 'string'
          ? (JSON.parse(jsonLd) as unknown)
          : jsonLd;
        const rdfOutput = await jsonLdModule.toRDF(doc, { 'format': 'application/n-quads' });

        quads = fromJsonLdRdfOutput(rdfOutput);
      }
    }

    return this.import(quads);
  }
}

// ---------------------------------------------------------------------------
// Schema delta resolution
// ---------------------------------------------------------------------------

/**
 * Convert the merged schemaDeltas map into final JsonSchemaDocumentObjectType
 * objects, resolving cross-class $ref IRIs where possible.
 *
 * All class IRIs from the input graph receive a minimal schema object
 * `{ $id: classIri }` as a baseline. Dispatcher-populated deltas are merged
 * in before the final schema objects are emitted.
 */
function resolveSchemaDeltas(
  merged: OwlImportFragmentType,
  allClassIris: ReadonlySet<string>
): readonly JsonSchemaDocumentObjectType[] {
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
