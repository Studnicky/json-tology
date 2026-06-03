import type { EnumValuesType } from '../../../src/types/index.js';

const _StatusSchema = {
  'enum': [
    'active',
    'inactive',
    'pending'
  ]
} as const;

// EnumValuesType extracts the literal union from the enum:
// 'active' | 'inactive' | 'pending'
type Status = EnumValuesType<typeof _StatusSchema>;

// A value typed as Status accepts exactly the enum members — no cast needed,
// confirming the resolved union.
const status: Status = 'active';

console.log('EnumValuesType<StatusSchema> sample member:', status);
