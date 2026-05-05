// Markdown-it plugin: wrap literal 'json-tology' (case-sensitive, word-bounded)
// in <span class="jt-brand">json-tology</span>, but only inside text tokens of
// inline content. Skips code spans and code blocks because those are separate
// token types (code_inline, code_block, fence) - we touch only `text` tokens
// inside `inline` containers.

const PATTERN = /\bjson-tology\b/g;

export function jtBrandPlugin(md) {
  md.core.ruler.after('inline', 'jt-brand', (state) => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) {
        continue;
      }

      const out = [];

      for (const token of block.children) {
        if (token.type !== 'text' || !PATTERN.test(token.content)) {
          out.push(token);
          continue;
        }

        const parts = token.content.split(PATTERN);
        const matches = token.content.match(PATTERN) || [];

        for (let i = 0; i < parts.length; i++) {
          if (parts[i]) {
            const textToken = new state.Token('text', '', 0);

            textToken.content = parts[i];
            out.push(textToken);
          }

          if (i < matches.length) {
            const htmlToken = new state.Token('html_inline', '', 0);

            htmlToken.content = '<span class="jt-brand">json-tology</span>';
            out.push(htmlToken);
          }
        }
      }

      block.children = out;
    }
  });
}
