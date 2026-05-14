import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import './palette.css';
import './base.css';
import BenchmarkRunner from './components/BenchmarkRunner.vue';
import BookstoreGraph from './components/BookstoreGraph.vue';
import HexRing from './components/HexRing.vue';
import HomeFeaturesHero from './components/HomeFeaturesHero.vue';
import VersionBadge from './components/VersionBadge.vue';

export const theme: Theme = {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'sidebar-nav-before': () => h(HexRing),
      'nav-bar-title-after': () => h(VersionBadge)
    });
  },
  enhanceApp({ app }) {
    app.component('BenchmarkRunner', BenchmarkRunner);
    app.component('BookstoreGraph', BookstoreGraph);
    app.component('HomeFeaturesHero', HomeFeaturesHero);
  }
};
export default theme;
