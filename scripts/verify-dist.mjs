import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const distDir = new URL('../dist', import.meta.url).pathname;

const VARIANT_KEYS = ['variantRed', 'variantBlue', 'variantGreen', 'variantGrey'];

async function verifyDist() {
    const js = await readFile(join(distDir, 'index.js'), 'utf8');
    const css = await readFile(join(distDir, 'index.css'), 'utf8');

    if (/\w+_default = \{\}/.test(js)) {
        throw new Error('CSS module class maps are empty in dist/index.js');
    }

    if (!js.includes('__')) {
        throw new Error('CSS module class names are not scoped in dist/index.js');
    }

    for (const key of VARIANT_KEYS) {
        if (!new RegExp(`${key}:\\s*\\w+`).test(js)) {
            throw new Error(`Missing CSS module entry "${key}" in dist/index.js`);
        }

        if (!js.includes(`eventVariants-module__${key}__`)) {
            throw new Error(`Missing scoped class string for "${key}" in dist/index.js`);
        }

        if (!css.includes(`__${key}__`)) {
            throw new Error(`Missing scoped CSS rule for "${key}" in dist/index.css`);
        }
    }

    if (!css.includes('--tc-border-color')) {
        throw new Error('Theme token defaults missing from dist/index.css');
    }

    if (!css.includes('--tc-background-color')) {
        throw new Error('Background token missing from dist/index.css');
    }

    const mod = await import(join(distDir, 'index.js'));
    if (typeof mod.Calendar !== 'function' || typeof mod.CalendarSkeleton !== 'function') {
        throw new Error('dist entry exports are missing');
    }

    console.log('dist verification passed');
}

verifyDist().catch(error => {
    console.error(error);
    process.exit(1);
});
