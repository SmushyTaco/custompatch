// @ts-check

import globals from 'globals';
import eslint from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    files: ['**/*.ts', '**/*.cts', '**/*.mts'],
    ignores: ['vite.config.ts'],
    languageOptions: {
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
      unicorn: unicornPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tsEslintPlugin.configs.recommended.rules,
      ...unicornPlugin.configs.recommended.rules,
      'prettier/prettier': 'error'
    }
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        sourceType: 'module'
      }
    },
    plugins: {
      unicorn: unicornPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...unicornPlugin.configs.recommended.rules,
      'prettier/prettier': 'error'
    }
  },
  {
    files: ['vite.config.ts'],
    languageOptions: {
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.vite.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
      unicorn: unicornPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tsEslintPlugin.configs.recommended.rules,
      ...unicornPlugin.configs.recommended.rules,
      'prettier/prettier': 'error'
    }
  }
];
