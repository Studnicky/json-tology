import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const PercentSchema = {
  '$id': 'urn:brands:Percent',
  'maximum': 100,
  'minimum': 0,
  'type': 'number'
} as const;

const TemperatureSchema = {
  '$id': 'urn:brands:Temperature',
  'minimum': -273,
  'type': 'number'
} as const;

type Percent = InferType<typeof PercentSchema>;
type Temperature = InferType<typeof TemperatureSchema>;

// Percent:     number & MinimumBrandType<0> & MaximumBrandType<100>
// Temperature: number & MinimumBrandType<-273>

// Each branded value is constructed only from its own schema's brand —
// the two are incompatible (different MinimumBrand values, and Percent
// additionally carries MaximumBrand<100>), so neither is assignable to the
// other.
const jt = JsonTology.create({
  'baseIRI': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [
    PercentSchema,
    TemperatureSchema
  ]
});

const _percent: Percent = jt.instantiate(PercentSchema.$id, 0);
const _temp: Temperature = jt.instantiate(TemperatureSchema.$id, 0);

// Demonstrate incompatibility at the type level: Percent does not extend
// Temperature and vice versa.
type PercentIsNotTemperature = Percent extends Temperature ? false : true;
type TemperatureIsNotPercent = Temperature extends Percent ? false : true;
const _check: [PercentIsNotTemperature, TemperatureIsNotPercent] = [
  true,
  true
];

// Both are numbers at runtime but carry incompatible brands at compile time.
console.log('Percent value:', _percent, '(brand: minimum 0, maximum 100)');
console.log('Temperature value:', _temp, '(brand: minimum -273)');
// Percent does not extend Temperature — the brands are structurally distinct.
console.log('Brand incompatibility check [true, true]:', _check);
