import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

// #11: desktop drag selection needs real layout (hit-testing by the date cells' boxes, RTL geometry, pointer capture, the
// suppressed click), so it is checked in Chrome; the rest of selection is covered by jsdom tests through CalendarMonth.
// node scripts/implementation/selection-probe.mjs [<output dir>]
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const output = resolve(process.argv[2] ?? resolve(tmpdir(), 'calendar-selection'));
mkdirSync(output, {recursive: true});
const directory = mkdtempSync(resolve(tmpdir(), 'calendar-selection-'));
await build({configFile: false, logLevel: 'error', define: {'process.env.NODE_ENV': '"production"'},
    build: {outDir: directory, minify: true, lib: {entry: resolve(here, 'selection-entry.tsx'), formats: ['es'], fileName: () => 'index.mjs'}}});
const moduleUrl = 'data:text/javascript;base64,' + readFileSync(resolve(directory, 'index.mjs')).toString('base64');
const css = readFileSync(resolve(root, 'src/v02/styles.css'), 'utf8');
const {chromium} = await import('./spikes/node_modules/playwright/index.mjs');
const browser = await chromium.launch({channel: 'chrome', headless: true});
const checks = [], errors = [], version = browser.version();
// Development aid only: a filtered run is marked in the report and never counts as complete evidence.
const only = process.env.CALENDAR_PROBE_ONLY ? new RegExp(process.env.CALENDAR_PROBE_ONLY) : null;
const check = async (name, operation) => {
    if (only && !only.test(name)) return;
    try { const details = await operation(); checks.push({name, outcome: 'pass', ...(details ? {details} : {})}); }
    catch (error) { checks.push({name, outcome: 'fail', error: String(error)}); }
    writeFileSync(resolve(output, 'checks.json'), JSON.stringify(checks, null, 2) + '\n');
    console.log(`${checks.at(-1).outcome}: ${name}${checks.at(-1).error ? '\n' + checks.at(-1).error : ''}`);
};
const settle = page => page.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame); });
const cell = (page, date) => page.locator(`[role=gridcell][data-date="${date}"]`);
const events = page => page.evaluate(() => window.fixture.events.filter(event => event.type !== 'navigate'));
const live = page => page.evaluate(() => window.live.splice(0));
const drafts = page => page.evaluate(() => [...document.querySelectorAll('[data-selection-draft]')].map(node => node.dataset.date));
const focused = page => page.evaluate(() => document.activeElement?.dataset.date ?? document.activeElement?.textContent ?? null);
async function setup(options = {}, viewport = {width: 980, height: 800}) {
    const context = await browser.newContext({viewport, locale: 'en-US', hasTouch: true}), page = await context.newPage();
    page.setDefaultTimeout(4000); page.on('pageerror', error => errors.push(String(error)));
    await page.setContent('<style>body{margin:0;font:16px/1.4 system-ui;background:#f5f4f1}</style><div id="owner"></div><div style="height:600px"></div>');
    await page.evaluate(async ({moduleUrl, css, options}) => {
        const style = document.createElement('style'); style.textContent = css; document.head.append(style);
        const module = await import(moduleUrl);
        window.fixture = module.mountSelection(document.getElementById('owner'), options);
        // Every write to a live region: one entry per DOM mutation, clearing writes left out.
        window.live = [];
        new MutationObserver(records => { for (const record of records) {
            const host = record.target;
            if (host.matches?.('[role=status],[role=alert]') && host.textContent) window.live.push(`${host.getAttribute('role') === 'alert' ? 'urgent' : 'polite'}: ${host.textContent}`);
        } }).observe(document.body, {childList: true, subtree: true});
    }, {moduleUrl, css, options});
    await settle(page); return {page, context};
}
/** A point in the empty lower area of a date cell (below its header and any lanes). */
async function point(page, date, dx = 0) {
    const box = await cell(page, date).boundingBox();
    return {x: box.x + box.width / 2 + dx, y: box.y + box.height - 6};
}
async function drag(page, from, to, {release = true} = {}) {
    const start = await point(page, from), end = await point(page, to);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(end.x, end.y, {steps: 12}); await settle(page);
    if (release) { await page.mouse.up(); await settle(page); }
    return end;
}
const range = (start, end) => ({type: 'selection', value: {start, end}});

try {
    for (const dir of ['ltr', 'rtl']) {
        await check(`${dir}: a drag from 3 to 10 September and its reverse select [3, 11) once; focus moves to the endpoint without scrolling, the click is suppressed`, async () => {
            // Requests are recorded, never accepted: the reverse drag is a second request, not a no-op.
            const {page, context} = await setup({dir, accept: false});
            try {
                const first = await cell(page, '2026-09-03').boundingBox(), next = await cell(page, '2026-09-04').boundingBox();
                // The geometry really mirrors in RTL: the next date is to the left.
                assert.equal(next.x > first.x, dir === 'ltr');
                await page.evaluate(() => {
                    window.scrolls = 0;
                    const original = Element.prototype.scrollIntoView;
                    Element.prototype.scrollIntoView = function (...args) { window.scrolls++; return original.apply(this, args); };
                });
                await drag(page, '2026-09-03', '2026-09-10');
                assert.deepEqual(await events(page), [range('2026-09-03', '2026-09-11')]);
                assert.equal(await focused(page), '2026-09-10'); assert.equal(await page.evaluate(() => window.scrolls), 0);
                assert.equal(await page.locator('.nc-day-list').count(), 0, 'the following click views no day');
                const speech = await live(page);
                assert.match(speech[0], /^polite: Selection starts on Sep 3, 2026 Range: Sep 3, 2026 – Sep \d+, 2026\. Available$/);
                assert.ok(speech.every(entry => entry.startsWith('polite: Range: ') || entry === speech[0]), JSON.stringify(speech));
                assert.ok(speech.every(entry => !entry.includes('Space or Enter')), 'a held drag never speaks the range-mode instruction');
                await drag(page, '2026-09-10', '2026-09-03');
                assert.deepEqual(await events(page), [range('2026-09-03', '2026-09-11'), range('2026-09-03', '2026-09-11')]);
                assert.equal(await focused(page), '2026-09-03'); assert.equal(await page.locator('.nc-day-list').count(), 0);
                return {speech};
            } finally { await context.close(); }
        });
        await check(`${dir}: a held drag marks the draft, keeps focus on the press cell and inserts no mode line`, async () => {
            const {page, context} = await setup({dir});
            try {
                const top = await page.locator('[role=grid]').boundingBox();
                await drag(page, '2026-09-03', '2026-09-09', {release: false});
                assert.deepEqual(await drafts(page), ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09']);
                assert.equal(await focused(page), '2026-09-03');
                assert.equal(await page.locator('.nc-selection-line').count(), 0);
                assert.deepEqual(await page.locator('[role=grid]').boundingBox(), top);
                assert.doesNotMatch(await page.locator('[role=grid]').getAttribute('aria-describedby'), /range/);
                await page.mouse.up(); await settle(page);
            } finally { await context.close(); }
        });
    }
    await check('a drag back onto its anchor selects that one day and its click views nothing; no text is selected', async () => {
        const {page, context} = await setup({accept: false, items: [{id: 'a', title: 'Alpha', data: {}, interval: {kind: 'allDay', start: '2026-09-03', end: '2026-09-04'}}]});
        try {
            const start = await point(page, '2026-09-03'), away = await point(page, '2026-09-06');
            await page.mouse.move(start.x, start.y); await page.mouse.down();
            await page.mouse.move(away.x, away.y, {steps: 8}); await page.mouse.move(start.x, start.y, {steps: 8}); await page.mouse.up(); await settle(page);
            assert.deepEqual(await events(page), [range('2026-09-03', '2026-09-04')]);
            assert.equal(await page.locator('.nc-day-list').count(), 0);
            assert.equal(await page.evaluate(() => getSelection().toString()), '');
            assert.equal(await page.locator('[role=grid]').evaluate(node => node.style.userSelect), '');
            // The next ordinary click is not swallowed.
            await page.mouse.click(start.x, start.y); await settle(page);
            assert.equal(await page.locator('.nc-day-list[data-date="2026-09-03"]').count(), 1);
        } finally { await context.close(); }
    });
    await check('a press that never becomes a drag is an ordinary click that views the day', async () => {
        const {page, context} = await setup();
        try {
            const start = await point(page, '2026-09-08');
            await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 30, start.y, {steps: 4}); await page.mouse.up(); await settle(page);
            assert.deepEqual(await events(page), []);
            assert.equal(await page.locator('.nc-day-list[data-date="2026-09-08"]').count(), 1);
        } finally { await context.close(); }
    });
    await check('crossing into the next cell less than 4 CSS px from the press point does not start a drag', async () => {
        const {page, context} = await setup();
        try {
            const box = await cell(page, '2026-09-08').boundingBox(), y = box.y + box.height - 6, x = box.x + box.width - 1;
            await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 3, y, {steps: 3}); await settle(page);
            assert.deepEqual(await drafts(page), []);
            await page.mouse.up(); await settle(page);
            assert.deepEqual(await events(page), []);
            // Past the threshold the same gesture is a drag.
            await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 6, y, {steps: 3}); await settle(page);
            assert.deepEqual(await drafts(page), ['2026-09-08', '2026-09-09']);
            await page.mouse.up(); await settle(page);
            assert.deepEqual(await events(page), [range('2026-09-08', '2026-09-10')]);
        } finally { await context.close(); }
    });
    for (const [label, end] of [
        ['Escape', page => page.keyboard.press('Escape')],
        // lostpointercapture fires when the next pointer event is processed after the release.
        ['a loss of pointer capture', async page => {
            await page.evaluate(() => { const grid = document.querySelector('[role=grid]'); if (!grid.hasPointerCapture(1)) throw new Error('no capture'); grid.releasePointerCapture(1); });
            const end = await point(page, '2026-09-10', 2); await page.mouse.move(end.x, end.y);
        }],
        ['a window blur', page => page.evaluate(() => window.dispatchEvent(new Event('blur')))],
    ]) await check(`${label} during a recognized drag cancels with one cancellation speech and sends nothing`, async () => {
        const {page, context} = await setup();
        try {
            await drag(page, '2026-09-03', '2026-09-10', {release: false});
            await live(page);
            await end(page); await settle(page);
            assert.deepEqual(await drafts(page), []);
            await page.mouse.up(); await settle(page);
            assert.deepEqual(await events(page), []);
            assert.deepEqual(await live(page), ['polite: Selection cancelled']);
            assert.equal(await page.locator('.nc-day-list').count(), 0);
        } finally { await context.close(); }
    });
    await check('a blocked drop sends nothing, speaks urgently once and keeps the draft as range mode with the mode line', async () => {
        const {page, context} = await setup({blocked: ['2026-09-08']});
        try {
            const top = (await page.locator('[role=grid]').boundingBox()).y;
            await drag(page, '2026-09-03', '2026-09-10');
            assert.deepEqual(await events(page), []);
            const speech = await live(page);
            assert.deepEqual(speech.filter(entry => entry.startsWith('urgent')), ['urgent: Action unavailable: Closed 2026-09-08']);
            assert.ok(!speech.some(entry => entry.includes('Space or Enter')), 'the instruction joins the description silently');
            assert.equal(await page.locator('.nc-selection-line').count(), 1);
            assert.match(await page.locator('.nc-selection-line').textContent(), /Closed 2026-09-08/);
            assert.match(await page.locator('[role=grid]').getAttribute('aria-describedby'), /range-instructions/);
            assert.ok((await page.locator('[role=grid]').boundingBox()).y > top, 'the grid moves once, when range mode starts');
            assert.equal(await focused(page), '2026-09-10');
            // A date click now completes the corrected range.
            await cell(page, '2026-09-05').click(); await settle(page);
            assert.deepEqual(await events(page), [range('2026-09-03', '2026-09-06')]);
            assert.equal(await page.locator('.nc-selection-line').count(), 0);
        } finally { await context.close(); }
    });
    await check('a release over an item segment completes at its date and presses no item; a press on a segment starts no selection drag', async () => {
        const items = [{id: 'bar', title: 'Conference', data: {}, interval: {kind: 'allDay', start: '2026-09-09', end: '2026-09-12'}}];
        const {page, context} = await setup({items});
        try {
            const segment = await page.locator('.nc-month-item[data-item-id="bar"]').first().boundingBox();
            const start = await point(page, '2026-09-02');
            await page.mouse.move(start.x, start.y); await page.mouse.down();
            await page.mouse.move(segment.x + segment.width * 5 / 6, segment.y + segment.height / 2, {steps: 12}); await page.mouse.up(); await settle(page);
            assert.deepEqual(await events(page), [range('2026-09-02', '2026-09-12')]);
            await page.mouse.move(segment.x + 10, segment.y + segment.height / 2); await page.mouse.down();
            await page.mouse.move(start.x, start.y, {steps: 12}); await settle(page);
            assert.deepEqual(await drafts(page), []);
            await page.mouse.up(); await settle(page);
            assert.equal((await events(page)).filter(event => event.type === 'selection').length, 1);
        } finally { await context.close(); }
    });
    await check('touch never starts a drag; the mobile layout has none either', async () => {
        const {page, context} = await setup();
        try {
            const cdp = await context.newCDPSession(page), start = await point(page, '2026-09-03'), end = await point(page, '2026-09-10');
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [start]});
            for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: start.x + (end.x - start.x) * i / 8, y: start.y + (end.y - start.y) * i / 8}]});
            assert.deepEqual(await drafts(page), []);
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await settle(page);
            assert.deepEqual((await events(page)).filter(event => event.type === 'selection'), []);
            await page.evaluate(() => window.fixture.patch({layout: 'mobile'})); await settle(page);
            await drag(page, '2026-09-03', '2026-09-10', {release: false});
            assert.deepEqual(await drafts(page), []);
            await page.mouse.up(); await settle(page);
            assert.deepEqual((await events(page)).filter(event => event.type === 'selection'), []);
        } finally { await context.close(); }
    });
    await check('a switch to the mobile layout ends a held drag with the cancellation speech', async () => {
        const {page, context} = await setup();
        try {
            await drag(page, '2026-09-03', '2026-09-10', {release: false});
            await live(page);
            await page.evaluate(() => window.fixture.patch({layout: 'mobile'})); await settle(page);
            assert.deepEqual(await drafts(page), []);
            await page.mouse.up(); await settle(page);
            assert.deepEqual(await events(page), []); assert.deepEqual(await live(page), ['polite: Selection cancelled']);
        } finally { await context.close(); }
    });
    await check('an accepted Clear keeps focus on the now aria-disabled Clear and its speech is heard', async () => {
        const {page, context} = await setup({selection: {start: '2026-09-03', end: '2026-09-04'}});
        try {
            const clear = page.getByRole('button', {name: 'Clear selection'});
            await clear.focus(); await page.keyboard.press('Enter'); await settle(page);
            assert.deepEqual(await events(page), [{type: 'selection', value: null}]);
            assert.equal(await clear.getAttribute('aria-disabled'), 'true');
            assert.equal(await focused(page), 'Clear selection');
            assert.deepEqual(await live(page), ['polite: Selection cleared']);
        } finally { await context.close(); }
    });
    await check('at 320 CSS px the toolbar and the mode line wrap without horizontal scroll; the line never shrinks while a reason comes and goes', async () => {
        const {page, context} = await setup({layout: 'auto', blocked: ['2026-09-17'], onCreateRequest: undefined}, {width: 320, height: 800});
        try {
            await page.getByRole('button', {name: 'Select range'}).click(); await settle(page);
            const line = page.locator('.nc-selection-line'), grid = page.locator('[role=grid]');
            const before = {line: (await line.boundingBox()).height, grid: (await grid.boundingBox()).y};
            await page.keyboard.press(' '); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await settle(page);
            assert.match(await line.textContent(), /Closed 2026-09-17/);
            const blocked = {line: (await line.boundingBox()).height, grid: (await grid.boundingBox()).y};
            await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await settle(page);
            const cleared = {line: (await line.boundingBox()).height, grid: (await grid.boundingBox()).y};
            assert.ok(blocked.line >= before.line && cleared.line === blocked.line, JSON.stringify({before, blocked, cleared}));
            assert.equal(cleared.grid, blocked.grid);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            return {before, blocked, cleared};
        } finally { await context.close(); }
    });
    for (const interruption of ['Tab back into the grid', 'a window blur']) await check(`a delayed toolbar acceptance after ${interruption} keeps the draft; the endpoint follows the clamped focus`, async () => {
        const {page, context} = await setup({accept: false});
        try {
            await page.getByRole('button', {name: 'Select range'}).click(); await settle(page);
            await cell(page, '2026-09-10').focus(); await page.keyboard.press(' '); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await settle(page);
            await page.getByRole('button', {name: 'Next month'}).click(); await settle(page);
            const intoGrid = async () => { for (let i = 0; i < 12 && !(await page.evaluate(() => document.activeElement?.matches('[role=gridcell]'))); i++) await page.keyboard.press('Tab'); };
            if (interruption.startsWith('Tab')) await intoGrid(); else await page.evaluate(() => window.dispatchEvent(new Event('blur')));
            await settle(page);
            await page.evaluate(() => window.fixture.patch({anchorDate: '2026-10-01'})); await settle(page);
            assert.equal(await page.locator('.nc-selection-line').count(), 1);
            if (!interruption.startsWith('Tab')) {
                assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Next month');
                await intoGrid(); await settle(page);
            }
            assert.equal(await focused(page), '2026-10-12');
            await page.keyboard.press(' '); await settle(page);
            assert.deepEqual((await events(page)).filter(event => event.type === 'selection'), [range('2026-09-10', '2026-10-13')]);
        } finally { await context.close(); }
    });
    for (const [label, options, viewport] of [['a modal sheet', {layout: 'mobile', agendaPresentation: 'overlay'}, {width: 400, height: 800}], ['a popover', {layout: 'desktop'}, undefined]]) {
        await check(`Tab reaches the aria-disabled Select day of a blocked empty day in ${label}`, async () => {
            const {page, context} = await setup({...options, blocked: ['2026-09-10']}, viewport);
            try {
                const at = await point(page, '2026-09-10');
                await page.mouse.click(at.x, at.y); await settle(page);
                const select = page.getByRole('button', {name: 'Select day'});
                assert.equal(await select.getAttribute('aria-disabled'), 'true');
                const sheet = label.includes('sheet'), order = [];
                for (let i = 0; i < (sheet ? 4 : 2); i++) { await page.keyboard.press('Tab'); await settle(page); order.push(await focused(page)); }
                if (sheet) assert.deepEqual(order.map(entry => entry?.trim()), ['', 'Select day', '', 'Select day'], JSON.stringify(order));
                else { assert.equal(order[0]?.trim(), 'Select day', JSON.stringify(order)); assert.equal(await page.locator('.nc-day-list').count(), 0); }
                return {order};
            } finally { await context.close(); }
        });
    }
} finally { await browser.close(); }
const paths = ['src/v02/core/selection.ts', 'src/v02/core/policy.ts', 'src/v02/calendar/useSelection.ts', 'src/v02/calendar/SelectionControls.tsx', 'src/v02/calendar/MonthView.tsx',
    'src/v02/calendar/CalendarMonth.tsx', 'src/v02/calendar/CalendarShell.tsx', 'src/v02/styles.css', 'scripts/implementation/selection-entry.tsx', 'scripts/implementation/selection-probe.mjs'];
const report = {capturedAt: new Date().toISOString(), outcome: !only && checks.every(entry => entry.outcome === 'pass') && !errors.length ? 'pass' : 'fail', filter: only ? String(only) : null,
    node: process.version, browser: version, checks, errors,
    scope: '#11 desktop drag selection in Chrome: hit-testing by date cell boxes in LTR and RTL, the 4 CSS px threshold over another cell, pointer capture and its loss, Escape and window blur, the suppressed click, a blocked drop kept as range mode, releases over item segments, touch and mobile without drag, focus kept on an accepted Clear, and the mode line at 320 px. Not physical touch or AT qualification.',
    sourceHashes: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')]))};
writeFileSync(resolve(output, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Selection: ${checks.filter(entry => entry.outcome === 'pass').length}/${checks.length}; ${errors.length} page errors; ${output}`);
if (report.outcome === 'fail') process.exitCode = 1;
