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

// Errors — canonical locations
export { BaseError } from './errors/BaseError.js';
export { CoercionError } from './errors/CoercionError.js';
export { GraphError } from './errors/GraphError.js';
export { LoadError } from './errors/LoadError.js';
export { MaterializationError } from './errors/MaterializationError.js';
export { SchemaError } from './errors/SchemaError.js';
export { ValidationErrors } from './errors/ValidationErrors.js';
export type {
  DiscriminatedUnionSchemaInterface,
  IntersectionSchemaInterface,
  OmitSchemaInterface,
  PickSchemaInterface
} from './interfaces/compose.js';
export type { JsonTologyOptionsInterface } from './interfaces/config.js';
export type { CurieInterface } from './interfaces/curie.js';
export type { ErrorJsonInterface } from './interfaces/error.js';
export type {
  GraphEngineOptionsInterface, GraphExecutionResultInterface
} from './interfaces/graph-engine.js';
// Types from canonical locations
export type { LoggerInterface } from './interfaces/logger.js';
export type { MaterializerOptionsInterface } from './interfaces/materializer.js';
export type { OntologyBuilderOptionsInterface } from './interfaces/ontology.js';
export type { QuadInterface } from './interfaces/quad.js';
export { JsonTology } from './JsonTology.js';
export { Compose } from './modules/composition/Compose.js';

export { Changeset } from './modules/data/Changeset.js';
export { Value } from './modules/data/Value.js';
export { GraphEngine } from './modules/graph/GraphEngine.js';
export { Hash } from './modules/hash/Hash.js';
// Runtime exports
export { Materializer } from './modules/materialization/Materializer.js';
export { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
export { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
export { Curie } from './modules/rdf/Curie.js';
export {
  fromRdfQuad, liftInstances
} from './modules/rdf/Lift.js';
export type { RdfJsQuadInterface } from './modules/rdf/Lift.js';
export {
  projectAbox, projectGraph
} from './modules/rdf/Projection.js';
export { Transform } from './modules/transform/Transform.js';
export type {
  BrandedType, BrandOutputType
} from './types/brand.js';
export type {
  ExtendSchemaType,
  ExtractRequiredType,
  PartialSchemaType,
  RequiredSchemaType
} from './types/compose.js';
export type {
  ContainsBrandInterface,
  ContentEncodingBrandInterface,
  ContentMediaTypeBrandInterface,
  DialectBrandInterface,
  ExclusiveMaximumBrandInterface,
  ExclusiveMinimumBrandInterface,
  FormatBrandInterface,
  MaximumBrandInterface,
  MaxItemsBrandInterface,
  MaxLengthBrandInterface,
  MaxPropertiesBrandInterface,
  MinimumBrandInterface,
  MinItemsBrandInterface,
  MinLengthBrandInterface,
  MinPropertiesBrandInterface,
  MultipleOfBrandInterface,
  PatternBrandInterface,
  SchemaIdBrandInterface,
  UniqueItemsBrandInterface
} from './types/constraint-brands.js';
export type {
  DelOpType, DiffOpType, SetOpType
} from './types/diff.js';
export type {
  GraphErrorCodeType, LoadErrorCodeType, SchemaErrorCodeType
} from './types/error-codes.js';
export type {
  DefaultAlignedType,
  DeprecatedKeysType,
  DiscriminatorPropertyType,
  EnumValuesType,
  ExhaustiveType,
  InferSchemaType,
  IntegerRangeType,
  LooseInputType,
  MultipleOfRangeType,
  NominalSchemaType,
  NonDeprecatedSchemaType
} from './types/infer.js';
export type { QuadObjectType } from './types/quad.js';
export type { InferType } from './types/schema.js';

export type {
  TransformedType
} from './types/transform.js';
export type {
  IsEnabledType,
  JsonTologyTypeConfigInterface
} from './types/type-config.js';
export type { ValidationErrorType } from './types/validation.js';
