/**
 * Schema Module
 *
 * Low-level schema primitives. For most use cases, import from json-tology directly
 * and use the JsonTology class instead.
 */

export { SchemaRegistry, type RegistryOptions, type RegistryLogger } from './SchemaRegistry.js';
export { EntityBuilder, type EntityBuilderOptions, type InferSchema, type Infer } from './EntityBuilder.js';
export { Validator, type ValidationResult } from './Validator.js';
export {
  SchemaLoader,
  type SchemaLoadResult,
  type SchemaLoadError,
  type SchemaLogger,
} from './SchemaLoader.js';
export { ValidationErrors } from './ValidationErrors.js';
export { ParseError } from './ParseError.js';
export { OkResult } from './OkResult.js';
export { FailResult, type ParseResult } from './FailResult.js';
export type { ValidationError } from '../interfaces/validation.js';
export { Compose } from './Compose.js';
export type {
  ExtractRequired,
  ExtendSchema,
  IntersectionSchema,
  DiscriminatedUnionSchema,
  PartialSchema,
  RequiredSchema,
  PickSchema,
  OmitSchema,
} from '../types/compose.js';
export {
  Transform,
  type Transformed,
  type WithCatchSchema,
  type ParseOutput,
  type Branded,
  type BrandOutput,
} from './Transform.js';
export { Value } from './Value.js';
export { Changeset, type DiffOp, type SetOp, type DelOp } from './Changeset.js';
export { Compiler, type CompiledSchema } from './Compiler.js';
