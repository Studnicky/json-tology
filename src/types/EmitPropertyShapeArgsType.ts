import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgsType.js';

/** Arguments for emitPropertyShape. */
export type EmitPropertyShapeArgsType = ShaclEmitBaseArgsType & {
  'bnodeId': string;
  'classId': string;
  'overridePathClassId': string | undefined;
};
