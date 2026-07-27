import type { InferType } from '../types/Schema.js';
import type { OwlCodegenSourceOptionsInterface } from './OwlCodegenSourceOptionsInterface.js';
import type { GENERATE_REGISTRY_DIRECTORY_OPTIONS_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Options accepted by {@link generateRegistryDirectory} (browser-safe).
 *
 * Does not include an `outDir` path — file writing is handled by
 * `writeRegistryDirectory` in `json-tology/owl-gen-node`.
 */
export interface GenerateRegistryDirectoryOptionsInterface
  extends InferType<typeof GENERATE_REGISTRY_DIRECTORY_OPTIONS_SCHEMA>, OwlCodegenSourceOptionsInterface {}
