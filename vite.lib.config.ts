import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [
        react(),
        dts({
            include: ['src'],
            tsconfigPath: './tsconfig.build.json',
            bundleTypes: true,
        }),
    ],
    resolve: {
        alias: {
            '@': resolve(rootDir, 'src'),
        },
    },
    build: {
        lib: {
            entry: resolve(rootDir, 'src/index.ts'),
            formats: ['es', 'cjs'],
            fileName: format => (format === 'es' ? 'index.js' : 'index.cjs'),
            cssFileName: 'index',
        },
        rollupOptions: {
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                'react-aria-components',
                '@react-aria/interactions',
                'dayjs',
                /^dayjs\/.+/,
                'classnames',
            ],
        },
        cssCodeSplit: false,
        outDir: 'dist',
        emptyOutDir: true,
    },
    css: {
        modules: {
            localsConvention: 'camelCaseOnly',
            generateScopedName: '[name]__[local]__[hash:base64:5]',
        },
    },
});
