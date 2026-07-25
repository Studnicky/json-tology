/**
 * Types Module
 */

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
export type * from '../interfaces/QuadInterface.js';
export type * from './AboxGraph.js';
export type * from './AboxLiftSubjectFunctionType.js';
export type * from './AllowedKeysResultType.js';
export type * from './AnnotatedEdgeDescriptorType.js';
export type * from './AnnotationEmitModeType.js';
export type * from './Brand.js';
export type * from './BuildEntityFileOptionsType.js';
export type * from './BuildIndexSourceOptionsType.js';
export type * from './BuildNameMapResultType.js';
export type * from './BuildRelationsOptionsType.js';
export type * from './ClassExprResolveContextType.js';
export type * from './CompiledNodeValidationPlanType.js';
export type * from './Compiler.js';
export type * from './Compose.js';
export type * from './CompositionAccumulatorType.js';
export type * from './CompositionValidatorsResultType.js';
export type * from './ComputedFunctionType.js';
export type * from './ConditionalValidatorsResultType.js';
export type * from './ConstraintBrands.js';
export type * from './CustomKeywordEntryType.js';
export type * from './DefaultResolutionContextType.js';
export type * from './DependentSchemaValidatorEntryType.js';
export type * from './Diff.js';
export type * from './DumpFilterOptionsType.js';
export type * from './DumpOptionsType.js';
export type * from './DuplicateReportEntryType.js';
export type * from './DynamicScopeEntryType.js';
export type * from './EffectiveOptionsType.js';
export type * from './EmitBannerOptionsType.js';
export type * from './EmitRegistryOptionsType.js';
export type * from './EmitSchemaConstantsOptionsType.js';
export type * from './ErrorCodes.js';
export type * from './ErrorJsonType.js';
export type * from './ErrorOptions.js';
export type * from './ExecContextType.js';
export type * from './FacetDescriptorType.js';
export type * from './FailResultType.js';
export type * from './FetchLoaderOptionsType.js';
export type * from './Format.js';
export type * from './FormatPredicateType.js';
export type * from './GraphArtifactType.js';
export type * from './GraphCompileBaseOptionsType.js';
export type * from './GraphEngine.js';
export type * from './GraphEngineRestOptionsType.js';
export type * from './GraphLookupContextType.js';
export type * from './GraphLookupType.js';
export type * from './IdentifierIssuerOptionsType.js';
export type * from './Infer.js';
export type * from './Invariant.js';
export type * from './JsonLdDatasetQuadType.js';
export type * from './JsonLdDocumentInputType.js';
export type * from './JsonSchemaDefinitionType.js';
export type * from './JsonSchemaObjectType.js';
export type * from './JsonTologyOptionsType.js';
export type * from './JtConfig.js';
export type * from './KahnStepOptionsType.js';
export type * from './KeyPatternCheckResultType.js';
export type * from './LiftOptionsType.js';
export type * from './Loader.js';
export type * from './LookupSchemaFunctionType.js';
export type * from './Materializer.js';
export type * from './NormalizedToQuadsOptionsType.js';
export type * from './OntologyBuilderOptionsType.js';
export type * from './OwlCodegen.js';
export type * from './OwlGen.js';
export type * from './OwlImport.js';
export type * from './PassResultType.js';
export type * from './PatternPropValidatorEntryType.js';
export type * from './PlanArrayValidatorsType.js';
export type * from './PredicateForType.js';
export type * from './PredicateResolverFunctionType.js';
export type * from './PrefetchOptionsType.js';
export type * from './ProjectBaseArgumentListType.js';
export type * from './ProjectInstanceArgumentListType.js';
export type * from './ProjectionEmitContextType.js';
export type * from './ProjectPropertyArgumentListType.js';
export type * from './QuadEmitBaseType.js';
export type * from './QuadFactoryOpts.js';
export type * from './QuadOptionsType.js';
export type * from './ReferenceDecoderRegistryType.js';
export type * from './ReferenceTargetType.js';
export type * from './RegisteredTypes.js';
export type * from './Registry.js';
export type * from './RegistryDirContextType.js';
export type * from './RelationIndexType.js';
export type * from './ResolveRestrictionOptionsType.js';
export type * from './RootDialectPlanType.js';
export type * from './Schema.js';
export type * from './SchemaCompilerValidatePlanContextType.js';
export type * from './SchemaGraph.js';
export type * from './SchemaLookupType.js';
export type * from './SchemaReferences.js';
export type * from './SchemaReferenceType.js';
export type * from './SchemaRegistryEntryType.js';
export type * from './SchemaValidation.js';
export type * from './SemanticsBuildContextType.js';
export type * from './SerializeContextType.js';
export type * from './SetEntryType.js';
export type * from './ShaclEmitBaseArgumentsType.js';
export type * from './SingleFileBodyOptionsType.js';
export type * from './SkolemizeFunctionType.js';
export type * from './Snapshot.js';
export type * from './SubjectGroupType.js';
export type * from './ToQuadsOptionsType.js';
export type * from './Transform.js';
export type * from './TransformBrandType.js';
export type * from './TransformFnsType.js';
export type * from './TransformStage.js';
export type * from './TypeConfig.js';
export type * from './TypeErrors.js';
export type * from './Validation.js';
export type * from './Viz.js';
