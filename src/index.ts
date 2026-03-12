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
 * jt.ontology().n3();
 * jt.abox(UserSchema, data).jsonLd();
 */

// Types from canonical locations
export type { LoggerInterface } from './interfaces/logger.js';
export type { JsonTologyOptionsInterface } from './interfaces/config.js';
export type { GraphEngineOptionsInterface, GraphExecutionResultInterface } from './interfaces/graph-engine.js';
export type { MaterializerOptionsInterface } from './interfaces/materializer.js';
export type { OntologyBuilderOptionsInterface } from './interfaces/ontology.js';
export type { ValidationErrorType } from './types/validation.js';
export type { DelOpType, DiffOpType, SetOpType } from './types/diff.js';
export type { BrandedType, BrandOutputType } from './types/brand.js';
export type { InferType, InferSchemaType } from './types/schema.js';
export type { ParseOutputType, TransformedType } from './types/transform.js';
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

// Runtime exports
export { Logger } from './modules/logger/Logger.js';
export { JsonTology } from './JsonTology.js';
export { CurieExpander, GraphOntologySerializer, OntologyBuilder } from './modules/ontology/index.js';
export { Changeset } from './modules/data/Changeset.js';
export { Compose } from './modules/composition/Compose.js';
export { GraphEngine } from './modules/graph/GraphEngine.js';
export { Hash } from './modules/hash/Hash.js';
export { Materializer } from './modules/materialization/Materializer.js';
export { ParseError } from './modules/validation/ParseError.js';
export { Transform } from './modules/transform/Transform.js';
export { ValidationErrors } from './modules/validation/ValidationErrors.js';
export { Value } from './modules/data/Value.js';
