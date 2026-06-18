/**
 * Compose.disjointWith — Example: EBook and PrintBook share no instances
 * Demonstrates: disjointWith axiom emits owl:disjointWith in the OWL TBox.
 *
 * DigitalEditionSchema and PhysicalEditionSchema are subclasses of Book that
 * are declared disjoint — no individual book copy can be both a digital
 * download and a physical artefact simultaneously.
 *
 * The TBox JSON-LD carries:
 *   urn:bookstore:PhysicalEdition  owl:disjointWith  urn:bookstore:DigitalEdition
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import { OWL } from '../../../src/constants/IRI.js';
import { BookSchema } from '../bookstore/index.js';

// DigitalEdition — a Book subclass for downloadable formats.
const DigitalEditionBase = Compose.subClassOf(BookSchema, {
  '$id': 'urn:bookstore:DigitalEdition',
  'properties': {
    'fileFormat': {
      'enum': [
        'epub',
        'pdf'
      ],
      'type': 'string'
    }
  },
  'required': ['fileFormat'],
  'type': 'object'
} as const);

// PhysicalEdition — a Book subclass for printed formats, declared disjoint with DigitalEdition.
const PhysicalEditionBase = Compose.subClassOf(BookSchema, {
  '$id': 'urn:bookstore:PhysicalEdition',
  'properties': {
    'binding': {
      'enum': [
        'hardcover',
        'paperback'
      ],
      'type': 'string'
    }
  },
  'required': ['binding'],
  'type': 'object'
} as const);

const PhysicalEditionSchema = Compose.disjointWith(DigitalEditionBase, PhysicalEditionBase);

// Register all three schemas — Book first, then the subclasses.
const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'schemas': [
    BookSchema,
    DigitalEditionBase,
    PhysicalEditionSchema
  ] as const
});

// TBox carries owl:disjointWith on PhysicalEdition pointing at DigitalEdition.
const tbox = JSON.parse(jt.toTbox().jsonLd()) as {
  '@graph'?: ReadonlyArray<Record<string, unknown>>;
};
const graph = tbox['@graph'] ?? [];
const physicalNode = graph.find((node) => {
  return node['@id'] === PhysicalEditionSchema.$id;
});

console.assert(physicalNode !== undefined, 'PhysicalEdition appears in TBox');

const disjointWith = physicalNode?.[OWL.disjointWith] as undefined | { '@id': string };

console.assert(
  disjointWith !== undefined,
  'PhysicalEdition carries owl:disjointWith'
);
console.assert(
  disjointWith?.['@id'] === DigitalEditionBase.$id,
  'owl:disjointWith points to DigitalEdition'
);

console.log(
  'PhysicalEdition owl:disjointWith DigitalEdition:',
  disjointWith?.['@id'] === DigitalEditionBase.$id
);
