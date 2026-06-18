import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgsType.js';

/** Arguments for emitNodeShapeProperties. */
export type EmitNodeShapePropertiesArgsType = ShaclEmitBaseArgsType & {
  readonly 'propertyIndex': Map<string, string[]>;
};
