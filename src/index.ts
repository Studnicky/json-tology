/**
 * json-tology
 *
 * Declare your schemas once. Get types, validation, ontology, and ABox projection from one graph-native model.
 *
 * @example
 * import { JsonTology, InferType } from 'json-tology';
 *
 * const jt = new JsonTology({
 *   baseIRI: 'https://myapp.io',
 *   schemas: [UserSchema, OrderSchema],
 * });
 *
 * type User = InferType<typeof UserSchema>;
 *
 * jt.validate(UserSchema.$id, data);
 * jt.materialize(UserSchema, { name: 'Alice' });
 * jt.ontology().jsonLd();
 * jt.abox(UserSchema, data).jsonLd();
 */

// Errors — canonical location
export {
  BaseError, GraphError, LoadError, MaterializationError, ParseError, SchemaError
} from './errors/index.js';
export type {
  ErrorJsonInterface, GraphErrorCodeType, LoadErrorCodeType, SchemaErrorCodeType
} from './errors/index.js';
export { ValidationErrors } from './errors/ValidationErrors.js';
export type { JsonTologyOptionsInterface } from './interfaces/config.js';
export type {
  GraphEngineOptionsInterface, GraphExecutionResultInterface
} from './interfaces/graph-engine.js';
// Types from canonical locations
export type { LoggerInterface } from './interfaces/logger.js';
export type { MaterializerOptionsInterface } from './interfaces/materializer.js';
export type { OntologyBuilderOptionsInterface } from './interfaces/ontology.js';
export { JsonTology } from './JsonTology.js';
export { Compose } from './modules/composition/Compose.js';
export { Changeset } from './modules/data/Changeset.js';

export { Value } from './modules/data/Value.js';
export { GraphEngine } from './modules/graph/GraphEngine.js';
export { Hash } from './modules/hash/Hash.js';
// Runtime exports
export { Logger } from './modules/logger/Logger.js';
export { Materializer } from './modules/materialization/Materializer.js';
export {
  GraphOntologySerializer, OntologyBuilder
} from './modules/ontology/index.js';
export {
  projectAbox, projectGraph
} from './modules/rdf/index.js';
export type {
  QuadInterface, QuadObjectType
} from './modules/rdf/index.js';
export { Transform } from './modules/transform/Transform.js';
export type {
  BrandedType, BrandOutputType
} from './types/brand.js';
export type {
  DiscriminatedUnionSchemaInterface,
  ExtendSchemaType,
  ExtractRequiredType,
  IntersectionSchemaInterface,
  OmitSchemaInterface,
  PartialSchemaType,
  PickSchemaInterface,
  RequiredSchemaType
} from './types/compose.js';
export type {
  DelOpType, DiffOpType, SetOpType
} from './types/diff.js';
export type {
  InferSchemaType, InferType
} from './types/schema.js';

export type {
  ParseOutputType, TransformedType
} from './types/transform.js';
export type { ValidationErrorType } from './types/validation.js';
