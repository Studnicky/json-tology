import type {
  EnumValuesType, ExhaustiveType
} from '../../../src/types/index.js';

const StatusSchema = {
  'enum': [
    'active',
    'inactive',
    'pending'
  ]
} as const;

type Status = EnumValuesType<typeof StatusSchema>;
// 'active' | 'inactive' | 'pending'
void 0 as unknown as Status;
