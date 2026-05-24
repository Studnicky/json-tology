/**
 * OwlImporter — top-level orchestrator for OWL 2 TBox import.
 *
 * Converts OWL 2 quads (JSON-LD, raw quad array, or JSON-LD string) into
 * OwlImportResult: reconstructed JSON Schema objects, invariants, property
 * characteristics, owl:sameAs pairs, named individuals, and an unsupported-
 * axiom log for anything no dispatcher could handle.
 *
 * Phase 0: all eight dispatchers throw OWL_IMPORT_NOT_IMPLEMENTED.
 * The orchestrator catches those errors and accumulates them into
 * result.unsupported so the pipeline can complete end-to-end against
 * an empty or non-empty input without panicking.
 *
 * Phase 0.5: normalizeInput now resolves JSON-LD string/object inputs via the
 * optional `jsonld` peer dependency. SchemaGraph.fromQuads (the structural inverse
 * of OwlProjection.graph) is used to populate the import context graph from quads.
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type {
  DispatcherFnType,
  OwlImportContext,
  OwlImporterOptions,
  OwlImportFragment,
  OwlImportResult,
  PrefixMap
} from '../../interfaces/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../types/Schema.js';
import type { InvariantInterface } from '../../interfaces/Invariant.js';
import type { QuadObjectType } from '../../types/Quad.js';
import { Curie } from '../rdf/Curie.js';
import { DEFAULT_PREFIXES } from '../../constants/PREFIXES.js';
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
// Internal helpers
// ---------------------------------------------------------------------------

function isOwlImportNotImplemented(err: unknown): err is OwlImportError {
  return (
    err instanceof OwlImportError
    && err.code === 'OWL_IMPORT_NOT_IMPLEMENTED'
  );
}

function mergeFragments(fragments: OwlImportFragment[]): OwlImportFragment {
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();
  const invariants: Array<{ 'invariant': InvariantInterface;
    'schemaId': string; }> = [];
  const characteristics: Array<{ 'characteristic': string;
    'propertyIri': string; }> = [];
  const sameAs: Array<readonly [string, string]> = [];
  const individuals: Array<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }> = [];

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
    for (const inv of fragment.invariants) {
      invariants.push(inv);
    }
    for (const ch of fragment.characteristics) {
      characteristics.push(ch);
    }
    for (const pair of fragment.sameAs) {
      sameAs.push(pair);
    }
    for (const ind of fragment.individuals) {
      individuals.push(ind);
    }
  }

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
    'http://www.w3.org/2000/01/rdf-schema#Class',
    'http://www.w3.org/2002/07/owl#Class',
    'owl:Class',
    'rdfs:Class'
  ]);
  const TYPE_PREDICATES = new Set([
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
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
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
    'http://www.w3.org/2002/07/owl#DatatypeProperty',
    'http://www.w3.org/2002/07/owl#ObjectProperty',
    'owl:DatatypeProperty',
    'owl:ObjectProperty',
    'rdf:Property'
  ]);
  const TYPE_PREDICATES = new Set([
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
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
    'http://www.w3.org/2000/01/rdf-schema#Datatype',
    'rdfs:Datatype'
  ]);
  const TYPE_PREDICATES_DT = new Set([
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
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

/**
 * Supported XSD and json-tology datatype IRIs (prefixed and full-IRI forms).
 */
const SUPPORTED_DATATYPES = new Set<string>([
  'http://www.w3.org/2001/XMLSchema#anyURI',
  'http://www.w3.org/2001/XMLSchema#base64Binary',
  'http://www.w3.org/2001/XMLSchema#boolean',
  'http://www.w3.org/2001/XMLSchema#date',
  'http://www.w3.org/2001/XMLSchema#dateTime',
  'http://www.w3.org/2001/XMLSchema#decimal',
  'http://www.w3.org/2001/XMLSchema#double',
  'http://www.w3.org/2001/XMLSchema#duration',
  'http://www.w3.org/2001/XMLSchema#float',
  'http://www.w3.org/2001/XMLSchema#hexBinary',
  'http://www.w3.org/2001/XMLSchema#int',
  'http://www.w3.org/2001/XMLSchema#integer',
  'http://www.w3.org/2001/XMLSchema#long',
  'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
  // XSD full IRIs
  'http://www.w3.org/2001/XMLSchema#string',
  'http://www.w3.org/2001/XMLSchema#time',
  'http://www.w3.org/2002/07/owl#Nothing',
  // owl:Nothing for null-like types
  'owl:Nothing',
  'xsd:anyURI',
  'xsd:base64Binary',
  'xsd:boolean',
  'xsd:date',
  'xsd:dateTime',
  'xsd:decimal',
  'xsd:double',
  'xsd:duration',
  'xsd:float',
  'xsd:hexBinary',
  'xsd:int',
  'xsd:integer',
  'xsd:long',
  'xsd:nonNegativeInteger',
  'xsd:short',
  // XSD prefixed
  'xsd:string',
  'xsd:time'
]);

function isDatatype(iri: string): boolean {
  return SUPPORTED_DATATYPES.has(iri);
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
interface JsonLdModule {
  'toRDF': (doc: unknown, opts?: { 'format'?: string }) => Promise<unknown>
}

async function tryLoadJsonLd(): Promise<JsonLdModule | null> {
  try {
    // jsonld is an optional peerDependency — resolve via an indirect specifier
    // string to avoid a hard compile-time dependency.
    // TypeScript does not know about this package; the cast is structurally safe
    // because we only use toRDF() which is declared in JsonLdModule above.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const loadFn = new Function('id', 'return import(id)') as (id: string) => Promise<unknown>;
    const mod = await loadFn('jsonld');

    return mod as JsonLdModule;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fromJsonLdRdfOutput — convert jsonld.js output to QuadInterface[]
// ---------------------------------------------------------------------------

interface ExternalRdfJsQuad {
  'object': { 'datatype'?: { 'value': string };
    'language'?: string;
    'termType': string;
    'value': string };
  'predicate': { 'value': string };
  'subject': { 'value': string }
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
    .filter((quad): quad is ExternalRdfJsQuad => {
      return typeof quad === 'object' && quad !== null;
    })
    .map((quad) => {
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
    });
}

// ---------------------------------------------------------------------------
// normalizeJsonLdInput — synchronous compact JSON-LD walker
// ---------------------------------------------------------------------------

/**
 * Normalise a JSON-LD object (already parsed from string) to QuadInterface[].
 *
 * Handles the compact JSON-LD format that OntologyBuilder produces:
 * - @context: prefix map (prefix → namespace IRI)
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

const DISPATCHERS: readonly DispatcherFnType[] = [
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
 * Construct once and call `import()` for each input document.
 * The importer is stateless across calls.
 */
export class OwlImporter {
  private readonly baseIRI: string;
  private readonly curie: Curie;
  private readonly prefixes: PrefixMap;

  public constructor(options: OwlImporterOptions) {
    this.baseIRI = options.baseIRI;
    this.prefixes = {
      ...DEFAULT_PREFIXES,
      ...options.prefixes
    };
    this.curie = new Curie(this.prefixes);
  }

  /**
   * Import an OWL 2 TBox document and return a structured result.
   *
   * Phase 0.5+: quads are normalised via the synchronous JSON-LD compact walker
   * (handles OwlProjection output without external dependencies) and then
   * ingested into a SchemaGraph via SchemaGraph.fromQuads — the structural inverse
   * of OwlProjection.graph(). The populated graph is threaded into the import
   * context so phase-1 dispatchers can traverse it.
   *
   * Phase 0 dispatchers throw NOT_IMPLEMENTED; those errors are caught and
   * surfaced in result.unsupported so the pipeline completes cleanly.
   *
   * @param jsonLd - The input in one of three forms:
   *   - `QuadInterface[]` — already-parsed quads (pass-through).
   *   - `string` — a JSON-LD string (synchronous compact-walker parse).
   *   - `object` — a JSON-LD document (synchronous compact-walker parse).
   *   For arbitrary JSON-LD documents, use `importAsync()` which calls
   *   `jsonld.toRDF` via the optional peerDependency.
   * @returns OwlImportResult with schemas, invariants, characteristics,
   *   sameAs, individuals, and unsupported entries.
   */
  public import(jsonLd: object | QuadInterface[] | string): OwlImportResult {
    const quads = normalizeInput(jsonLd);
    // SchemaGraph.fromQuads is the structural inverse of OwlProjection.graph().
    // It ingests OWL-vocabulary quads and produces a SchemaGraphInterface that
    // phase-1 dispatchers can traverse via allRelations() and nodes().
    const graph = SchemaGraph.fromQuads(quads, {
      'baseIRI': this.baseIRI,
      'prefixes': this.prefixes
    });
    const allClassIris = collectClassIris(quads);
    const allDatatypeIris = collectDatatypeIris(quads);
    const allPropertyIris = collectPropertyIris(quads);

    const unsupported: Array<{ 'axiomIri': string;
      'subjectIri': null | string }> = [];

    const ctx: OwlImportContext = {
      allClassIris,
      allPropertyIris,
      'baseIRI': this.baseIRI,
      'curie': this.curie,
      graph,
      'isDatatype': (iri: string) => {
        return isDatatype(iri) || allDatatypeIris.has(iri);
      },
      'prefixes': this.prefixes,
      'reportUnsupported': (axiomIri: string, subjectIri: null | string) => {
        unsupported.push({
          axiomIri,
          subjectIri
        });
      }
    };

    const fragments: OwlImportFragment[] = [];

    for (const dispatcher of DISPATCHERS) {
      try {
        fragments.push(dispatcher(quads, ctx));
      } catch (error) {
        if (isOwlImportNotImplemented(error)) {
          // Dispatcher stub — record as unsupported and continue.
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
   * @returns Promise<OwlImportResult>
   */
  public async importAsync(jsonLd: object | QuadInterface[] | string): Promise<OwlImportResult> {
    let quads: QuadInterface[];

    if (Array.isArray(jsonLd)) {
      quads = jsonLd as QuadInterface[];
    } else {
      // Attempt synchronous compact walker first (no dependency required).
      const syncResult = normalizeInput(jsonLd);

      if (syncResult.length > 0) {
        quads = syncResult;
      } else {
        // Fall back to jsonld.toRDF for arbitrary JSON-LD documents.
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

    // Delegate to the synchronous pipeline with the resolved quads.
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
 * Phase 0: all class IRIs from the input graph receive a minimal schema
 * object `{ $id: classIri }`. Phase 1 dispatchers will populate the deltas
 * with real structural data before this function runs.
 */
function resolveSchemaDeltas(
  merged: OwlImportFragment,
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
