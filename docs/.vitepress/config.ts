import { defineConfig } from 'vitepress';
import { themeConfig } from './theme.config.js';

const sidebar = [
  {
    text: 'Introduction',
    items: [{ link: '/getting-started', text: 'Getting Started' }]
  },
  {
    text: 'Guides',
    items: [
      { link: '/validation', text: 'Validation' },
      { link: '/value', text: 'Value Operations' },
      { link: '/schemas', text: 'Schema Management' },
      { link: '/composition', text: 'Schema Composition' },
      { link: '/transforms', text: 'Transforms' },
      { link: '/materialization', text: 'Materialization' },
      { link: '/types', text: 'Type Inference' },
      { link: '/constraint-brands', text: 'Constraint Brands' },
      { link: '/cli', text: 'CLI' },
      { link: '/dump', text: 'Serialization (dump)' },
      { link: '/computed', text: 'Computed Fields' },
      { link: '/invariants', text: 'Cross-field Invariants' }
    ]
  },
  {
    text: 'Advanced',
    items: [{ link: '/ontology', text: 'Ontology and Graphs' }]
  },
  {
    text: 'Reference',
    items: [
      { link: '/architecture-plan', text: 'Architecture Plan' },
      { link: '/current-state', text: 'Current State' }
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
