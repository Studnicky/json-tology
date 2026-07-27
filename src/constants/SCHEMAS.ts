/** JSON Schema for the schema-expressible fields of `OwlCodegenOptionsInterface`. */
export const OWL_CODEGEN_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/**
 * JSON Schema for `RegistryFileEntryEntity.Type`, shared with
 * `GenerateRegistryDirectoryEntityFileEntity.Type` — both entities back the
 * same generated-entity-file shape for two different public function
 * contracts (`OwlCodegen.toRegistryFiles` vs. the browser-safe
 * `generateRegistryDirectory`).
 */
export const REGISTRY_FILE_ENTRY_SCHEMA = {
  'properties': {
    'iri': { 'type': 'string' },
    'name': { 'type': 'string' },
    'path': { 'type': 'string' },
    'source': { 'type': 'string' }
  },
  'required': [
    'iri',
    'name',
    'path',
    'source'
  ],
  'type': 'object'
} as const;

/**
 * Shared `indexSource` field for the registry-directory result entities
 * (`GenerateRegistryDirectoryResultEntity`, `RegistryFilesResultEntity`);
 * spread into each entity's own schema alongside its own `entityFiles` item type.
 */
export const REGISTRY_DIRECTORY_RESULT_SHARED_SCHEMA = {
  'properties': { 'indexSource': { 'type': 'string' } },
  'required': ['indexSource']
} as const;

/** JSON Schema for the schema-expressible fields of `OwlRegistryDirOptionsInterface`. */
export const OWL_REGISTRY_DIR_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `GenerateFromTboxOptionsInterface`. */
export const GENERATE_FROM_TBOX_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `GenerateRegistryDirectoryOptionsInterface`. */
export const GENERATE_REGISTRY_DIRECTORY_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for `WrittenEntityFileEntity.Type`. */
export const WRITTEN_ENTITY_FILE_SCHEMA = {
  'properties': {
    'iri': { 'type': 'string' },
    'name': { 'type': 'string' },
    'path': { 'type': 'string' }
  },
  'required': [
    'iri',
    'name',
    'path'
  ],
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `OwlImporterOptionsInterface`. */
export const OWL_IMPORTER_OPTIONS_SCHEMA = {
  'properties': {
    'baseIri': { 'type': 'string' },
    'prefixes': {
      'additionalProperties': { 'type': 'string' },
      'type': 'object'
    }
  },
  'required': ['baseIri'],
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `ProjectAboxArgumentListInterface`. */
export const PROJECT_ABOX_ARGUMENT_LIST_SCHEMA = {
  'properties': { 'baseIri': { 'type': 'string' } },
  'required': ['baseIri'],
  'type': 'object'
} as const;
