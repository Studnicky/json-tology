import type { ShaclEmitBaseArgsType } from './ShaclEmitBaseArgsType.js';

/** Arguments for emitPropertyShape. */
export type EmitPropertyShapeArgsType = ShaclEmitBaseArgsType & {
  readonly 'bnodeId': string;
  readonly 'classId': string;
  readonly 'overridePathClassId': string | undefined;
};
