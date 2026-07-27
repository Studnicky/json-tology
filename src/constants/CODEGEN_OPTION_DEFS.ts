/** Shared by BuildEntityFileOptionsEntity and EmitBannerOptionsEntity — both OWL codegen helpers carry generation provenance. */
export const CODEGEN_PROVENANCE_OPTIONS_DEF = {
  'properties': {
    'sourceLabel': { 'type': 'string' },
    'ts': { 'type': 'string' }
  },
  'required': [
    'sourceLabel',
    'ts'
  ]
} as const;

/** Shared by BuildIndexSourceOptionsEntity and EmitRegistryOptionsEntity — both emit against the same generated registry construction context. */
export const CODEGEN_REGISTRY_OPTIONS_DEF = {
  'properties': {
    'effectiveBaseIri': { 'type': 'string' },
    'registryConstName': { 'type': 'string' },
    'schemasConst': { 'type': 'string' }
  },
  'required': [
    'effectiveBaseIri',
    'registryConstName',
    'schemasConst'
  ]
} as const;
