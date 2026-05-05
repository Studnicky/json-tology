import { defineConfig } from 'vitepress';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as { version: string };
import { themeConfig } from './theme.config.js';

const sidebar = [
  {
    text: 'Introduction',
    items: [
      { link: '/getting-started', text: 'Getting Started' },
      { link: '/bookstore-domain', text: 'The Bookstore Domain' }
    ]
  },
  {
    text: 'Concepts',
    items: [
      { link: '/your-types-are-a-graph', text: 'Your Types Are a Graph' },
      { link: '/advanced/graph-concepts', text: 'Graph concepts (TBox / ABox)' },
      { link: '/advanced/graph-native-authoring', text: 'Graph-native authoring' },
      { link: '/advanced/sub-schemas', text: 'Sub-schemas and $ref composition' },
      { link: '/picking-a-method', text: 'Picking a method' },
      { link: '/argument-conventions', text: 'Argument conventions' }
    ]
  },
  {
    text: 'Schemas',
    items: [
      { link: '/schemas', text: 'Authoring schemas' },
      { link: '/schemas/jt-keywords', text: 'JT keywords' },
      {
        text: 'Type Inference',
        items: [
          { link: '/types#infertype', text: 'InferType' },
          { link: '/types#inferschematype', text: 'InferSchemaType' },
          { link: '/types#deprecatedkeystype-t', text: 'DeprecatedKeysType' },
          { link: '/types#nondeprecatedschematype-t', text: 'NonDeprecatedSchemaType' },
          { link: '/types#looseinputtype-t', text: 'LooseInputType' },
          { link: '/types#enumvaluestype-t', text: 'EnumValuesType' },
          { link: '/types#exhaustivetype-t', text: 'ExhaustiveType' },
          { link: '/types#defaultalignedtype-t', text: 'DefaultAlignedType' },
          { link: '/types#integerrangetype-min-max', text: 'IntegerRangeType' },
          { link: '/types#multipleofrangetype-min-max-step', text: 'MultipleOfRangeType' }
        ]
      }
    ]
  },
  {
    text: 'Validation',
    items: [
      { link: '/validation/instantiate', text: 'instantiate' },
      { link: '/validation/validate', text: 'validate' },
      { link: '/validation/is', text: 'is' },
      { link: '/validation/errors', text: 'errors' },
      { link: '/validation/subschemaAt', text: 'subschemaAt' }
    ]
  },
  {
    text: 'ValidationErrors',
    items: [
      { link: '/errors', text: 'Overview / usage examples' },
      { link: '/errors/views#validationerrors-aggregate', text: 'aggregate' },
      { link: '/errors/views#validationerrors-report', text: 'report' }
    ]
  },
  {
    text: 'Composition',
    items: [
      { link: '/composition/extend', text: 'extend' },
      { link: '/composition/pick-omit', text: 'pick / omit' },
      { link: '/composition/partial-required', text: 'partial / required' },
      { link: '/composition/intersection', text: 'intersection' },
      { link: '/composition/discriminated-union', text: 'discriminatedUnion / narrow' },
      { link: '/composition/get-defaults', text: 'getDefaults' },
      { link: '/advanced/graph-native-authoring#compose-equivalent', text: 'equivalent' }
    ]
  },
  {
    text: 'Transforms',
    items: [
      { link: '/transforms/decode-encode', text: 'Transform.create / encode' },
      { link: '/transforms/brand', text: 'brand' },
      { link: '/transforms/pipe', text: 'pipe' }
    ]
  },
  {
    text: 'Value Operations',
    items: [
      { link: '/value/clone-hash', text: 'clone / hash' },
      { link: '/value/diff', text: 'diff / applyOp' },
      { link: '/value/cast-clean-convert', text: 'cast / clean / convert' },
      { link: '/value/create', text: 'create' }
    ]
  },
  {
    text: 'Serialization',
    items: [
      { link: '/serialization/dump', text: 'dump / dumpJson' },
      { link: '/serialization/toSchema', text: 'toSchema' }
    ]
  },
  {
    text: 'Registry',
    items: [
      { link: '/registry/register', text: 'register / has / get / list' },
      { link: '/registry/materialize', text: 'materialize' },
      { link: '/registry/computed', text: 'addComputed / removeComputed' },
      { link: '/registry/invariants', text: 'addInvariant / removeInvariant' },
      { link: '/advanced/graph-native-authoring#schemaregistry-findduplicates', text: 'findDuplicates' }
    ]
  },
  {
    text: 'Ontology emission (opt-in)',
    items: [
      { link: '/advanced/ontology#entities-totbox', text: 'toTbox' },
      { link: '/advanced/ontology#entities-toshacl', text: 'toShacl' },
      { link: '/advanced/ontology#entities-ontology', text: 'ontology' },
      { link: '/advanced/quads', text: 'RDF round-trip (toQuads / fromQuads)' }
    ]
  },
  {
    text: 'Usage Examples',
    items: [
      { link: '/usage-examples/custom-formats', text: 'Custom format validators' },
      { link: '/usage-examples/transforms-recipes', text: 'Transform recipes' }
    ]
  },
  {
    text: 'Reference',
    items: [
      { link: '/static-helpers', text: 'Static helpers' },
      { link: '/advanced/utilities', text: 'Public utility classes' },
      { link: '/errors/classes', text: 'Error classes' },
      { link: '/constraint-brands', text: 'Constraint brands' },
      { link: '/cli', text: 'CLI' },
      { link: '/references', text: 'External references' }
    ]
  }
];

export default defineConfig({
  vite: {
    define: {
      __JT_VERSION__: JSON.stringify(pkg.version)
    }
  },
  base: '/json-tology/',
  appearance: themeConfig.appearance,
  description: 'One source of truth for TypeScript types, runtime validation, coercion, and OWL ontology output. Author in JSON Schema; share with any backend; reason over the graph.',
  srcDir: '.',
  themeConfig: {
    ...themeConfig,
    nav: [
      { link: '/getting-started', text: 'Docs' },
      { link: 'https://github.com/Studnicky/json-tology', text: 'GitHub' }
    ],
    sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/Studnicky/json-tology' }]
  },
  title: 'json-tology'
});
