import type {
  CoercionErrorCodeType,
  GraphErrorCodeType,
  InstantiationErrorCodeType,
  MaterializationErrorCodeType,
  OwlImportErrorCodeType,
  SchemaErrorCodeType,
  TransformErrorCodeType
} from '../types/ErrorCodes.js';

export const CoercionErrorCode = { 'COERCION_FAILED': 'COERCION_FAILED' } as const satisfies Record<string, CoercionErrorCodeType>;

export const SchemaErrorCode = {
  'COMPUTED_FN_MISSING': 'COMPUTED_FN_MISSING',
  'COMPUTED_INPUT_FORBIDDEN': 'COMPUTED_INPUT_FORBIDDEN',
  'DIALECT_UNSUPPORTED': 'SCHEMA_DIALECT_UNSUPPORTED',
  'DUPLICATE_ANCHOR': 'SCHEMA_DUPLICATE_ANCHOR',
  'INVALID_INPUT': 'SCHEMA_INVALID_INPUT',
  'MISSING_ID': 'SCHEMA_MISSING_ID',
  'NOT_REGISTERED': 'SCHEMA_NOT_REGISTERED',
  'PROPERTY_CHARACTERISTIC_CONFLICT': 'PROPERTY_CHARACTERISTIC_CONFLICT',
  'STRUCTURE_INVALID': 'SCHEMA_STRUCTURE_INVALID',
  'VALIDATOR_MISSING': 'SCHEMA_VALIDATOR_MISSING'
} as const satisfies Record<string, SchemaErrorCodeType>;

export const GraphErrorCode = {
  'ANCHOR_NOT_FOUND': 'ANCHOR_NOT_FOUND',
  'ARTIFACT_INVALID': 'ARTIFACT_INVALID',
  'ARTIFACT_STALE': 'ARTIFACT_STALE',
  'CURSOR_CARDINALITY': 'CURSOR_CARDINALITY',
  'DIALECT_UNSUPPORTED': 'DIALECT_UNSUPPORTED',
  'POINTER_INVALID': 'POINTER_INVALID',
  'POINTER_NOT_FOUND': 'POINTER_NOT_FOUND',
  'POINTER_NOT_SCHEMA': 'POINTER_NOT_SCHEMA',
  'RECURSION_LIMIT': 'RECURSION_LIMIT',
  'REF_UNRESOLVED': 'REF_UNRESOLVED',
  'VOCABULARY_UNSUPPORTED': 'VOCABULARY_UNSUPPORTED'
} as const satisfies Record<string, GraphErrorCodeType>;

export const InstantiationErrorCode = {
  'EXTRA_FORBIDDEN': 'EXTRA_FORBIDDEN',
  'INSTANTIATION_FAILED': 'INSTANTIATION_FAILED'
} as const satisfies Record<string, InstantiationErrorCodeType>;

export const MaterializationErrorCode = {
  'CYCLIC_DATA': 'CYCLIC_DATA',
  'MATERIALIZATION_FAILED': 'MATERIALIZATION_FAILED'
} as const satisfies Record<string, MaterializationErrorCodeType>;

export const OwlImportErrorCode = { 'NOT_IMPLEMENTED': 'OWL_IMPORT_NOT_IMPLEMENTED' } as const satisfies Record<string, OwlImportErrorCodeType>;

export const TransformErrorCode = {
  'TRANSFORM_DECODE_FAILED': 'TRANSFORM_DECODE_FAILED',
  'TRANSFORM_ENCODE_FAILED': 'TRANSFORM_ENCODE_FAILED'
} as const satisfies Record<string, TransformErrorCodeType>;
