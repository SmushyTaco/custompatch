// @ts-check
'use strict';

import globals from 'globals';
import eslint from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';

export default [
    {
        files: ['**/*.ts'],
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
    }
];
