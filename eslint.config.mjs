// @ts-check
'use strict';

import globals from 'globals';
import eslint from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';

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
            '@typescript-eslint': tsEslintPlugin
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tsEslintPlugin.configs.recommended.rules
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
        rules: {
            ...eslint.configs.recommended.rules
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
            '@typescript-eslint': tsEslintPlugin
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tsEslintPlugin.configs.recommended.rules
        }
    }
];
