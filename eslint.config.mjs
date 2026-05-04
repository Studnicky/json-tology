import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { basename, extname } from 'node:path';
import perfectionist from 'eslint-plugin-perfectionist';
import regexpPlugin from 'eslint-plugin-regexp';
import unicornPlugin from 'eslint-plugin-unicorn';
import ymlPlugin from 'eslint-plugin-yml';
import globals from 'globals';

// Custom rule: filename must match a named export
// Replaces deprecated eslint-plugin-filename-export (uses removed context.getFilename)
const filenameMatchesExportRule = {
  meta: {
    docs: { description: 'Enforce filename matches named export' },
    messages: { noMatchingExport: 'Filename does not match any named exports' },
    schema: [{ properties: { casing: { enum: ['strict', 'loose'], type: 'string' }, stripextra: { type: 'boolean' } }, type: 'object' }],
    type: 'suggestion'
  },
  create(context) {
    const options = context.options[0] ?? {};
    const isStrict = options.casing === 'strict';
    const stripExtra = options.stripextra === true;
    return {
      Program(node) {
        const filename = context.filename;
        const filenameSansExt = basename(filename, extname(filename));
        if (['index', 'types'].includes(filenameSansExt) || /\.(test|spec|stories)$/.test(filenameSansExt)) { return; }
        if (/[/\\](types|interfaces|errors|constants)[/\\]/.test(filename)) { return; }
        if (node.body.some((item) => { return item.type === 'ExportDefaultDeclaration'; })) { return; }
        const namedExports = node.body.filter((item) => { return item.type === 'ExportNamedDeclaration'; });
        if (namedExports.length === 0) { return; }
        const exportNames = namedExports.flatMap((exp) => {
          if (exp.declaration) {
            if ('declarations' in exp.declaration && exp.declaration.declarations) {
              return exp.declaration.declarations.map((decl) => { return decl.id?.name ?? ''; });
            }
            return [exp.declaration.id?.name ?? ''];
          }
          if (exp.specifiers) { return exp.specifiers.map((spec) => { return 'name' in spec.exported ? spec.exported.name : spec.exported.value; }); }
          return [];
        });
        const normalize = (name) => {
          let result = name;
          if (stripExtra) { result = result.replace(/[^a-zA-Z0-9]/g, ''); }
          if (!isStrict) { result = result.toLowerCase(); }
          return result;
        };
        if (!exportNames.some((name) => { return normalize(name) === normalize(filenameSansExt); })) {
          context.report({ messageId: 'noMatchingExport', node });
        }
      }
    };
  }
};

const filenameExportPlugin = { rules: { 'match-named-export': filenameMatchesExportRule } };

// ---------------------------------------------------------------------------
// Rule sets
// ---------------------------------------------------------------------------

const stylisticPluginRules = {
  '@stylistic/array-bracket-newline': ['error', { minItems: 2 }],
  '@stylistic/array-bracket-spacing': ['error', 'never'],
  '@stylistic/array-element-newline': ['error', { minItems: 2 }],
  '@stylistic/arrow-parens': ['error', 'always'],
  '@stylistic/arrow-spacing': 'error',
  '@stylistic/block-spacing': 'error',
  '@stylistic/brace-style': ['error', '1tbs'],
  '@stylistic/comma-dangle': ['error', 'never'],
  '@stylistic/comma-spacing': ['error', { after: true, before: false }],
  '@stylistic/comma-style': ['error', 'last'],
  '@stylistic/computed-property-spacing': ['error', 'never'],
  '@stylistic/eol-last': ['error', 'always'],
  '@stylistic/function-call-argument-newline': ['error', 'consistent'],
  '@stylistic/function-call-spacing': ['error', 'never'],
  '@stylistic/function-paren-newline': ['error', 'multiline'],
  '@stylistic/implicit-arrow-linebreak': ['error', 'beside'],
  '@stylistic/indent': ['error', 2],
  '@stylistic/key-spacing': ['error', { afterColon: true, beforeColon: false }],
  '@stylistic/keyword-spacing': ['error', { after: true, before: true }],
  '@stylistic/line-comment-position': ['error', { position: 'above' }],
  '@stylistic/linebreak-style': ['error', 'unix'],
  '@stylistic/max-len': ['error', { code: 120, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true }],
  '@stylistic/multiline-ternary': ['error', 'always-multiline'],
  '@stylistic/newline-per-chained-call': ['error', { ignoreChainWithDepth: 2 }],
  '@stylistic/no-extra-parens': ['error', 'functions'],
  '@stylistic/no-mixed-spaces-and-tabs': 'error',
  '@stylistic/no-multi-spaces': 'error',
  '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxBOF: 0, maxEOF: 1 }],
  '@stylistic/no-trailing-spaces': 'error',
  '@stylistic/no-whitespace-before-property': 'error',
  '@stylistic/object-curly-newline': ['error', {
    ExportDeclaration: { consistent: true, minProperties: 2, multiline: true },
    ImportDeclaration: { consistent: true, minProperties: 2, multiline: true },
    ObjectExpression: { minProperties: 2, multiline: true },
    ObjectPattern: { minProperties: 2, multiline: true }
  }],
  '@stylistic/object-curly-spacing': ['error', 'always'],
  '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
  '@stylistic/one-var-declaration-per-line': ['error', 'always'],
  '@stylistic/operator-linebreak': ['error', 'before'],
  '@stylistic/padded-blocks': ['error', 'never'],
  '@stylistic/quote-props': ['error', 'always'],
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
  '@stylistic/rest-spread-spacing': ['error', 'never'],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/semi-spacing': ['error', { after: true, before: false }],
  '@stylistic/space-before-blocks': ['error', 'always'],
  '@stylistic/space-before-function-paren': ['error', { anonymous: 'never', asyncArrow: 'always', named: 'never' }],
  '@stylistic/space-in-parens': ['error', 'never'],
  '@stylistic/space-infix-ops': 'error',
  '@stylistic/space-unary-ops': ['error', { nonwords: false, words: true }],
  '@stylistic/spaced-comment': ['error', 'always'],
  '@stylistic/template-curly-spacing': ['error', 'never'],
  '@stylistic/template-tag-spacing': ['error', 'never'],
  '@stylistic/type-annotation-spacing': ['error', { overrides: { colon: { after: true, before: false } } }],
  'arrow-body-style': ['error', 'always']
};

const syntaxRestrictions = [
  { message: 'Default exports are forbidden. Use named exports only.', selector: 'ExportDefaultDeclaration' },
  { message: 'Assignment of "this" to "self" is forbidden. Use arrow functions.', selector: 'VariableDeclarator[id.name="self"][init.type="ThisExpression"]' },
  { message: 'Assignment of "this" to "that" is forbidden. Use arrow functions.', selector: 'VariableDeclarator[id.name="that"][init.type="ThisExpression"]' },
  { message: 'Assignment of "this" to "_this" is forbidden. Use arrow functions.', selector: 'VariableDeclarator[id.name="_this"][init.type="ThisExpression"]' },
  { message: 'Assignment of "this" to variables is forbidden. Use arrow functions.', selector: 'VariableDeclarator[init.type="ThisExpression"]' },
  { message: 'Function.prototype.bind() is forbidden. Use arrow functions.', selector: 'CallExpression[callee.property.name="bind"]' },
  { message: 'Function.prototype.call() is forbidden. Use direct function calls.', selector: 'CallExpression[callee.property.name="call"]' },
  { message: 'Function.prototype.apply() is forbidden. Use spread operator.', selector: 'CallExpression[callee.property.name="apply"]' },
  { message: 'Class names must be PascalCase.', selector: 'ClassDeclaration[id.name=/^[a-z]/]' },
  { message: 'Exported const/function names must be camelCase, PascalCase, or UPPER_CASE.', selector: 'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^[a-z]+$|^[a-z][a-zA-Z0-9]*_/]' },
  { message: 'Single-letter variables are forbidden (except i,j,k,m,n in loops, _ for unused). Use descriptive names.', selector: 'VariableDeclarator[id.name=/^[a-hlo-rt-z]$/]:not([id.name="_"])' },
  { message: 'Single-letter function parameters are forbidden (except _ for unused). Use descriptive names.', selector: ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > Identifier[name=/^[a-z]$/]:not([name="_"]):not([name="i"]):not([name="j"]):not([name="k"]):not([name="m"]):not([name="n"])' },
  { message: 'Use named imports instead of namespace imports (import * as).', selector: 'ImportNamespaceSpecifier' }
];

const coreEslintRules = {
  'array-callback-return': 'error',
  'block-scoped-var': 'error',
  'consistent-return': 'error',
  'curly': ['error'],
  'default-case-last': 'error',
  'eqeqeq': ['error', 'always'],
  'no-class-assign': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-const-assign': 'error',
  'no-constructor-return': 'error',
  'no-debugger': 'error',
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  'no-eq-null': 'error',
  'no-eval': 'error',
  'no-extra-bind': 'error',
  'no-fallthrough': ['error', { allowEmptyCase: false, commentPattern: '^$', reportUnusedFallthroughComment: true }],
  'no-func-assign': 'error',
  'no-global-assign': 'error',
  'no-implicit-globals': 'error',
  'no-invalid-regexp': 'error',
  'no-mixed-operators': ['error', { allowSamePrecedence: true, groups: [['&&', '||']] }],
  'no-multi-assign': 'error',
  'no-nested-ternary': 'error',
  'no-new-func': 'error',
  'no-new-object': 'error',
  'no-new-wrappers': 'error',
  'no-promise-executor-return': 'error',
  'no-prototype-builtins': 'error',
  'no-restricted-exports': ['error', { restrictDefaultExports: { defaultFrom: true, direct: true, named: true, namedFrom: true, namespaceFrom: true } }],
  'no-restricted-syntax': ['error', ...syntaxRestrictions],
  'no-self-compare': 'error',
  'no-shadow-restricted-names': 'error',
  'no-template-curly-in-string': 'error',
  'no-undef': 'error',
  'no-unmodified-loop-condition': 'error',
  'no-unreachable': 'error',
  'no-unsafe-negation': 'error',
  'no-useless-assignment': 'error',
  'no-useless-catch': 'error',
  'no-var': 'error',
  'no-with': 'error',
  'one-var': ['error', 'never'],
  'padding-line-between-statements': [
    'error',
    { blankLine: 'always', next: '*', prev: ['const', 'let', 'var'] },
    { blankLine: 'any', next: ['const', 'let', 'var'], prev: ['const', 'let', 'var'] },
    { blankLine: 'always', next: 'return', prev: '*' },
    { blankLine: 'always', next: '*', prev: 'directive' },
    { blankLine: 'always', next: ['class', 'function'], prev: '*' },
    { blankLine: 'always', next: '*', prev: 'import' },
    { blankLine: 'any', next: 'import', prev: 'import' }
  ],
  'prefer-const': ['error', { destructuring: 'all', ignoreReadBeforeAssign: true }],
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
  'prefer-template': 'error',
  'require-atomic-updates': 'error'
};

const perfectionistPluginRules = {
  'perfectionist/sort-array-includes': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-classes': ['error', { groups: ['static-property', 'static-method', 'property', 'constructor', 'method'], order: 'asc', type: 'natural' }],
  'perfectionist/sort-decorators': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-enums': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-export-attributes': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-exports': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-heritage-clauses': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-import-attributes': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-interfaces': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-intersection-types': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-maps': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-named-exports': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-named-imports': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-object-types': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-objects': ['error', { order: 'asc', partitionByComment: false, sortBy: 'name', type: 'natural' }],
  'perfectionist/sort-sets': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-switch-case': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-union-types': ['error', { order: 'asc', type: 'natural' }],
  'perfectionist/sort-variable-declarations': ['error', { order: 'asc', type: 'natural' }]
};

const typeScriptPluginRules = {
  '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/ban-ts-comment': 'error',
  '@typescript-eslint/consistent-generic-constructors': ['error', 'constructor'],
  '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
  '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }],
  '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
  '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: true }],
  '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports', prefer: 'type-imports' }],
  '@typescript-eslint/default-param-last': 'error',
  '@typescript-eslint/dot-notation': 'error',
  '@typescript-eslint/naming-convention': [
    'error',
    { custom: { match: false, regex: '^I[A-Z]' }, format: ['PascalCase'], selector: 'interface' },
    { format: ['PascalCase'], selector: 'typeAlias' },
    { format: ['PascalCase'], selector: 'enum' },
    { format: ['UPPER_CASE', 'PascalCase'], selector: 'enumMember' },
    { format: ['PascalCase'], selector: 'class' },
    { format: ['camelCase', 'PascalCase'], selector: 'function' },
    { format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow', selector: 'variable', trailingUnderscore: 'forbid' },
    { format: ['camelCase'], leadingUnderscore: 'allow', selector: 'parameter' },
    { format: ['camelCase'], selector: 'method' },
    { format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow', selector: 'property' },
    { format: null, selector: 'objectLiteralProperty' },
    { format: ['camelCase'], selector: 'accessor' },
    { format: ['PascalCase'], prefix: ['T', 'K', 'V', 'U'], selector: 'typeParameter' }
  ],
  '@typescript-eslint/no-array-constructor': 'error',
  '@typescript-eslint/no-dupe-class-members': 'error',
  '@typescript-eslint/no-duplicate-type-constituents': 'error',
  '@typescript-eslint/no-empty-function': 'error',
  '@typescript-eslint/no-empty-object-type': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-implied-eval': 'error',
  '@typescript-eslint/no-inferrable-types': 'error',
  '@typescript-eslint/no-loop-func': 'error',
  '@typescript-eslint/no-loss-of-precision': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/no-redeclare': ['error', { builtinGlobals: true, ignoreDeclarationMerge: true }],
  '@typescript-eslint/no-shadow': ['error', { builtinGlobals: false, hoist: 'functions', ignoreFunctionTypeParameterNameValueShadow: true, ignoreTypeValueShadow: true }],
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/no-unnecessary-qualifier': 'error',
  '@typescript-eslint/no-unnecessary-template-expression': 'error',
  '@typescript-eslint/no-unnecessary-type-arguments': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unused-expressions': 'error',
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_$', varsIgnorePattern: '^_$' }],
  '@typescript-eslint/no-use-before-define': ['error', { classes: true, enums: true, functions: false, typedefs: false, variables: true }],
  '@typescript-eslint/no-useless-constructor': 'error',
  '@typescript-eslint/no-useless-empty-export': 'error',
  '@typescript-eslint/no-wrapper-object-types': 'error',
  '@typescript-eslint/only-throw-error': 'error',
  '@typescript-eslint/prefer-as-const': 'error',
  '@typescript-eslint/prefer-find': 'error',
  '@typescript-eslint/prefer-function-type': 'error',
  '@typescript-eslint/prefer-includes': 'error',
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/prefer-reduce-type-parameter': 'error',
  '@typescript-eslint/prefer-regexp-exec': 'error',
  '@typescript-eslint/prefer-string-starts-ends-with': 'error',
  '@typescript-eslint/require-array-sort-compare': ['error', { ignoreStringArrays: true }],
  '@typescript-eslint/restrict-template-expressions': 'error',
  '@typescript-eslint/return-await': 'error',
  '@typescript-eslint/strict-boolean-expressions': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  'no-redeclare': 'off',
  'no-shadow': 'off',
  'no-unused-vars': 'off',
  'no-use-before-define': 'off'
};

const unicornPluginRules = {
  'unicorn/catch-error-name': ['error', { name: 'error' }],
  'unicorn/consistent-destructuring': 'error',
  'unicorn/consistent-function-scoping': 'error',
  'unicorn/custom-error-definition': 'error',
  'unicorn/empty-brace-spaces': 'error',
  'unicorn/error-message': 'error',
  'unicorn/escape-case': 'error',
  'unicorn/explicit-length-check': 'error',
  'unicorn/new-for-builtins': 'error',
  'unicorn/no-abusive-eslint-disable': 'error',
  'unicorn/no-array-callback-reference': 'error',
  'unicorn/no-array-for-each': 'error',
  'unicorn/no-array-method-this-argument': 'error',
  'unicorn/no-array-push-push': 'error',
  'unicorn/no-await-expression-member': 'error',
  'unicorn/no-await-in-promise-methods': 'error',
  'unicorn/no-console-spaces': 'error',
  'unicorn/no-empty-file': 'error',
  'unicorn/no-for-loop': 'error',
  'unicorn/no-hex-escape': 'error',
  'unicorn/no-instanceof-array': 'error',
  'unicorn/no-invalid-fetch-options': 'error',
  'unicorn/no-invalid-remove-event-listener': 'error',
  'unicorn/no-lonely-if': 'error',
  'unicorn/no-negated-condition': 'error',
  'unicorn/no-negation-in-equality-check': 'error',
  'unicorn/no-new-array': 'error',
  'unicorn/no-new-buffer': 'error',
  'unicorn/no-object-as-default-parameter': 'error',
  'unicorn/no-single-promise-in-promise-methods': 'error',
  'unicorn/no-thenable': 'error',
  'unicorn/no-typeof-undefined': 'error',
  'unicorn/no-unnecessary-await': 'error',
  'unicorn/no-unnecessary-polyfills': ['error', { targets: 'node >= 18' }],
  'unicorn/no-unreadable-array-destructuring': 'error',
  'unicorn/no-unreadable-iife': 'error',
  'unicorn/no-unused-properties': 'error',
  'unicorn/no-useless-fallback-in-spread': 'error',
  'unicorn/no-useless-length-check': 'error',
  'unicorn/no-useless-promise-resolve-reject': 'error',
  'unicorn/no-useless-spread': 'error',
  'unicorn/no-useless-switch-case': 'error',
  'unicorn/no-useless-undefined': 'error',
  'unicorn/no-zero-fractions': 'error',
  'unicorn/number-literal-case': 'error',
  'unicorn/numeric-separators-style': 'error',
  'unicorn/prefer-add-event-listener': 'error',
  'unicorn/prefer-array-find': 'error',
  'unicorn/prefer-array-flat': 'error',
  'unicorn/prefer-array-flat-map': 'error',
  'unicorn/prefer-array-index-of': 'error',
  'unicorn/prefer-array-some': 'error',
  'unicorn/prefer-at': 'error',
  'unicorn/prefer-code-point': 'error',
  'unicorn/prefer-date-now': 'error',
  'unicorn/prefer-default-parameters': 'error',
  'unicorn/prefer-event-target': 'error',
  'unicorn/prefer-export-from': 'error',
  'unicorn/prefer-global-this': 'error',
  'unicorn/prefer-json-parse-buffer': 'error',
  'unicorn/prefer-logical-operator-over-ternary': 'error',
  'unicorn/prefer-math-min-max': 'error',
  'unicorn/prefer-math-trunc': 'error',
  'unicorn/prefer-modern-math-apis': 'error',
  'unicorn/prefer-module': 'error',
  'unicorn/prefer-native-coercion-functions': 'error',
  'unicorn/prefer-negative-index': 'error',
  'unicorn/prefer-node-protocol': 'error',
  'unicorn/prefer-number-properties': 'error',
  'unicorn/prefer-object-from-entries': 'error',
  'unicorn/prefer-optional-catch-binding': 'error',
  'unicorn/prefer-prototype-methods': 'error',
  'unicorn/prefer-set-has': 'error',
  'unicorn/prefer-set-size': 'error',
  'unicorn/prefer-spread': 'error',
  'unicorn/prefer-string-replace-all': 'error',
  'unicorn/prefer-string-slice': 'error',
  'unicorn/prefer-string-trim-start-end': 'error',
  'unicorn/prefer-structured-clone': 'error',
  'unicorn/prefer-switch': 'error',
  'unicorn/prefer-top-level-await': 'error',
  'unicorn/prefer-type-error': 'error',
  'unicorn/require-array-join-separator': 'error',
  'unicorn/require-number-to-fixed-digits-argument': 'error',
  'unicorn/switch-case-braces': ['error', 'avoid'],
  'unicorn/template-indent': 'error',
  'unicorn/text-encoding-identifier-case': 'error',
  'unicorn/throw-new-error': 'error'
};

const regexpPluginRules = {
  'regexp/confusing-quantifier': 'error',
  'regexp/control-character-escape': 'error',
  'regexp/hexadecimal-escape': ['error', 'never'],
  'regexp/match-any': 'error',
  'regexp/negation': 'error',
  'regexp/no-contradiction-with-assertion': 'error',
  'regexp/no-control-character': 'error',
  'regexp/no-dupe-characters-character-class': 'error',
  'regexp/no-dupe-disjunctions': 'error',
  'regexp/no-empty-alternative': 'error',
  'regexp/no-empty-capturing-group': 'error',
  'regexp/no-empty-character-class': 'error',
  'regexp/no-empty-group': 'error',
  'regexp/no-empty-lookarounds-assertion': 'error',
  'regexp/no-empty-string-literal': 'error',
  'regexp/no-escape-backspace': 'error',
  'regexp/no-extra-lookaround-assertions': 'error',
  'regexp/no-invalid-regexp': 'error',
  'regexp/no-invisible-character': 'error',
  'regexp/no-lazy-ends': 'error',
  'regexp/no-legacy-features': 'error',
  'regexp/no-misleading-capturing-group': 'error',
  'regexp/no-misleading-unicode-character': 'error',
  'regexp/no-missing-g-flag': 'error',
  'regexp/no-non-standard-flag': 'error',
  'regexp/no-obscure-range': 'error',
  'regexp/no-octal': 'error',
  'regexp/no-optional-assertion': 'error',
  'regexp/no-potentially-useless-backreference': 'error',
  'regexp/no-standalone-backslash': 'error',
  'regexp/no-super-linear-backtracking': 'error',
  'regexp/no-super-linear-move': 'error',
  'regexp/no-trivially-nested-assertion': 'error',
  'regexp/no-trivially-nested-quantifier': 'error',
  'regexp/no-unused-capturing-group': 'error',
  'regexp/no-useless-assertions': 'error',
  'regexp/no-useless-backreference': 'error',
  'regexp/no-useless-character-class': 'error',
  'regexp/no-useless-dollar-replacements': 'error',
  'regexp/no-useless-escape': 'error',
  'regexp/no-useless-flag': 'error',
  'regexp/no-useless-lazy': 'error',
  'regexp/no-useless-non-capturing-group': 'error',
  'regexp/no-useless-quantifier': 'error',
  'regexp/no-useless-range': 'error',
  'regexp/no-useless-set-operand': 'error',
  'regexp/no-useless-string-literal': 'error',
  'regexp/no-useless-two-nums-quantifier': 'error',
  'regexp/no-zero-quantifier': 'error',
  'regexp/optimal-lookaround-quantifier': 'error',
  'regexp/optimal-quantifier-concatenation': 'error',
  'regexp/prefer-character-class': 'error',
  'regexp/prefer-d': 'error',
  'regexp/prefer-escape-replacement-dollar-char': 'error',
  'regexp/prefer-lookaround': 'error',
  'regexp/prefer-named-backreference': 'error',
  'regexp/prefer-named-replacement': 'error',
  'regexp/prefer-plus-quantifier': 'error',
  'regexp/prefer-predefined-assertion': 'error',
  'regexp/prefer-quantifier': 'error',
  'regexp/prefer-question-quantifier': 'error',
  'regexp/prefer-range': 'error',
  'regexp/prefer-regexp-test': 'error',
  'regexp/prefer-result-array-groups': 'error',
  'regexp/prefer-set-operation': 'error',
  'regexp/prefer-star-quantifier': 'error',
  'regexp/prefer-unicode-codepoint-escapes': 'error',
  'regexp/prefer-w': 'error',
  'regexp/require-unicode-regexp': 'error',
  'regexp/simplify-set-operations': 'error',
  'regexp/sort-alternatives': 'error',
  'regexp/sort-flags': 'error',
  'regexp/strict': 'error',
  'regexp/use-ignore-case': 'error'
};

// ---------------------------------------------------------------------------
// Plugin groups
// ---------------------------------------------------------------------------

const jsModulePlugins = {
  '@stylistic': stylistic,
  'perfectionist': perfectionist
};

const typeScriptPlugins = {
  '@stylistic': stylistic,
  '@typescript-eslint': tsPlugin,
  'filename-export': filenameExportPlugin,
  'perfectionist': perfectionist,
  'regexp': regexpPlugin,
  'unicorn': unicornPlugin
};

// ---------------------------------------------------------------------------
// Config blocks
// ---------------------------------------------------------------------------

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/*.min.js',
      '**/*.d.ts',
      '**/vendor/**',
      '.claude',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
      'eslint.config.mjs'
    ]
  },

  js.configs.recommended,

  // JavaScript/module files
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.nodeBuiltin },
      sourceType: 'module'
    },
    plugins: jsModulePlugins,
    rules: {
      ...stylisticPluginRules,
      ...coreEslintRules,
      ...perfectionistPluginRules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_$', varsIgnorePattern: '^_$' }]
    }
  },

  // YAML files
  {
    files: ['**/*.yml', '**/*.yaml'],
    ignores: ['**/node_modules/**'],
    language: 'yml/yaml',
    plugins: { yml: ymlPlugin },
    rules: {
      'yml/indent': ['error', 2],
      'yml/no-tab-indent': 'error',
      'yml/sort-keys': ['error', 'asc', { caseSensitive: true, natural: true }]
    }
  },

  // Workflow YAML override (conventional key order, not alphabetical)
  {
    files: ['.github/workflows/**/*.yml', '.github/workflows/**/*.yaml'],
    rules: { 'yml/sort-keys': 'off' }
  },

  // TypeScript source files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.nodeBuiltin },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        project: ['./tsconfig.eslint.json'],
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname || process.cwd()
      }
    },
    plugins: typeScriptPlugins,
    rules: {
      ...stylisticPluginRules,
      ...coreEslintRules,
      ...perfectionistPluginRules,
      ...typeScriptPluginRules,
      ...unicornPluginRules,
      ...regexpPluginRules
    }
  },

  // Test files (relaxed rules)
  {
    files: ['test/**/*.ts', '**/*.test.ts', 'bench/**/*.ts', 'examples/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.nodeBuiltin },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        project: ['./tsconfig.eslint.json'],
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname || process.cwd()
      }
    },
    plugins: typeScriptPlugins,
    rules: {
      ...stylisticPluginRules,
      ...coreEslintRules,
      ...perfectionistPluginRules,
      ...typeScriptPluginRules,
      ...unicornPluginRules,
      ...regexpPluginRules,
      'no-restricted-syntax': ['error', ...syntaxRestrictions]
    }
  }
];
