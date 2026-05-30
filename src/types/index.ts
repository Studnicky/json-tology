/**
 * Types Module
 */

export type * from './AboxGraph.js';
export * from './BaseTypes.js';
export type * from './Brand.js';
export type * from './Compose.js';
export type * from './Computed.js';
export type * from './ConstraintBrands.js';
export type * from './Diff.js';
export type * from './EffectiveOptions.js';
export type * from './ErrorCodes.js';
export type * from './ErrorOptions.js';
export type * from './FacetDescriptorType.js';
export type * from './Format.js';
export type * from './GraphLookup.js';
export type * from './Infer.js';
export type * from './Invariant.js';
export type * from './JsonSchema.js';
export type * from './JsonSchemaTypeName.js';
export type * from './JtConfig.js';
export type * from './Loader.js';
export type * from './LookupSchema.js';
export type * from './NormalizedToQuadsOptions.js';
export type * from './PredicateFor.js';
export type * from './PredicateResolverFn.js';
export type * from './Quad.js';
export type * from './Registry.js';
export type * from './Schema.js';
export type * from './SchemaGraph.js';
export type * from './SchemaLookup.js';
export type * from './SchemaRef.js';
export type * from './SchemaValidation.js';
export type * from './Skolemize.js';
export type * from './SubjectGroup.js';
export type * from './ToQuadsOptions.js';
export type * from './Transform.js';
// Explicit named re-export so consumer module augmentation
// (`declare module 'json-tology/types' { interface JsonTologyTypeConfigInterface }`)
// merges into the canonical declaration. A bare `export type *` star re-export
// does not create an augmentable named binding, so brand-disable config from
// consumers would never reach IsEnabledType.
export type { JsonTologyTypeConfigInterface } from './TypeConfig.js';
export type * from './TypeConfig.js';
export type * from './TypeErrors.js';
export type * from './Validation.js';
export type * from './VisitFn.js';
