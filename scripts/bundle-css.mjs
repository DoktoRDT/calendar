import {copyFile, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const distDir = new URL('../dist', import.meta.url).pathname;
const tokensPath = new URL('../src/theme/tokens.css', import.meta.url).pathname;

async function bundleCss() {
    const tokens = await readFile(tokensPath, 'utf8');
    await copyFile(tokensPath, join(distDir, 'tokens.css'));

    const indexCssPath = join(distDir, 'index.css');
    const cssCandidates = ['index.css', 'style.css', 'calendar.css'];

    let moduleCss = '';
    let sourceCssPath = '';
    for (const name of cssCandidates) {
        try {
            moduleCss = await readFile(join(distDir, name), 'utf8');
            sourceCssPath = join(distDir, name);
            break;
        } catch {
        }
    }

    if (!moduleCss) {
        console.warn('No bundled CSS found in dist/');
        return;
    }

    await writeFile(indexCssPath, `${tokens}\n${moduleCss}`);
    if (sourceCssPath !== indexCssPath) {
        try {
            const {unlink} = await import('node:fs/promises');
            await unlink(sourceCssPath);
        } catch {
        }
    }

    console.log('Bundled theme tokens into dist/index.css');
}

bundleCss().catch(error => {
    console.error(error);
    process.exit(1);
});
