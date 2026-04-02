/**
 * json-tology
 *
 * Declare your schemas once. Get types, validation, ontology, and ABox projection from one graph-native model.
 *
 * @example
 * import { JsonTology } from 'json-tology';
 * import type { InferType } from 'json-tology';
 *
 * const jt = JsonTology.create({
 *   baseIRI: 'https://myapp.io',
 *   schemas: [UserSchema, OrderSchema] as const,
 * });
 *
 * type User = InferType<typeof UserSchema>;
 *
 * jt.validate(UserSchema.$id, data);
 * jt.materialize(UserSchema, { name: 'Alice' });
 * jt.ontology().jsonLd();
 * jt.toQuads(UserSchema, data).jsonLd();
 */

// Errors
export * from './errors/BaseError.js';
export * from './errors/CoercionError.js';
export * from './errors/GraphError.js';
export * from './errors/LoadError.js';
export * from './errors/MaterializationError.js';
export * from './errors/SchemaError.js';
export * from './errors/ValidationErrors.js';

// Interfaces
export type * from './interfaces/Compose.js';
export type * from './interfaces/Config.js';
export type * from './interfaces/Curie.js';
export type * from './interfaces/Error.js';
export type * from './interfaces/GraphEngine.js';
export type * from './interfaces/Logger.js';
export type * from './interfaces/Materializer.js';
export type * from './interfaces/Ontology.js';
export type * from './interfaces/Quad.js';

// Runtime classes
export * from './JsonTology.js';
export * from './modules/composition/compose.js';
export * from './modules/data/changeset.js';
export * from './modules/data/value.js';
export * from './modules/graph/graphEngine.js';
export * from './modules/hash/Hash.js';
export * from './modules/materialization/materializer.js';
export * from './modules/ontology/GraphOntologySerializer.js';
export * from './modules/ontology/ontologyBuilder.js';
export * from './modules/rdf/curie.js';
export * from './modules/rdf/Lift.js';
export * from './modules/rdf/Projection.js';
export * from './modules/transform/transform.js';

// Types
export type * from './types/Brand.js';
export type * from './types/Compose.js';
export type * from './types/ConstraintBrands.js';
export type * from './types/Diff.js';
export type * from './types/ErrorCodes.js';
export type * from './types/Infer.js';
export type * from './types/Quad.js';
export type * from './types/Schema.js';
export type * from './types/Transform.js';
export type * from './types/TypeConfig.js';
export type * from './types/Validation.js';
