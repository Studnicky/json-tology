/**
 * json-tology
 *
 * Declare your schemas once. Get types, validation, building, and ontology for free.
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
 * jt.build(UserSchema, { name: 'Alice' });
 * jt.ontology().n3();
 */

// Primary export
export { JsonTology, type JsonTologyOptions } from './JsonTology.js';

// Loggers
export { SilentLogger } from './SilentLogger.js';
export { ConsoleLogger } from './ConsoleLogger.js';
export type { Logger } from './interfaces/logger.js';

// Type derivation
export { type Infer, type InferSchema } from './schema/EntityBuilder.js';

// Schema composition utilities
export { Compose } from './schema/Compose.js';
export type {
  ExtractRequired,
  ExtendSchema,
  IntersectionSchema,
  DiscriminatedUnionSchema,
  PartialSchema,
  RequiredSchema,
  PickSchema,
  OmitSchema,
} from './types/compose.js';

// Transforms and branding
export {
  Transform,
  type Transformed,
  type WithCatchSchema,
  type ParseOutput,
  type Branded,
  type BrandOutput,
} from './schema/Transform.js';

// Value utilities
export { Value } from './schema/Value.js';
export { Changeset, type DiffOp, type SetOp, type DelOp } from './schema/Changeset.js';

// Error types and utilities
export { ValidationErrors } from './schema/ValidationErrors.js';
export { ParseError } from './schema/ParseError.js';
export { OkResult } from './schema/OkResult.js';
export { FailResult, type ParseResult } from './schema/FailResult.js';
export type { ValidationError } from './interfaces/validation.js';

// Pre-built base types and schema factories
export {
  BaseTypes,
  makeResponseSchema,
  makeResultSchema,
  makePageSchema,
} from './types/index.js';

// Ontology utilities (low-level, for advanced use)
export { OntologyBuilder, type OntologyBuilderOptions, CurieExpander } from './ontology/index.js';
