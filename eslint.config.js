import js from '@eslint/js';
import {defineConfig} from 'eslint/config';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
    {
        ignores: [
            'dist/**',
            'storybook-static/**',
            'node_modules/**',
            'coverage/**',
            'scripts/**',
        ],
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-hooks/set-state-in-effect': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {prefer: 'type-imports', fixStyle: 'inline-type-imports'},
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
            ],
        },
    },
);
