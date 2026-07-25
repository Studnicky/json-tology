import type { ShaclEmitBaseArgumentsType } from './ShaclEmitBaseArgumentsType.js';

/** Arguments for emitPropertyShape. */
export type EmitPropertyShapeArgumentListType = ShaclEmitBaseArgumentsType & {
  'bnodeId': string;
  'classId': string;
  'overridePathClassId': string | undefined;
};
