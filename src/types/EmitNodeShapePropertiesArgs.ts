import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgs.js';

/** Arguments for emitNodeShapeProperties. */
export type EmitNodeShapePropertiesArgsType = ShaclEmitBaseArgsType & {
  readonly 'propertyIndex': Map<string, string[]>;
};
