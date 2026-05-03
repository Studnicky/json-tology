# Theme contract

The theme is split into four files. Replace one to retarget; copy three to lift into another project.

| File | Per-project | Verbatim |
|------|------------|----------|
| `theme/palette.css` | yes — change accent / surface tokens | |
| `theme/base.css` | | yes — copy unchanged |
| `theme/index.ts` | | yes — copy unchanged |
| `theme.config.ts` | | yes — copy unchanged |
| `config.ts` | yes — title, sidebar, nav, GitHub URL | |

## Default palette

The default `palette.css` sources its tokens from the **W3C Design System** ([https://design-system.w3.org/settings/](https://design-system.w3.org/settings/)):

| Token | Light | Dark |
|-------|-------|------|
| Brand primary | `#005a9c` | `#3aa0ff` |
| Brand hover | `#002a56` | `#5bb3ff` |
| Body bg | `#ffffff` | `#0a0a0a` |
| Surface alt | `#fafafa` | `#111111` |
| Text primary | `#111111` | `#fafafa` |
| Border | `#e0e0e0` | `#2a2a2a` |

## Retargeting for another project

Replace `palette.css` with that project's accent. Examples:

- **yamete** (existing aesthetic): brand `#ff6b8a`, `#ffb3c4`, dark default
- **nocturne** (existing aesthetic): match its accent, dark default
- **Material**, **Carbon**, **Tailwind** color tokens — drop in those palettes verbatim

`base.css` reads every visual rule through `var(--vp-c-*)` references — it never hard-codes a color. Swapping `palette.css` recolors the entire site.

## Customizing layout

To add a custom layout component (e.g. a marketing block), create `theme/components/MyBlock.vue` and register it in `theme/index.ts`:

```ts
import { theme } from 'vitepress/theme';
import DefaultTheme from 'vitepress/theme';
import MyBlock from './components/MyBlock.vue';
import './palette.css';
import './base.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('MyBlock', MyBlock);
  }
};
```
