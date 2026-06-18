/**
 * OWL 2 import interfaces.
 *
 * Shared contracts between the OwlImporter orchestrator and the eight
 * per-axiom-group dispatcher modules under importDispatch/.
 */

import type { InvariantType } from './Invariant.js';
import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { LoggerInterface } from '../interfaces/LoggerInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options accepted by the {@link OwlImporter} constructor.
 *
 * @remarks
 * `baseIri` anchors relative IRIs during the import session.
 * `prefixes` extends the default `STANDARD_PREFIXES` map with project-specific
 * prefix bindings used to compact and expand IRIs throughout the import pipeline.
 *
 * @example
 * ```ts
 * const importer = new OwlImporter({ baseIri: 'https://example.com/', prefixes: { ex: 'https://example.com/' } });
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportContextType}
 * @group Import
 */
export type OwlImporterOptionsType = {
  /** Base IRI for the import session. Used when building OwlImportContextType. */
  readonly 'baseIri': string;
  /** Optional logger; defaults to SILENT_LOGGER. */
  readonly 'logger'?: LoggerInterface;
  /** Additional prefix mappings merged with STANDARD_PREFIXES. */
  readonly 'prefixes'?: PrefixMapType;
};

/**
 * A prefix-to-IRI map, identical in structure to the prefixes accepted by
 * JsonTology and Curie — a plain string record.
 *
 * @remarks
 * Used throughout the import pipeline to compactify and expand IRIs. The
 * `STANDARD_PREFIXES` constant provides the default set; project-specific
 * prefixes are merged on top via `OwlImporterOptionsType.prefixes`.
 *
 * @example
 * ```ts
 * const prefixes: PrefixMapType = { schema: 'https://schema.org/', ex: 'https://example.com/' };
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImporterOptionsType}
 * @group Import
 */
export type PrefixMapType = Record<string, string>;

/**
 * Map from subject IRI / blank-node ID to all quads with that subject.
 * Shared by the OwlImporter dispatcher modules to avoid re-building the index
 * per dispatcher call.
 *
 * @remarks
 * Built once by the orchestrator from the full quad set and passed into every
 * dispatcher via `OwlImportContextType`. Keys are full subject IRIs or blank-node
 * identifiers; values are all quads sharing that subject.
 *
 * @example
 * ```ts
 * const index: SubjectIndexType = new Map();
 * for (const quad of quads) {
 *   const key = quad.subject.value;
 *   (index.get(key) ?? (index.set(key, []), index.get(key)!)).push(quad);
 * }
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link DispatcherFnType}
 * @group Import
 */
export type SubjectIndexType = Map<string, QuadInterface[]>;

/**
 * Signature of a per-axiom-group dispatcher function.
 * Receives the full quad set for a subject and the import context,
 * returns the fragment of import data it extracted.
 *
 * @remarks
 * Each dispatcher module under `importDispatch/` exports a function matching
 * this interface. The orchestrator calls each dispatcher in sequence and
 * deep-merges the returned fragments into the final `OwlImportResultType`.
 *
 * @example
 * ```ts
 * const dispatcher: DispatcherFnType = (quads, ctx) => {
 *   return { characteristics: [], individuals: [], invariants: [], sameAs: [], schemaDeltas: new Map() };
 * };
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportFragmentType}
 * @group Dispatchers
 */
export type DispatcherFnType = (quads: QuadInterface[], ctx: OwlImportContextType) => OwlImportFragmentType;

/**
 * The value returned by each dispatcher after processing its axiom group.
 *
 * The orchestrator merges all fragments before constructing the final
 * OwlImportResultType.
 *
 * @remarks
 * Each field is a partial accumulation — dispatchers that do not produce a
 * given category return an empty array or empty Map for that field. The
 * orchestrator deep-merges all fragments, with later entries winning on
 * per-key conflicts in `schemaDeltas`.
 *
 * @example
 * ```ts
 * const fragment: OwlImportFragmentType = {
 *   characteristics: [], individuals: [], invariants: [],
 *   sameAs: [], schemaDeltas: new Map(),
 * };
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportResultType}
 * @group Import
 */
export type OwlImportFragmentType = {
  /** OWL property characteristics discovered during import (e.g. Functional, Transitive). */
  'characteristics': ReadonlyArray<{ 'characteristic': string;
    'propertyIri': string; }>;

  /** owl:differentFrom pairs (individual IRI pairs asserted distinct). */
  'differentFrom': ReadonlyArray<readonly [string, string]>;

  /** Named individuals (ABox assertions) found in the TBox input. */
  'individuals': ReadonlyArray<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }>;

  /** Per-schema structural invariants produced during import (e.g. min/max cardinality checks). */
  'invariants': ReadonlyArray<{ 'invariant': InvariantType;
    'schemaId': string; }>;

  /** owl:sameAs pairs (individual IRI pairs asserted identical). */
  'sameAs': ReadonlyArray<readonly [string, string]>;

  /** Per-class schema property deltas: classIri → partial JSON Schema object. */
  'schemaDeltas': ReadonlyMap<string, Partial<JsonSchemaDocumentObjectType>>;
};

/**
 * Context threaded into every dispatcher call.
 *
 * Provides read-only access to the graph, prefix machinery, and IRI
 * membership sets so dispatchers can resolve and validate without
 * re-deriving those structures.
 *
 * @remarks
 * The orchestrator constructs one `OwlImportContextType` per import session and
 * passes the same instance to every dispatcher. Dispatchers must not mutate
 * context fields; they use `reportUnsupported` to record unhandled axioms.
 *
 * @example
 * ```ts
 * function myDispatcher(_quads: QuadInterface[], ctx: OwlImportContextType): OwlImportFragmentType {
 *   const expanded = ctx.curie.expand('owl:Class');
 *   ctx.reportUnsupported('owl:unknownAxiom', null);
 *   return { characteristics: [], individuals: [], invariants: [], sameAs: [], schemaDeltas: new Map() };
 * }
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportFragmentType}
 * @group Import
 */
export type OwlImportContextType = {
  /** Set of all class IRIs present in the input graph. */
  'allClassIris': ReadonlySet<string>;

  /** Set of all property IRIs (datatype and object) present in the input graph. */
  'allPropertyIris': ReadonlySet<string>;

  /** Base IRI of the import session (from OwlImporter constructor options). */
  'baseIri': string;

  /** CURIE handler for expanding and compacting IRIs. */
  'curie': CurieInterface;

  /** The SchemaGraph built from the input quads. */
  'graph': SchemaGraphInterface;

  /**
   * Returns true when the given IRI is a supported XSD or json-tology datatype.
   * Used by Datatypes and PropertyRestrictions dispatchers to validate range IRIs.
   */
  'isDatatype': (iri: string) => boolean;

  /** Prefix-to-IRI map in effect for the import session. */
  'prefixes': PrefixMapType;

  /**
   * Record an axiom or predicate IRI that the dispatcher does not handle.
   * The orchestrator accumulates these into OwlImportResultType.unsupported.
   */
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
};

/**
 * The top-level result returned by OwlImporter.import() and
 * JsonTology.fromTbox().
 *
 * @remarks
 * Aggregates the output of all per-axiom-group dispatchers after merging.
 * `schemas` contains the reconstructed JSON Schema objects for every class
 * declared in the TBox. `unsupported` logs axiom IRIs that no dispatcher
 * recognised — useful for diagnosing incomplete imports.
 *
 * @example
 * ```ts
 * const result = await jt.fromTbox(owlQuads);
 * for (const schema of result.schemas) {
 *   jt.register(schema);
 * }
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportFragmentType}
 * @group Import
 */
export type OwlImportResultType = {
  /** Property characteristics harvested from property axioms. */
  'characteristics': ReadonlyArray<{ 'characteristic': string;
    'propertyIri': string; }>;

  /** owl:differentFrom pairs extracted from the input graph. */
  'differentFrom': ReadonlyArray<readonly [string, string]>;

  /** Named individuals (ABox assertions) found in the TBox input. */
  'individuals': ReadonlyArray<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }>;

  /** Structural invariants derived from OWL axioms (e.g. cardinality constraints). */
  'invariants': ReadonlyArray<{ 'invariant': InvariantType;
    'schemaId': string; }>;

  /** owl:sameAs pairs extracted from the input graph. */
  'sameAs': ReadonlyArray<readonly [string, string]>;

  /** JSON Schema objects reconstructed from TBox class declarations. */
  'schemas': readonly JsonSchemaDocumentObjectType[];

  /**
   * Axiom/predicate IRIs for valid constructs a dispatcher recognized but does
   * not project into the schema graph. Populated via `ctx.reportUnsupported`.
   */
  'unsupported': ReadonlyArray<{ 'axiomIri': string;
    'subjectIri': null | string }>;
};
