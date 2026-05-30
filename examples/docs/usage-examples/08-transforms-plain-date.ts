/**
 * Transforms recipes — calendar date primitive (PlainDate analogue)
 *
 * Wire format: `'YYYY-MM-DD'`. Decoded type: a small calendar-date
 * value object with no time component and no time zone — the same
 * idiom Temporal.PlainDate uses, recreated here in plain TypeScript
 * because the Temporal global is not yet a stable Node.js builtin.
 *
 * Registered on a sibling of the canonical `PublicationDateSchema`
 * (which itself decodes to a `Date` in `04-transforms-date-only.ts`).
 * Bastian's rare 1979 first edition publication date is the wire
 * value.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  PublicationDateSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

class PlainDate {
  public static from(wire: string): PlainDate {
    const [
      year,
      month,
      day
    ] = wire.split('-').map((part) => {
      return Number.parseInt(part, 10);
    }) as [number | undefined, number | undefined, number | undefined];

    if (year === undefined || month === undefined || day === undefined) {
      throw new TypeError(`PlainDate.from: invalid wire '${wire}'`);
    }

    return new PlainDate(year, month, day);
  }

  public constructor(
    public readonly year: number,
    public readonly month: number,
    public readonly day: number
  ) {}

  public toString(): string {
    const month = String(this.month).padStart(2, '0');
    const day = String(this.day).padStart(2, '0');

    return `${String(this.year)}-${month}-${day}`;
  }
}

const ReleaseDateSchema = Compose.equivalent(
  PublicationDateSchema,
  { '$id': 'https://bookstore.example/ReleaseDate' } as const
);

jt.set(ReleaseDateSchema);

const ReleaseDateTransform = Transform.create<typeof ReleaseDateSchema, PlainDate>(ReleaseDateSchema, {
  'decode': (wire) => {
    return PlainDate.from(wire as string);
  },
  'encode': (date) => {
    return date.toString();
  }
});

const wire = aboxFixtures.rareBook.publishedOn;
const decoded = jt.instantiate(ReleaseDateTransform, wire);

if (!(decoded instanceof PlainDate)) {
  throw new TypeError('ReleaseDate transform did not return a PlainDate');
}

console.assert(decoded.year === 1979);
console.assert(decoded.month === 9);
console.assert(decoded.day === 1);
// '1979-09-01'
console.log('wire:', wire);
// 1979 9 1 — no time zone
console.log('PlainDate:', decoded.year, decoded.month, decoded.day);

const reEncoded = jt.encode(ReleaseDateTransform, decoded);

console.assert(reEncoded === wire);
// '1979-09-01' — toString() on encode
console.log('re-encoded:', reEncoded);
