// @ts-check
// Lint-kapu az admin apphoz (FE-refaktor WP-A0, 2026-10-23).
// Szándékosan szűk szabálykészlet: a refaktor-terv őrkorlátai, nem teljes "recommended" stílus-átírás.
// A már tiszta szabályok `error`-ok. Átmenetileg `warn`: a `no-explicit-any` és a `template/no-any`
// (5 + 4 meglévő előfordulás) – a WP-A1 tünteti el őket, és ott válnak `error`-rá.
// Angular 22-ben az OnPush az alapértelmezés, ezért a `changeDetection` nélküli komponenseket
// a `prefer-on-push-component-change-detection` nem jelzi.
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig(
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@angular-eslint': angular.tsPlugin,
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/no-lifecycle-call': 'error',
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: {
      parser: angular.templateParser,
    },
    plugins: {
      '@angular-eslint/template': angular.templatePlugin,
    },
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/no-any': 'warn',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
    },
  },
);
