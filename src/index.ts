/**
 * json-tology
 *
 * Declare your schemas once. Get types, validation, ontology, and ABox
 * projection from one graph-native model.
 */

// Error-code constant objects: machine-readable code lookup without importing
// from the constants subpath. Exported here so callers can do
// `import { InstantiationErrorCode } from 'json-tology'` as documented.
export {
  GraphErrorCode,
  InstantiationErrorCode,
  LoadErrorCode,
  MaterializationErrorCode,
  SchemaErrorCode
} from './constants/ERROR_CODES.js';
// Errors are runtime classes: tests catch them by class identity, callers
// throw them, instances cross the package boundary through the public API.
// They belong here, not under a subpath.
export * from './errors/BaseError.js';
export * from './errors/CoercionError.js';
export * from './errors/GraphError.js';
export * from './errors/InstantiationError.js';
export * from './errors/LoadError.js';
export * from './errors/MaterializationError.js';
export * from './errors/SchemaError.js';
export * from './errors/ValidationErrors.js';
// Runtime classes only.
//
// Type aliases live behind 'json-tology/types'; interface contracts live
// behind 'json-tology/interfaces'. Importing those from this top-level
// entry is forbidden - it forces consumers' bundlers to pull the entire
// type graph when they only wanted the runtime, and it invites circular
// import cycles when internal modules look up to the package root for a
// single type.
export * from './JsonTology.js';
export * from './modules/composition/Compose.js';
export * from './modules/data/Changeset.js';
export * from './modules/data/Path.js';
export * from './modules/data/Resolver.js';
export * from './modules/data/Value.js';
export * from './modules/graph/GraphEngine.js';
export * from './modules/hash/Hash.js';
export * from './modules/materialization/Materializer.js';
export * from './modules/ontology/GraphOntologySerializer.js';
export * from './modules/ontology/OntologyBuilder.js';
export * from './modules/rdf/Curie.js';
export * from './modules/rdf/Lift.js';
export * from './modules/rdf/Projection.js';
export * from './modules/rdf/Skolemize.js';
export * from './modules/transform/Transform.js';
