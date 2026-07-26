/**
 * Types Module
 */

export * from '../entities/AboxIdentityDescriptorEntity.js';
export * from '../entities/AboxPredicateObjectEntity.js';
export * from '../entities/AboxPredicateSubjectEntity.js';
export * from '../entities/AggregateViewEntity.js';
export * from '../entities/BuildEntityFileOptionsEntity.js';
export * from '../entities/BuildIndexSourceOptionsEntity.js';
export * from '../entities/BuildNameMapResultEntity.js';
export * from '../entities/BuiltinFormatNameEntity.js';
export * from '../entities/CoercionErrorCodeEntity.js';
export * from '../entities/CompiledValidateOptionsEntity.js';
export * from '../entities/CompiledValidationResultEntity.js';
export * from '../entities/DelOpEntity.js';
export * from '../entities/DiffOpEntity.js';
export * from '../entities/DumpFilterOptionsEntity.js';
export * from '../entities/DumpOptionsEntity.js';
export * from '../entities/DuplicateReportEntryEntity.js';
export * from '../entities/EmitBannerOptionsEntity.js';
export * from '../entities/ErrorJsonEntity.js';
export * from '../entities/GenerateRegistryDirectoryEntityFileEntity.js';
export * from '../entities/GenerateRegistryDirectoryResultEntity.js';
export * from '../entities/GraphErrorCodeEntity.js';
export * from '../entities/InstantiationErrorCodeEntity.js';
export * from '../entities/JsonLdDatasetQuadEntity.js';
export * from '../entities/MaterializationErrorCodeEntity.js';
export * from '../entities/NumberFormatNameEntity.js';
export * from '../entities/OwlImportErrorCodeEntity.js';
export * from '../entities/ProblemDetailsEntity.js';
export * from '../entities/ProblemDetailsErrorEntryEntity.js';
export * from '../entities/ProblemDetailsOverridesEntity.js';
export * from '../entities/PropertyCharacteristicEntity.js';
export * from '../entities/RegistryFileEntryEntity.js';
export * from '../entities/RegistryFilesResultEntity.js';
export * from '../entities/SchemaErrorCodeEntity.js';
export * from '../entities/SchemaLoadErrorCodeEntity.js';
export * from '../entities/SchemaTypeNameOrArrayEntity.js';
export * from '../entities/SerializeContextEntity.js';
export * from '../entities/SetEntryEntity.js';
export * from '../entities/SetOpEntity.js';
export * from '../entities/ShaclEmitBaseArgumentsEntity.js';
export * from '../entities/StringFormatNameEntity.js';
export * from '../entities/TransformErrorCodeEntity.js';
export * from '../entities/ValidateWithErrorsResultEntity.js';
export * from '../entities/ValidationErrorEntity.js';
export * from '../entities/WrittenEntityFileEntity.js';
export type * from '../interfaces/AboxLiftFunctionInterface.js';
export type * from '../interfaces/AboxLiftSubjectFunctionInterface.js';
export type * from '../interfaces/BuildDepsMapInterface.js';
export type * from '../interfaces/BuildInDegreeMapInterface.js';
export type * from '../interfaces/ClassExprResolveContextInterface.js';
export type * from '../interfaces/CompiledNodeValidationPlanInterface.js';
export type * from '../interfaces/CompiledValidatorInterface.js';
export type * from '../interfaces/CompositionAccumulatorInterface.js';
export type * from '../interfaces/CompositionValidatorsResultInterface.js';
export type * from '../interfaces/ComputedFunctionInterface.js';
export type * from '../interfaces/ConditionalPropertyKeySetInterface.js';
export type * from '../interfaces/CustomKeywordEntryInterface.js';
export type * from '../interfaces/DefaultResolutionContextInterface.js';
export type * from '../interfaces/DependentSchemaValidatorEntryInterface.js';
export type * from '../interfaces/DispatcherInterface.js';
export type * from '../interfaces/EnumPrimitiveSetInterface.js';
export type * from '../interfaces/GenerateFromTboxOptionsInterface.js';
export type * from '../interfaces/GenerateRegistryDirectoryOptionsInterface.js';
export type * from '../interfaces/GraphCompileBaseOptionsInterface.js';
export type * from '../interfaces/GraphEngineOptionsInterface.js';
export type * from '../interfaces/GraphLookupInterface.js';
export type * from '../interfaces/InheritedPropertyKeySetInterface.js';
export type * from '../interfaces/InvariantFunctionInterface.js';
// Explicit named re-export so consumer module augmentation
// (`declare module 'json-tology/types' { interface JsonTologyReferencesInterface }`)
// merges into the canonical declaration that standalone `$ref` resolution
// defaults to. A bare `export type *` star re-export does not create an
// augmentable named binding, so registered schemas would never reach the
// resolver default.
export type { JsonTologyReferencesInterface } from '../interfaces/JsonTologyReferencesInterface.js';
// Explicit named re-export so consumer module augmentation
// (`declare module 'json-tology/types' { interface JsonTologyTypeConfigInterface }`)
// merges into the canonical declaration. A bare `export type *` star re-export
// does not create an augmentable named binding, so brand-disable config from
// consumers would never reach IsEnabledType.
export type { JsonTologyTypeConfigInterface } from '../interfaces/JsonTologyTypeConfigInterface.js';
export type * from '../interfaces/JtStrictPerFieldMapInterface.js';
export type * from '../interfaces/KeywordContextInterface.js';
export type * from '../interfaces/KeywordDefinitionInterface.js';
export type * from '../interfaces/OwlCodegenOptionsInterface.js';
export type * from '../interfaces/OwlImportContextInterface.js';
export type * from '../interfaces/OwlImporterOptionsInterface.js';
export type * from '../interfaces/OwlImportFragmentInterface.js';
export type * from '../interfaces/OwlImportResultInterface.js';
export type * from '../interfaces/OwlRegistryDirOptionsInterface.js';
export type * from '../interfaces/PatternPropValidatorEntryInterface.js';
export type * from '../interfaces/PlanArrayValidatorsInterface.js';
export type * from '../interfaces/PrefetchOptionsInterface.js';
export type * from '../interfaces/PrefixMapInterface.js';
export type * from '../interfaces/PropertyDefaultsMapInterface.js';
export type * from '../interfaces/PropValidatorsMapInterface.js';
export type * from '../interfaces/QuadInterface.js';
export type * from '../interfaces/SchemaRegistryEntryInterface.js';
export type * from '../interfaces/SemanticsBuildContextInterface.js';
export type * from '../interfaces/SnapshotInterface.js';
export type * from '../interfaces/SubjectIndexInterface.js';
export type * from '../interfaces/ToQuadsOptionsInterface.js';
export type * from '../interfaces/TransformBrandInterface.js';
export type * from '../interfaces/TransformFnsInterface.js';
export type * from '../interfaces/ValidateWithErrorsFunctionInterface.js';
export type * from './Brand.js';
export type * from './Compose.js';
export type * from './ConstraintBrands.js';
export type * from './ExecContextOverridesType.js';
export type * from './FacetDescriptorType.js';
export type * from './FormatPredicateType.js';
export type * from './Infer.js';
export type * from './Invariant.js';
export type * from './JsonSchemaDefinitionType.js';
export type * from './JsonSchemaObjectType.js';
export type * from './PredicateForType.js';
export type * from './RegisteredTypes.js';
export type * from './Registry.js';
export type * from './Schema.js';
export type * from './SchemaGraph.js';
export type * from './SchemaReferences.js';
export type * from './SchemaReferenceType.js';
export type * from './SchemaValidation.js';
export type * from './Transform.js';
export type * from './TypeConfig.js';
export type * from './TypeErrors.js';
