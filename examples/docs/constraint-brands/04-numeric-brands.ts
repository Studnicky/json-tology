import type { InferType } from '../../../src/types/index.js';

const PercentSchema = {
  'maximum': 100,
  'minimum': 0,
  'type': 'number'
} as const;

const TemperatureSchema = {
  'minimum': -273,
  'type': 'number'
} as const;

type Percent = InferType<typeof PercentSchema>;
type Temperature = InferType<typeof TemperatureSchema>;

// Percent:     number & MinimumBrandInterface<0> & MaximumBrandInterface<100>
// Temperature: number & MinimumBrandInterface<-273>

// These are incompatible  - different MinimumBrand values
const temp: Temperature = {} as Percent; // compile error

void 0 as unknown as typeof temp;
