import type { InferType } from '../types/Schema.js';
import type { OwlCodegenSourceOptionsInterface } from './OwlCodegenSourceOptionsInterface.js';
import type { GENERATE_FROM_TBOX_OPTIONS_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Options accepted by {@link generateFromTbox} (browser-safe).
 *
 * Does not include an `output` path — file writing is handled by
 * `writeFromTbox` in `json-tology/owl-gen-node`.
 */
export interface GenerateFromTboxOptionsInterface
  extends InferType<typeof GENERATE_FROM_TBOX_OPTIONS_SCHEMA>, OwlCodegenSourceOptionsInterface {}
