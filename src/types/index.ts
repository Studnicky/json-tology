/**
 * Types Module
 */

export type * from '../interfaces/Quad.js';
export type * from './AboxGraph.js';
export type * from './AboxLiftSubjectFn.js';
export type * from './AllowedKeysResult.js';
export type * from './AnnotatedEdgeDescriptorType.js';
export * from './BaseTypes.js';
export type * from './Brand.js';
export type * from './BuildEntityFileOptions.js';
export type * from './BuildIndexSourceOptions.js';
export type * from './BuildNameMapResult.js';
export type * from './BuildRelationsOptions.js';
export type * from './ClassExprResolveContext.js';
export type * from './CompiledNodeValidationPlan.js';
export type * from './Compiler.js';
export type * from './Compose.js';
export type * from './CompositionAccumulator.js';
export type * from './CompositionValidatorsResult.js';
export type * from './Computed.js';
export type * from './ConditionalValidatorsResult.js';
export type * from './Config.js';
export type * from './ConstraintBrands.js';
export type * from './CustomKeywordEntry.js';
export type * from './DefaultResolutionContext.js';
export type * from './DependentSchemaValidatorEntry.js';
export type * from './Diff.js';
export type * from './Dump.js';
export type * from './DuplicateReportEntryType.js';
export type * from './DynamicScopeEntry.js';
export type * from './EffectiveOptions.js';
export type * from './EmitBannerOptions.js';
export type * from './EmitRegistryOptions.js';
export type * from './EmitSchemaConstantsOptions.js';
export type * from './Error.js';
export type * from './ErrorCodes.js';
export type * from './ErrorOptions.js';
export type * from './FacetDescriptorType.js';
export type * from './FailResultType.js';
export type * from './FetchLoaderOptions.js';
export type * from './Format.js';
export type * from './GraphArtifact.js';
export type * from './GraphCompileBaseOptions.js';
export type * from './GraphCompileOptions.js';
export type * from './GraphEngine.js';
export type * from './GraphLookup.js';
export type * from './GraphLookupContext.js';
export type * from './IdentifierIssuerOpts.js';
export type * from './Infer.js';
export type * from './InternalExecutionResult.js';
export type * from './Invariant.js';
export type * from './JsonLdDatasetQuadType.js';
export type * from './JsonLdDocInput.js';
export type * from './JsonSchema.js';
export type * from './JsonSchemaObjectType.js';
export type * from './JsonSchemaTypeName.js';
export type * from './JtConfig.js';
export type * from './KahnStepOptions.js';
export type * from './KeyPatternCheckResult.js';
export type * from './LiftOptionsType.js';
export type * from './Loader.js';
export type * from './LookupSchema.js';
export type * from './Materializer.js';
export type * from './NormalizedToQuadsOptions.js';
export type * from './OntologyBuilderOptionsType.js';
export type * from './OwlCodegen.js';
export type * from './OwlGen.js';
export type * from './OwlImport.js';
export type * from './PassResultType.js';
export type * from './PatternPropCheckEntry.js';
export type * from './PatternPropValidatorEntry.js';
export type * from './PlanArrayValidators.js';
export type * from './PredicateFor.js';
export type * from './PredicateResolverFn.js';
export type * from './Prefetch.js';
export type * from './ProjectBaseArgs.js';
export type * from './ProjectInstanceArgsType.js';
export type * from './ProjectionEmitContext.js';
export type * from './ProjectPropertyArgsType.js';
export type * from './PropCheck.js';
export type * from './QuadEmitBase.js';
export type * from './QuadFactoryOpts.js';
export type * from './QuadOptsType.js';
export type * from './RefDecoderRegistry.js';
export type * from './RefTarget.js';
export type * from './RegisteredTypes.js';
export type * from './Registry.js';
export type * from './RegistryDirContext.js';
export type * from './RelationIndex.js';
export type * from './ResolveRestrictionOptions.js';
export type * from './RootDialectPlan.js';
export type * from './Schema.js';
export type * from './SchemaCompilerCheckExecutionContext.js';
export type * from './SchemaCompilerGraphContext.js';
export type * from './SchemaCompilerValidatePlanContext.js';
export type * from './SchemaGraph.js';
export type * from './SchemaLookup.js';
export type * from './SchemaRef.js';
// Explicit named re-export so consumer module augmentation
// (`declare module 'json-tology/types' { interface JsonTologyReferencesInterface }`)
// merges into the canonical declaration that standalone `$ref` resolution
// defaults to. A bare `export type *` star re-export does not create an
// augmentable named binding, so registered schemas would never reach the
// resolver default.
export type { JsonTologyReferencesInterface } from './SchemaReferences.js';
export type * from './SchemaReferences.js';
export type * from './SchemaRegistryEntry.js';
export type * from './SchemaValidation.js';
export type * from './SemanticsBuildContext.js';
export type * from './SerializeContext.js';
export type * from './SetEntryType.js';
export type * from './ShaclEmitBaseArgs.js';
export type * from './SingleFileBodyOptions.js';
export type * from './Skolemize.js';
export type * from './Snapshot.js';
export type * from './SubjectGroup.js';
export type * from './ToQuadsOptions.js';
export type * from './Transform.js';
export type * from './TransformBrand.js';
export type * from './TransformFns.js';
export type * from './TransformStage.js';
// Explicit named re-export so consumer module augmentation
// (`declare module 'json-tology/types' { interface JsonTologyTypeConfigInterface }`)
// merges into the canonical declaration. A bare `export type *` star re-export
// does not create an augmentable named binding, so brand-disable config from
// consumers would never reach IsEnabledType.
export type { JsonTologyTypeConfigInterface } from './TypeConfig.js';
export type * from './TypeConfig.js';
export type * from './TypeErrors.js';
export type * from './Validation.js';
export type * from './VisitContext.js';
export type * from './VisitFn.js';
export type * from './Viz.js';
