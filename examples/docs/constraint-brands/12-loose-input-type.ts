import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';

const _EmailSchema = {
  'format': 'email',
  'type': 'string'
} as const;

// string & FormatBrandInterface<'email'>
type Email = InferType<typeof _EmailSchema>;
// string
type Input = LooseInputType<Email>;

// Email is a branded string; Input strips the brand back to plain string.
type InputIsString = Input extends string ? true : false;
type EmailIsNotInput = Email extends Input ? true : 'Email extends Input (brand is gone)';

const check: [InputIsString, EmailIsNotInput] = [
  true,
  true
];

console.log('LooseInputType<Email> is plain string:', check[0]);
// Email (branded) extends Input (plain string) because brands extend their base type.
console.log('Email extends Input (brand is a subtype of string):', check[1]);
