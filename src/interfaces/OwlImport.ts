/**
 * OWL 2 import interfaces.
 *
 * Shared contracts between the OwlImporter orchestrator and the eight
 * per-axiom-group dispatcher modules under importDispatch/.
 */

import type { InvariantInterface } from './Invariant.js';
import type { CurieInterface } from './Curie.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options accepted by the {@link OwlImporter} constructor.
 */
export interface OwlImporterOptions {
  /** Base IRI for the import session. Used when building OwlImportContext. */
  readonly 'baseIRI': string;
  /** Additional prefix mappings merged with DEFAULT_PREFIXES. */
  readonly 'prefixes'?: PrefixMap;
}

/**
 * A prefix-to-IRI map, identical in structure to the prefixes accepted by
 * JsonTology and Curie — a plain string record.
 */
export type PrefixMap = Record<string, string>;

/**
 * The value returned by each dispatcher after processing its axiom group.
 *
 * The orchestrator merges all fragments before constructing the final
 * OwlImportResult.
 */
export interface OwlImportFragment {
  /** OWL property characteristics discovered during import (e.g. Functional, Transitive). */
  'characteristics': ReadonlyArray<{ 'characteristic': string;
    'propertyIri': string; }>;

  /** Named individuals (ABox assertions) found in the TBox input. */
  'individuals': ReadonlyArray<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }>;

  /** Per-schema structural invariants produced during import (e.g. min/max cardinality checks). */
  'invariants': ReadonlyArray<{ 'invariant': InvariantInterface;
    'schemaId': string; }>;

  /** owl:sameAs pairs (individual IRI pairs asserted identical). */
  'sameAs': ReadonlyArray<readonly [string, string]>;

  /** Per-class schema property deltas: classIri → partial JSON Schema object. */
  'schemaDeltas': ReadonlyMap<string, Partial<JsonSchemaDocumentObjectType>>;
}

/**
 * Context threaded into every dispatcher call.
 *
 * Provides read-only access to the graph, prefix machinery, and IRI
 * membership sets so dispatchers can resolve and validate without
 * re-deriving those structures.
 */
export interface OwlImportContext {
  /** Set of all class IRIs present in the input graph. */
  'allClassIris': ReadonlySet<string>;

  /** Set of all property IRIs (datatype and object) present in the input graph. */
  'allPropertyIris': ReadonlySet<string>;

  /** Base IRI of the import session (from OwlImporter constructor options). */
  'baseIRI': string;

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
  'prefixes': PrefixMap;

  /**
   * Record an axiom or predicate IRI that the dispatcher does not handle.
   * The orchestrator accumulates these into OwlImportResult.unsupported.
   */
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
}

/**
 * The top-level result returned by OwlImporter.import() and
 * JsonTology.fromTbox().
 */
export interface OwlImportResult {
  /** Property characteristics harvested from property axioms. */
  'characteristics': ReadonlyArray<{ 'characteristic': string;
    'propertyIri': string; }>;

  /** Named individuals (ABox assertions) found in the TBox input. */
  'individuals': ReadonlyArray<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }>;

  /** Structural invariants derived from OWL axioms (e.g. cardinality constraints). */
  'invariants': ReadonlyArray<{ 'invariant': InvariantInterface;
    'schemaId': string; }>;

  /** owl:sameAs pairs extracted from the input graph. */
  'sameAs': ReadonlyArray<readonly [string, string]>;

  /** JSON Schema objects reconstructed from TBox class declarations. */
  'schemas': readonly JsonSchemaDocumentObjectType[];

  /**
   * Axiom/predicate IRIs that no dispatcher handled.
   * Phase-0: all dispatcher stubs contribute here via NOT_IMPLEMENTED.
   */
  'unsupported': ReadonlyArray<{ 'axiomIri': string;
    'subjectIri': null | string }>;
}
