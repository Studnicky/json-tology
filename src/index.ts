/**
 * json-tology
 *
 * Declare your schemas once. Get types, validation, ontology, and ABox projection from one graph-native model.
 *
 * @example
 * import { JsonTology, Infer } from 'json-tology';
 *
 * const jt = new JsonTology({
 *   baseIRI: 'https://myapp.io',
 *   schemas: [UserSchema, OrderSchema],
 * });
 *
 * type User = Infer<typeof UserSchema>;
 *
 * jt.validate(UserSchema.$id, data);
 * jt.materialize(UserSchema, { name: 'Alice' });
 * jt.ontology().n3();
 * jt.abox(UserSchema, data).jsonLd();
 */

export { ConsoleLogger } from './ConsoleLogger.js';

export type { Logger } from './interfaces/logger.js';
export type { ValidationError } from './interfaces/validation.js';
// Primary export
export {
  JsonTology, type JsonTologyOptions
} from './JsonTology.js';

// Ontology utilities (low-level, for advanced use)
export {
  CurieExpander, GraphOntologySerializer, OntologyBuilder, type OntologyBuilderOptions
} from './ontology/index.js';

export {
  Changeset, type DelOp, type DiffOp, type SetOp
} from './schema/Changeset.js';
// Schema composition utilities
export { Compose } from './schema/Compose.js';
export {
  GraphEngine, type GraphEngineOptions, type GraphExecutionResult
} from './schema/GraphEngine.js';
export {
  Materializer, type MaterializerOptions
} from './schema/Materializer.js';

// Type derivation
export {
  type Infer, type InferSchema
} from './schema/Materializer.js';

export { ParseError } from './schema/ParseError.js';
// Transforms and branding
export {
  type Branded,
  type BrandOutput,
  type ParseOutput,
  Transform,
  type Transformed,
  type WithCatchSchema
} from './schema/Transform.js';
// Error types and utilities
export { ValidationErrors } from './schema/ValidationErrors.js';
// Value utilities
export { Value } from './schema/Value.js';
// Loggers
export { SilentLogger } from './SilentLogger.js';

export type {
  DiscriminatedUnionSchema,
  ExtendSchema,
  ExtractRequired,
  IntersectionSchema,
  OmitSchema,
  PartialSchema,
  PickSchema,
  RequiredSchema
} from './types/compose.js';

// Pre-built base types and schema factories
export {
  BaseTypes,
  makePageSchema,
  makeResponseSchema,
  makeResultSchema
} from './types/index.js';
