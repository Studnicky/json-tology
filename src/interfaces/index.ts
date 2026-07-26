export type * from './AboxGraphInterface.js';
export type * from './AboxLiftFunctionInterface.js';
export type * from './AllowedKeysResultInterface.js';
export type * from './ApplyFacetRelationOptionsInterface.js';
export type * from './ApplyRestrictionsOptionsInterface.js';
export type * from './ArrayValidationOptionsInterface.js';
export type * from './BaseErrorOptionsInterface.js';
export type * from './BuildDepsMapInterface.js';
export type * from './BuildInDegreeMapInterface.js';
export type * from './BuildNodePlanOptionsInterface.js';
export type * from './BuildOutputOptionsInterface.js';
export type * from './ChangesetInterface.js';
export type * from './CliWriterInterface.js';
export type * from './CoercionErrorOptionsInterface.js';
export type * from './CollectStepResultInterface.js';
export type * from './ComputedFunctionInterface.js';
export type * from './ComputedStoreInterface.js';
export type * from './ConditionalValidatorsResultInterface.js';
export type * from './CurieInterface.js';
export type * from './CursorInterface.js';
export type * from './DifferentFromStoreInterface.js';
export type * from './DispatcherInterface.js';
export type * from './DynamicScopeEntryInterface.js';
export type * from './EffectiveOptionsInterface.js';
export type * from './ExecContextInterface.js';
export type * from './ExtractFacetOptionsInterface.js';
export type * from './FailResultInterface.js';
export type * from './FetchLoaderOptionsInterface.js';
export type * from './FormatRegistryInterface.js';
export type * from './GenerateFromTboxOptionsInterface.js';
export type * from './GenerateRegistryDirectoryOptionsInterface.js';
export type * from './GraphAccessorInterface.js';
export type * from './GraphArtifactInterface.js';
export type * from './GraphEngineInterface.js';
export type * from './GraphEngineOptionsInterface.js';
export type * from './GraphEngineRestOptionsInterface.js';
export type * from './GraphErrorOptionsInterface.js';
export type * from './GraphLookupContextInterface.js';
export type * from './GraphSchemaSerializerInterface.js';
export type * from './GraphSerializerInterface.js';
export type * from './IdentifierIssuerInterface.js';
export type * from './IdentifierIssuerOptionsInterface.js';
export type * from './InstantiationErrorOptionsInterface.js';
export type * from './InvariantFunctionInterface.js';
export type * from './IriMinterInterface.js';
export type * from './JsonTologyOptionsInterface.js';
export type * from './JsonTologyReferencesInterface.js';
export type * from './JsonTologyTypeConfigInterface.js';
export type * from './KahnStepOptionsInterface.js';
export type * from './LiftOptionsInterface.js';
export type * from './ListBuildResultInterface.js';
export type * from './LoaderInterface.js';
export type * from './LoggerInterface.js';
export type * from './LookupGraphFunctionInterface.js';
export type * from './LookupSchemaFunctionInterface.js';
export type * from './MaterializationErrorOptionsInterface.js';
export type * from './MaterializationResultInterface.js';
export type * from './MaterializerInterface.js';
export type * from './MaterializerOptionsInterface.js';
export type * from './MaterializerRunOptionsInterface.js';
export type * from './NormalizedToQuadsOptionsInterface.js';
export type * from './ObjectValidationOptionsInterface.js';
export type * from './OntologyBuilderInterface.js';
export type * from './OntologyBuilderOptionsInterface.js';
export type * from './OwlCodegenOptionsInterface.js';
export type * from './OwlImportContextInterface.js';
export type * from './OwlImporterOptionsInterface.js';
export type * from './OwlImportErrorOptionsInterface.js';
export type * from './OwlImportFragmentInterface.js';
export type * from './OwlImportResultInterface.js';
export type * from './OwlRegistryDirOptionsInterface.js';
export type * from './PassResultInterface.js';
export type * from './PredicateResolverInterface.js';
export type * from './PrefixMapInterface.js';
export type * from './ProjectAboxArgumentListInterface.js';
export type * from './ProjectAnnotatedEdgeArgumentListInterface.js';
export type * from './ProjectBaseArgumentListInterface.js';
export type * from './ProjectInstanceArgumentListInterface.js';
export type * from './ProjectInstancePropertyArgumentListInterface.js';
export type * from './ProjectionEmitContextInterface.js';
export type * from './ProjectPropertyArgumentListInterface.js';
export type * from './ProjectScalarValueArgumentListInterface.js';
export type * from './PropertyCollectionMapsInterface.js';
export type * from './PropertyDefaultsOptionsInterface.js';
export type * from './PropertyFragmentDeltaInterface.js';
export type * from './PropertyValidatorsOptionsInterface.js';
export type * from './QuadEmitBaseInterface.js';
export type * from './QuadFactoryEmitOptionsInterface.js';
export type * from './QuadFactoryIriOptionsInterface.js';
export type * from './QuadFactoryLiteralOptionsInterface.js';
export type * from './QuadInterface.js';
export type * from './QuadOptionsInterface.js';
export type * from './RecordCharacteristicOptionsInterface.js';
export type * from './ReferenceDecoderInterface.js';
export type * from './ReferenceDecoderRegistryInterface.js';
export type * from './ReferenceResolutionOptionsInterface.js';
export type * from './ReferenceTargetInterface.js';
export type * from './ReferenceValidatorOptionsInterface.js';
export type * from './RegistryOptionsInterface.js';
export type * from './ResolveRestrictionOptionsInterface.js';
export type * from './SameAsStoreInterface.js';
export type * from './SchemaCompilerInterface.js';
export type * from './SchemaEntryStoreInterface.js';
export type * from './SchemaErrorOptionsInterface.js';
export type * from './SchemaGraphInterface.js';
export type * from './SchemaIriInterface.js';
export type * from './SchemaLoadErrorOptionsInterface.js';
export type * from './SchemaRegistryInterface.js';
export type * from './SubjectIndexInterface.js';
export type * from './TransformErrorOptionsInterface.js';
export type * from './ValueInterface.js';
export type * from './VizPayloadInterface.js';
export type * from './VizSchemaDataInterface.js';
export type * from './VocabularyPluginInterface.js';

// Intentionally unexported — internal implementation details not part of the public callable surface:
// - BuildOptions      (internal graph serializer construction options)
// - ReferenceResolutionLoader (internal loader wiring; consumers use LoaderInterface from src/interfaces/)
// - SchemaReferenceWalker   (internal ref traversal; not a consumer-facing callable)
// - VizOptionsEntity  (internal visualization options; consumed only by the viz subpath)
// - XsdJsonSchemaPrimitiveEntity (internal XSD→JSON-Schema reverse-map shape; consumed by constants + import dispatch)
// - TransformStageInterface / AnyTransformStageInterface (internal transform-chain contract; not part of the public callable surface)
// - TripleTermIndexInterface (internal RDF 1.2 triple-term annotation index; consumed only by src/modules/rdf/Lift.ts)
// - PredicateIndexInterface (internal predicate-IRI-to-quads index; consumed only by src/modules/rdf/Lift.ts and its argument-list interfaces)
// - WalkInheritedReferenceOptionsInterface (internal walkInheritedRef options; not a consumer-facing callable)
// - RelationsContextInterface / RelationsPushContextInterface / CardinalityContextInterface / TypeRelationsContextInterface (internal SchemaGraphRelations push-context bundles)
// - ResolveBnodeOptionsInterface / ResolveItemOptionsInterface / ResolveListOptionsInterface (internal ClassExpressions dispatcher options)
// - ResolveDynamicReferenceTargetOptionsInterface (internal DynamicRefTarget.resolve options)
// - ResolveEdgeTargetIriArgumentsInterface (internal Projection.resolveEdgeTargetIri arguments)
// - ResolveScanReferenceOptionsInterface (internal SchemaCompilerPlan.resolveReference options)
// - PlanAllowedKeysOptionsInterface / PlanCompileWithSemanticsInterface / PlanPreludeInterface (internal SchemaCompilerPlan.buildNodePlan fragment-builder options and results)
// - PatternPropValidatorEntryInterface / PlanArrayValidatorsInterface (internal SchemaCompilerPlan compiled-validator fragments; re-exported from src/types/ for the public `./types` surface)
// - DependentSchemaValidatorEntryInterface (internal SchemaCompilerPlan dependent-schema trigger entry; re-exported from src/types/ for the public `./types` surface)
// - EmitPropertyShapeConstraintsArgumentListInterface (internal ShaclProjection emitPropertyShape*Constraints argument bag; not a consumer-facing callable)
// - PredicateAccessorInterface (internal AboxGraphInterface.predicate() return shape; not separately public, same as SchemaCursorInterface)
// - ResolvedReferenceTargetWithGraphInterface / ResolvedReferenceTargetNoGraphInterface (internal ReferenceDecoder cache variants; consumers use ResolvedReferenceTargetType from src/types/)
// - TypedRestrictionReferenceInterface (internal Compose.* restriction phantom-tag shape; the non-generic variant is RestrictionReferenceEntity in src/entities/)
// - DisjointWithBrandInterface / ComplementOfBrandInterface (internal OWL-axiom compile-time brands; consumed only by InferType)
// - LiftContextInterface / LiftAnnotatedEdgeArgumentListInterface / LiftImplArgumentListInterface / LiftMatchingQuadsArgumentListInterface / LiftPropertyValueArgumentListInterface / LiftSingleValueArgumentListInterface / LiftSubjectArgumentListInterface (internal Lift.* argument bags; consumed only by src/modules/rdf/Lift.ts)
// - JsonLdModuleInterface (internal optional-peerDependency module shape; consumed only by src/modules/ontology/OwlImporter.ts)
