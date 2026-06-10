import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import type {StorybookConfig} from '@storybook/react-vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|tsx)'],
    addons: ['@storybook/addon-essentials'],
    framework: {
        name: '@storybook/react-vite',
        options: {},
    },
    async viteFinal(viteConfig) {
        viteConfig.base = process.env.STORYBOOK_BASE_PATH ?? '/';

        viteConfig.resolve ??= {};
        viteConfig.resolve.alias = {
            ...viteConfig.resolve.alias,
            '@': resolve(rootDir, '../src'),
        };
        return viteConfig;
    },
};

export default config;
