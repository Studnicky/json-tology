import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './palette.css';
import './base.css';
import BookstoreGraph from './components/BookstoreGraph.vue';

export const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BookstoreGraph', BookstoreGraph);
  }
};
export default theme;
