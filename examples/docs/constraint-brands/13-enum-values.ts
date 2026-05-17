import type { EnumValuesType } from '../../../src/types/index.js';

const _StatusSchema = {
  'enum': [
    'active',
    'inactive',
    'pending'
  ]
} as const;

// 'active' | 'inactive' | 'pending'
type Status = EnumValuesType<typeof _StatusSchema>;
void 0 as unknown as Status;
