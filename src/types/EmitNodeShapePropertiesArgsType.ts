import type { ShaclEmitBaseArgumentsType } from './ShaclEmitBaseArgumentsType.js';

/** Arguments for emitNodeShapeProperties. */
export type EmitNodeShapePropertiesArgumentListType = ShaclEmitBaseArgumentsType & {
  'propertyIndex': Map<string, string[]>;
};
