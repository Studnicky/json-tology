/**
 * SHACL validator internal index and evaluation types.
 *
 * Extracted from ShaclValidator.ts for canonical placement. These are internal
 * to the SHACL engine and are not re-exported from the public `./types` entry.
 *
 * @internal
 * @module Shacl
 * @category SHACL
 * @since 0.20.0
 */

/** Predicate-to-object-value-strings index for a single subject. */
export type PredicateValuesIndexType = Map<string, string[]>;

/** Subject-to-predicate-to-object-value-strings index for quad lookup. */
export type SubjectPredicateIndexType = Map<string, PredicateValuesIndexType>;

/** Per-subject type set for rdf:type lookups. */
export type TypeIndexType = Map<string, Set<string>>;

/** Datatype IRI of each literal object per subject+predicate, for data quads. */
export type DatatypeIndexType = Map<string, PredicateValuesIndexType>;

/** A parsed property shape. */
export type PropertyShapeIndexType = {
  readonly 'bnodeId': string;
  readonly 'constraints': PredicateValuesIndexType;
  readonly 'isDeactivated': boolean;
  readonly 'path': string;
};

/** A parsed node shape. */
export type NodeShapeIndexType = {
  readonly 'constraints': PredicateValuesIndexType;
  readonly 'isDeactivated': boolean;
  readonly 'propertyShapes': PropertyShapeIndexType[];
  readonly 'shapeIri': string;
};

/**
 * Shared validation context threaded through every evaluator. `resolveShape`
 * returns the parsed view for any shape id (named NodeShape or anonymous
 * blank-node member shape), and `visited` guards `sh:node`/`sh:and`/`sh:or`/
 * `sh:not` recursion against cyclic data so a self-referential graph cannot
 * overflow the stack.
 */
export type ValidationContextType = {
  readonly 'dataIndex': SubjectPredicateIndexType;
  readonly 'datatypeBySubjectPredicate': DatatypeIndexType;
  readonly 'dataTypeIndex': TypeIndexType;
  readonly 'resolveShape': (shapeId: string) => NodeShapeIndexType | undefined;
  readonly 'shapeIndex': SubjectPredicateIndexType;
  readonly 'visited': Set<string>;
};

/** Arguments shared across all constraint evaluators. */
export type EvalArgsType = {
  readonly 'constraints': PredicateValuesIndexType;
  readonly 'dataIndex': SubjectPredicateIndexType;
  readonly 'datatypeBySubjectPredicate': DatatypeIndexType;
  readonly 'dataTypeIndex': TypeIndexType;
  readonly 'focusNode': string;
  readonly 'path': string;
  readonly 'shapeId': string;
  readonly 'shapeIndex': SubjectPredicateIndexType;
  readonly 'valueCount': number;
  readonly 'values': string[];
};
