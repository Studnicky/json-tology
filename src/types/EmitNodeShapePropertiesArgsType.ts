import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgsType.js';

/** Arguments for emitNodeShapeProperties. */
export type EmitNodeShapePropertiesArgsType = ShaclEmitBaseArgsType & {
  'propertyIndex': Map<string, string[]>;
};
