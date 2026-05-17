import type { InferType } from '../../../src/types/index.js';

const _PercentSchema = {
  'maximum': 100,
  'minimum': 0,
  'type': 'number'
} as const;

const _TemperatureSchema = {
  'minimum': -273,
  'type': 'number'
} as const;

type Percent = InferType<typeof _PercentSchema>;
type Temperature = InferType<typeof _TemperatureSchema>;

// Percent:     number & MinimumBrandInterface<0> & MaximumBrandInterface<100>
// Temperature: number & MinimumBrandInterface<-273>

// These are incompatible - different MinimumBrand values
const _temp: Temperature = (0 as unknown) as Percent;

void 0 as unknown as typeof _temp;
