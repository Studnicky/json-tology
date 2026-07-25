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
export type PropertyShapeIndexType
  = { 'bnodeId': string;
    'isDeactivated': boolean;
    'path': string }
  & { 'constraints': PredicateValuesIndexType };

/** A parsed node shape. */
export type NodeShapeIndexType = {
  'constraints': PredicateValuesIndexType;
  'isDeactivated': boolean;
  'propertyShapes': PropertyShapeIndexType[];
  'shapeIri': string;
};

/**
 * Shared validation context threaded through every evaluator. `resolveShape`
 * returns the parsed view for any shape id (named NodeShape or anonymous
 * blank-node member shape), and `visited` guards `sh:node`/`sh:and`/`sh:or`/
 * `sh:not` recursion against cyclic data so a self-referential graph cannot
 * overflow the stack.
 */
export type ValidationContextType = {
  'dataIndex': SubjectPredicateIndexType;
  'datatypeBySubjectPredicate': DatatypeIndexType;
  'dataTypeIndex': TypeIndexType;
  'resolveShape': (shapeId: string) => NodeShapeIndexType | undefined;
  'shapeIndex': SubjectPredicateIndexType;
  'visited': Set<string>;
};

/** Arguments shared across all constraint evaluators. */
export type EvalArgumentsType = {
  'constraints': PredicateValuesIndexType;
  'dataIndex': SubjectPredicateIndexType;
  'datatypeBySubjectPredicate': DatatypeIndexType;
  'dataTypeIndex': TypeIndexType;
  'focusNode': string;
  'path': string;
  'shapeId': string;
  'shapeIndex': SubjectPredicateIndexType;
  'valueCount': number;
  'values': string[];
};
