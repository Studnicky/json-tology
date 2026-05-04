import { defineConfig } from 'vitepress';
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
    text: 'Core',
    items: [
      { link: '/schemas', text: 'Schemas' },
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
      },
      {
        text: 'Validation',
        items: [
          { link: '/validation/coerce', text: 'coerce' },
          { link: '/validation/validate', text: 'validate' },
          { link: '/validation/is', text: 'is' },
          { link: '/validation/errors', text: 'errors' },
          { link: '/validation/validateAt', text: 'validateAt' }
        ]
      },
      {
        text: 'Error Views',
        items: [
          { link: '/errors/views#validationerrors-messages', text: 'messages' },
          { link: '/errors/views#validationerrors-format', text: 'format' },
          { link: '/errors/views#validationerrors-flatten', text: 'flatten' },
          { link: '/errors/views#validationerrors-aggregate', text: 'aggregate' },
          { link: '/errors/views#validationerrors-report', text: 'report' }
        ]
      }
    ]
  },
  {
    text: 'Composing Schemas',
    items: [
      { link: '/composition/extend', text: 'extend' },
      { link: '/composition/pick-omit', text: 'pick / omit' },
      { link: '/composition/partial-required', text: 'partial / required' },
      { link: '/composition/intersection', text: 'intersection' },
      { link: '/composition/discriminated-union', text: 'discriminatedUnion / narrow' },
      { link: '/composition/get-defaults', text: 'getDefaults' }
    ]
  },
  {
    text: 'Working with Values',
    items: [
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
        text: 'Transforms',
        items: [
          { link: '/transforms/decode-encode', text: 'Transform.create / encode' },
          { link: '/transforms/brand', text: 'brand' },
          { link: '/transforms/pipe', text: 'pipe' }
        ]
      },
      {
        text: 'Serialization',
        items: [
          { link: '/serialization/dump', text: 'dump / dumpJson' },
          { link: '/serialization/toSchema', text: 'toSchema' }
        ]
      }
    ]
  },
  {
    text: 'Registry',
    items: [
      { link: '/registry/register', text: 'register / has / get / list' },
      { link: '/registry/materialize', text: 'materialize' },
      { link: '/registry/computed', text: 'addComputed / removeComputed' },
      { link: '/registry/invariants', text: 'addInvariant / removeInvariant' }
    ]
  },
  {
    text: 'Advanced (opt-in)',
    items: [
      { link: '/advanced/ontology#jt-totbox', text: 'toTbox' },
      { link: '/advanced/ontology#jt-toshacl', text: 'toShacl' },
      { link: '/advanced/ontology#jt-ontology', text: 'ontology' }
      { link: '/advanced/ontology#jt-ontology', text: 'ontology' },
      { link: '/advanced/graph-native-authoring', text: 'Graph-native authoring' },
      { link: '/advanced/graph-native-authoring#compose-equivalent', text: 'Compose.equivalent' },
      { link: '/advanced/graph-native-authoring#schemaregistry-findduplicates', text: 'findDuplicates' }
    ]
  },
  {
    text: 'Reference',
    items: [
      { link: '/architecture-plan', text: 'Architecture Plan' },
      { link: '/current-state', text: 'Current State' },
      { link: '/cli', text: 'CLI' },
      { link: '/constraint-brands', text: 'Constraint Brands' }
    ]
  }
];

export default defineConfig({
  appearance: themeConfig.appearance,
  description: 'TypeScript type system with declarative JSON Schema authoring.',
  srcDir: '.',
  themeConfig: {
    ...themeConfig,
    nav: [
      { link: '/getting-started', text: 'Docs' },
      { link: '/architecture-plan', text: 'Reference' },
      { link: 'https://github.com/Studnicky/json-tology', text: 'GitHub' }
    ],
    sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/Studnicky/json-tology' }]
  },
  title: 'json-tology'
});
