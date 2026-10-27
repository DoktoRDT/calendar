import {StrictMode} from 'react';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {hydrateRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {CalendarDateRange, CalendarDayState, CalendarInteractionPolicy, CalendarProps, PolicyResult} from '../../reference.js';
import {CalendarMonth} from '../CalendarMonth.js';

// #11: selection through the internal CalendarMonth, which accepts the full reference props; the public Calendar strips them.
type Options = Partial<Record<keyof CalendarProps, unknown>>;
const base = (overrides: Options = {}) => ({items: [], anchorDate: '2026-09-01', today: '2026-09-15', timeZone: 'UTC', locale: 'en-US', layout: 'desktop',
    onNavigate() {}, ...overrides}) as CalendarProps;
const selecting = (overrides: Options = {}) => base({selection: null, onSelectionChange: vi.fn(), ...overrides});
const changes = (props: CalendarProps) => (props.onSelectionChange as ReturnType<typeof vi.fn>).mock.calls.map(([value]) => value);
const range = (start: string, end: string): CalendarDateRange => ({start, end});
const cell = (date: string, scope: ParentNode = document) => scope.querySelector<HTMLElement>(`[role=gridcell][data-date="${date}"]`)!;
const button = (name: string | RegExp) => screen.getByRole('button', {name});
const blockedOn = (...dates: string[]): CalendarInteractionPolicy => ({canSelectDate: (date): PolicyResult => dates.includes(date) ? {allowed: false, reason: `Closed on ${date}`} : true});
const tree = (props: CalendarProps, strict = true) => strict ? <StrictMode><CalendarMonth {...props}/></StrictMode> : <CalendarMonth {...props}/>;

/** Every write to a live region of the document, as `polite: text` / `urgent: text`; clearing writes are left out. */
function liveLog() {
    const log: string[] = [];
    const record = (records: MutationRecord[]) => {
        for (const entry of records) {
            const host = entry.target as HTMLElement;
            if (entry.type === 'childList' && host.matches?.('[role=status],[role=alert]') && host.textContent) log.push(`${host.getAttribute('role') === 'alert' ? 'urgent' : 'polite'}: ${host.textContent}`);
        }
    };
    const observer = new MutationObserver(record);
    observer.observe(document.body, {childList: true, subtree: true});
    return {read: () => { record(observer.takeRecords()); return log.splice(0); }, stop: () => observer.disconnect()};
}
let live: ReturnType<typeof liveLog>, warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { live = liveLog(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { live.stop(); vi.restoreAllMocks(); });
const warnings = () => warn.mock.calls.map(([message]) => String(message));

/** Focus a date cell and press keys, as a keyboard user who reached it. */
async function keys(user: ReturnType<typeof userEvent.setup>, date: string, sequence: string) {
    act(() => cell(date).focus());
    await user.keyboard(sequence);
}

describe('the same normalized range from every input (#11)', () => {
    it.each([
        ['Space on a date cell', async (user: ReturnType<typeof userEvent.setup>) => keys(user, '2026-09-03', ' ')],
        ['Select day in the agenda', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(cell('2026-09-03')); await user.click(button('Select day')); }],
        ['range mode, Space twice on one date', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(button('Select range')); await keys(user, '2026-09-03', '  '); }],
        ['range mode, Enter twice on one date', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(button('Select range')); await keys(user, '2026-09-03', '{Enter}{Enter}'); }],
        ['range mode, two clicks on one date', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(button('Select range')); await user.click(cell('2026-09-03')); await user.click(cell('2026-09-03')); }],
    ])('%s gives one day', async (_label, act) => {
        const user = userEvent.setup(), props = selecting();
        render(tree(props));
        await act(user);
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-04')]);
    });
    it.each([
        ['keyboard, forward', ['{ArrowRight>7/}']],
        ['keyboard, reverse', ['{ArrowLeft>7/}']],
    ])('range mode, %s', async (label, [move]) => {
        const user = userEvent.setup(), props = selecting(), start = label.endsWith('forward') ? '2026-09-03' : '2026-09-10';
        render(tree(props));
        await user.click(button('Select range'));
        await keys(user, start, ` ${move} `);
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-11')]);
    });
    it.each([
        ['mouse, forward', '2026-09-03', '2026-09-10', false], ['mouse, reverse', '2026-09-10', '2026-09-03', false],
        ['touch, forward', '2026-09-03', '2026-09-10', true], ['touch, reverse', '2026-09-10', '2026-09-03', true],
    ])('range mode, two %s presses', async (_label, first, second, touch) => {
        const user = userEvent.setup(), props = selecting({layout: touch ? 'mobile' : 'desktop'}), onAgendaDateChange = vi.fn();
        render(tree({...props, agendaDate: '2026-09-15', onAgendaDateChange} as CalendarProps));
        await user.click(button('Select range'));
        for (const date of [first, second]) {
            if (touch) await user.pointer({keys: '[TouchA]', target: cell(date)}); else await user.click(cell(date));
        }
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-11')]);
        // Range selection never sets the agenda date to its start or end.
        expect(onAgendaDateChange).not.toHaveBeenCalled();
    });
});

describe('range mode with Escape', () => {
    it('Space on 10 September, arrows back to 3 September, Space, Escape: one request; Escape clears nothing', async () => {
        const user = userEvent.setup(), props = selecting();
        const view = render(tree(props));
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' {ArrowLeft>7/}');
        expect(cell('2026-09-03')).toHaveFocus(); expect(changes(props)).toEqual([]);
        await user.keyboard(' ');
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-11')]);
        view.rerender(tree({...props, selection: range('2026-09-03', '2026-09-11')} as CalendarProps));
        await user.keyboard('{Escape}');
        expect(changes(props)).toHaveLength(1);
        expect(cell('2026-09-05')).toHaveAttribute('aria-selected', 'true');
    });
    it('Escape before the second Space sends nothing and announces the cancellation once', async () => {
        const user = userEvent.setup(), props = selecting();
        render(tree(props));
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' {ArrowLeft>3/}');
        live.read();
        await user.keyboard('{Escape}');
        expect(changes(props)).toEqual([]);
        expect(live.read()).toEqual(['polite: Selection cancelled']);
        expect(document.querySelector('[data-selection-draft]')).toBeNull();
        // Outside the draft, Space selects one day again.
        await user.keyboard(' ');
        expect(changes(props)).toEqual([range('2026-09-07', '2026-09-08')]);
    });
});

describe('the check pipeline in the Calendar (decision Q6)', () => {
    it('never checks the exclusive end; a range through a blocked date sends nothing, speaks urgently and keeps the draft', async () => {
        const user = userEvent.setup(), props = selecting({interactionPolicy: blockedOn('2026-09-04')});
        render(tree(props));
        await keys(user, '2026-09-03', ' ');
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-04')]);
        await user.click(button('Select range'));
        await keys(user, '2026-09-03', ' {ArrowRight}');
        live.read();
        await user.keyboard(' ');
        expect(changes(props)).toHaveLength(1);
        expect(live.read()).toEqual(['urgent: Action unavailable: Closed on 2026-09-04']);
        expect(cell('2026-09-03')).toHaveAttribute('data-selection-draft', 'true'); expect(cell('2026-09-04')).toHaveAttribute('data-selection-draft', 'true');
        // The mode line shows the reason of the blocked target.
        expect(document.querySelector('.nc-selection-line')).toHaveTextContent('Closed on 2026-09-04');
        // Corrected, the draft completes.
        await user.keyboard('{ArrowLeft} ');
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-04'), range('2026-09-03', '2026-09-04')]);
    });
    it.each([true, false])('an empty reason becomes genericBlockedReason with one development warning after commit (StrictMode %s)', async strict => {
        const user = userEvent.setup(), props = selecting({interactionPolicy: {canSelectDate: (date: string) => date === '2026-09-03' ? {allowed: false, reason: '  '} : true}});
        render(tree(props, strict));
        const expected = '[@nelmad/calendar] interactionPolicy.canSelectDate: Expected true or {allowed: false, reason: non-empty string}; treating the result as a denial';
        expect(warnings().filter(message => message === expected)).toHaveLength(1);
        expect(cell('2026-09-03')).toHaveAttribute('data-selection-unavailable', 'true');
        live.read();
        await keys(user, '2026-09-03', ' ');
        expect(changes(props)).toEqual([]);
        expect(live.read()).toEqual(['urgent: Action unavailable: Action unavailable']);
        expect(warnings().filter(message => message === expected)).toHaveLength(1);
    });
    it('the core boundary blocks Select day on 9999-12-31 with selectionBoundaryReason, whatever the policy says', async () => {
        const user = userEvent.setup(), canSelectDate = vi.fn((_date: string): PolicyResult => true), canSelectRange = vi.fn((_range: CalendarDateRange): PolicyResult => true);
        const props = selecting({layout: 'mobile', anchorDate: '9999-11-01', today: '9999-11-15', agendaDate: '9999-12-31', onAgendaDateChange() {},
            interactionPolicy: {canSelectDate, canSelectRange}});
        render(tree(props));
        const select = button('Select day');
        expect(select).toHaveAttribute('aria-disabled', 'true'); expect(select).toHaveAccessibleDescription('Selection is outside the supported date range');
        expect(within(select.parentElement!).getByText('Selection is outside the supported date range')).toBeVisible();
        live.read();
        await user.click(select); await user.click(select);
        // A blocked Select day stays focusable and keeps focus (decision Q1).
        expect(select).toHaveFocus(); expect(changes(props)).toEqual([]);
        expect(live.read()).toEqual(['urgent: Action unavailable: Selection is outside the supported date range', 'urgent: Action unavailable: Selection is outside the supported date range']);
        expect(canSelectDate.mock.calls.some(([date]) => date === '9999-12-31')).toBe(false); expect(canSelectRange).not.toHaveBeenCalled();
        // The grid of November 9999 never shows the date.
        expect(cell('9999-12-31')).toBeNull();
    });
});

describe('announcements (§ live announcements)', () => {
    it('entry speaks only the instruction; the first anchor one start and target payload; an unchanged target stays silent', async () => {
        const user = userEvent.setup(), props = selecting();
        render(tree(props));
        live.read();
        await user.click(button('Select range'));
        expect(live.read()).toEqual(['polite: Space or Enter sets the range start. Arrow keys choose the end. Space or Enter confirms. Escape cancels.']);
        // An ordinary focus move before an anchor is not announced: the focused cell's name says the date.
        await user.keyboard('{ArrowLeft}');
        expect(live.read()).toEqual([]);
        await user.keyboard(' ');
        expect(live.read()).toEqual(['polite: Selection starts on Sep 14, 2026 Range: Sep 14, 2026. Available']);
        await user.keyboard('{ArrowRight}');
        expect(live.read()).toEqual(['polite: Range: Sep 14, 2026 – Sep 15, 2026. Available']);
        // Home on a date already at the week start would change nothing: a repeat without a change is silent.
        await user.keyboard('{ArrowLeft}{ArrowRight}');
        expect(live.read()).toEqual(['polite: Range: Sep 14, 2026. Available', 'polite: Range: Sep 14, 2026 – Sep 15, 2026. Available']);
        await user.keyboard('{End}{End}');
        expect(live.read()).toEqual(['polite: Range: Sep 14, 2026 – Sep 19, 2026. Available']);
    });
    it('a blocked target says Unavailable; a held key repeats no block; a new attempt with the same reason speaks again', async () => {
        const user = userEvent.setup(), props = selecting({interactionPolicy: blockedOn('2026-09-16')});
        render(tree(props));
        await user.click(button('Select range'));
        await user.keyboard(' ');
        live.read();
        await user.keyboard('{ArrowRight}');
        expect(live.read()).toEqual(['polite: Range: Sep 15, 2026 – Sep 16, 2026. Unavailable']);
        // Focus landing on a blocked target is not an attempt; holding Space (its auto-repeat) is one attempt.
        fireEvent.keyDown(cell('2026-09-16'), {key: ' '});
        fireEvent.keyDown(cell('2026-09-16'), {key: ' ', repeat: true}); fireEvent.keyDown(cell('2026-09-16'), {key: ' ', repeat: true});
        fireEvent.keyUp(cell('2026-09-16'), {key: ' '});
        expect(live.read()).toEqual(['urgent: Action unavailable: Closed on 2026-09-16']);
        await user.keyboard(' ');
        expect(live.read()).toEqual(['urgent: Action unavailable: Closed on 2026-09-16']);
        expect(changes(props)).toEqual([]);
    });
    it('a policy change re-evaluates the current target and speaks once when its allowed state flips; nothing is sent', async () => {
        const user = userEvent.setup(), props = selecting();
        const view = render(tree(props));
        await user.click(button('Select range'));
        await user.keyboard(' {ArrowRight}');
        live.read();
        view.rerender(tree({...props, interactionPolicy: blockedOn('2026-09-16')} as CalendarProps));
        expect(live.read()).toEqual(['polite: Range: Sep 15, 2026 – Sep 16, 2026. Unavailable']);
        view.rerender(tree({...props, interactionPolicy: blockedOn('2026-09-16', '2026-09-30')} as CalendarProps));
        expect(live.read()).toEqual([]);
        expect(changes(props)).toEqual([]); expect(cell('2026-09-16')).toHaveAttribute('data-selection-draft', 'true');
    });
    it('two Calendars never speak for each other', async () => {
        const user = userEvent.setup(), first = selecting(), second = selecting();
        render(<StrictMode><CalendarMonth {...first}/><CalendarMonth {...second}/></StrictMode>);
        const [one, two] = [...document.querySelectorAll<HTMLElement>('.nc-calendar')];
        live.read();
        await user.click(within(one).getByRole('button', {name: 'Select range'}));
        expect(within(one).getByRole('status')).toHaveTextContent(/^Space or Enter sets the range start/);
        expect(within(two).getByRole('status')).toHaveTextContent('');
        expect(live.read()).toHaveLength(1);
        expect(two.querySelector('[data-selection-draft]')).toBeNull(); expect(within(two).getByRole('button', {name: 'Select range'})).not.toHaveAttribute('aria-disabled');
    });
});

describe('accepted selection, draft and pending acceptance are separate', () => {
    it('speaks the completion only once props first equal the request, never at callback time; StrictMode and remounts never fake one', async () => {
        const user = userEvent.setup(), props = selecting();
        const view = render(tree(props));
        await keys(user, '2026-09-03', ' ');
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-04')]);
        expect(live.read()).toEqual([]);
        // Displayed selection follows props only.
        expect(cell('2026-09-03')).toHaveAttribute('aria-selected', 'false'); expect(cell('2026-09-03')).not.toHaveAttribute('data-selected');
        view.rerender(tree({...props, items: []} as CalendarProps));
        expect(live.read()).toEqual([]);
        view.rerender(tree({...props, selection: {start: '2026-09-03', end: '2026-09-04'}} as CalendarProps));
        expect(live.read()).toEqual(['polite: Selected range: Sep 3, 2026']);
        expect(cell('2026-09-03')).toHaveAttribute('aria-selected', 'true');
        view.rerender(tree({...props, selection: {start: '2026-09-03', end: '2026-09-04'}, items: []} as CalendarProps));
        expect(live.read()).toEqual([]);
        // A remount starts without a pending acceptance.
        view.unmount();
        render(tree({...props, selection: range('2026-09-03', '2026-09-04')} as CalendarProps));
        expect(live.read()).toEqual([]);
    });
    it('a request never accepted produces no announcement; a newer request or an external value drops the older one', async () => {
        const user = userEvent.setup(), props = selecting();
        const view = render(tree(props));
        await keys(user, '2026-09-03', ' ');
        await keys(user, '2026-09-10', ' ');
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-04'), range('2026-09-10', '2026-09-11')]);
        // The older request A is external after the newer B.
        view.rerender(tree({...props, selection: range('2026-09-03', '2026-09-04')} as CalendarProps));
        expect(live.read()).toEqual([]);
        await keys(user, '2026-09-12', ' ');
        view.rerender(tree({...props, selection: range('2026-09-20', '2026-09-21')} as CalendarProps));
        view.rerender(tree({...props, selection: range('2026-09-12', '2026-09-13')} as CalendarProps));
        expect(live.read()).toEqual([]);
    });
    it('Clear selection speaks after acceptance, keeps focus on itself and is then unavailable; an initial or external null says nothing', async () => {
        const user = userEvent.setup(), props = selecting({selection: range('2026-09-03', '2026-09-05')});
        const view = render(tree(props));
        const clear = button('Clear selection');
        expect(clear).not.toHaveAttribute('aria-disabled');
        await user.click(clear);
        expect(changes(props)).toEqual([null]); expect(live.read()).toEqual([]);
        view.rerender(tree({...props, selection: null} as CalendarProps));
        expect(live.read()).toEqual(['polite: Selection cleared']);
        expect(clear).toHaveFocus(); expect(clear).toHaveAttribute('aria-disabled', 'true');
        // Clearing an empty selection is a no-op.
        await user.click(clear);
        expect(changes(props)).toEqual([null]);
        view.rerender(tree({...props, selection: range('2026-09-07', '2026-09-08')} as CalendarProps));
        view.rerender(tree({...props, selection: null} as CalendarProps));
        expect(live.read()).toEqual([]);
    });
    it('no-ops: the accepted range from Space, Select day or range mode, and an empty Clear send nothing and say nothing', async () => {
        const user = userEvent.setup(), props = selecting({selection: range('2026-09-03', '2026-09-04')});
        render(tree(props));
        live.read();
        await keys(user, '2026-09-03', ' ');
        await user.click(button('Select range'));
        expect(live.read()).toHaveLength(1);
        await keys(user, '2026-09-03', '  ');
        expect(changes(props)).toEqual([]);
        // The second Space closes the draft and removes the instruction silently.
        expect(live.read()).toEqual(['polite: Selection starts on Sep 3, 2026 Range: Sep 3, 2026. Available']);
        expect(document.querySelector('.nc-selection-line')).toBeNull();
        expect(screen.getByRole('grid')).not.toHaveAccessibleDescription(/range start/);
    });
    it('accepting an older request during a new draft keeps the draft and speaks the completion once (decision Q8)', async () => {
        const user = userEvent.setup(), props = selecting();
        const view = render(tree(props));
        await keys(user, '2026-09-03', ' ');
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' {ArrowRight}');
        live.read();
        view.rerender(tree({...props, selection: range('2026-09-03', '2026-09-04')} as CalendarProps));
        expect(live.read()).toEqual(['polite: Selected range: Sep 3, 2026']);
        expect(cell('2026-09-11')).toHaveAttribute('data-selection-draft', 'true');
        await user.keyboard(' ');
        expect(changes(props)).toEqual([range('2026-09-03', '2026-09-04'), range('2026-09-10', '2026-09-12')]);
    });
});

describe('what cancels a draft', () => {
    const draft = () => document.querySelectorAll('[data-selection-draft]').length;
    async function open(props: CalendarProps) {
        const user = userEvent.setup(), view = render(tree(props));
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' {ArrowRight}');
        expect(draft()).toBe(2);
        live.read();
        return {user, view};
    }
    it('an external selection change cancels silently and keeps the new accepted value', async () => {
        const props = selecting(), {user, view} = await open(props);
        view.rerender(tree({...props, selection: range('2026-09-20', '2026-09-22')} as CalendarProps));
        expect(draft()).toBe(0); expect(live.read()).toEqual([]);
        expect(cell('2026-09-21')).toHaveAttribute('aria-selected', 'true');
        await user.keyboard(' ');
        expect(changes(props)).toEqual([range('2026-09-11', '2026-09-12')]);
    });
    it('a parent re-render with a new object of the same dates is no change', async () => {
        const props = selecting({selection: range('2026-09-20', '2026-09-22')}), {view} = await open(props);
        view.rerender(tree({...props, selection: range('2026-09-20', '2026-09-22')} as CalendarProps));
        expect(draft()).toBe(2);
    });
    it('removing the pair switches to viewer at once; re-adding it accepts only the new value and resumes nothing', async () => {
        const props = selecting({selection: range('2026-09-20', '2026-09-22')}), {view} = await open(props);
        const {selection: _selection, onSelectionChange: _change, ...viewer} = props as CalendarProps & {selection: unknown; onSelectionChange: unknown};
        view.rerender(tree(viewer as CalendarProps));
        expect(draft()).toBe(0); expect(screen.getByRole('grid')).not.toHaveAttribute('aria-multiselectable');
        expect(cell('2026-09-21')).not.toHaveAttribute('aria-selected'); expect(screen.queryByRole('button', {name: 'Select range'})).toBeNull();
        view.rerender(tree({...props, selection: range('2026-09-24', '2026-09-25')} as CalendarProps));
        expect(draft()).toBe(0); expect(cell('2026-09-24')).toHaveAttribute('aria-selected', 'true');
        expect(live.read()).toEqual([]); expect(changes(props)).toEqual([]);
    });
    it.each([
        ['loading/initial', {dataState: {status: 'loading', phase: 'initial'}}],
        ['error/initial', {dataState: {status: 'error', phase: 'initial', error: 1}}],
        ['a contract error', {timeZone: 'Mars/Olympus'}],
    ])('%s cancels silently, drops the pending acceptance and resumes nothing', async (_label, blocking) => {
        const props = selecting({selection: range('2026-09-20', '2026-09-22')}), {view} = await open(props);
        view.rerender(tree({...props, ...blocking} as CalendarProps));
        expect(screen.queryByRole('grid')).toBeNull();
        view.rerender(tree(props));
        expect(draft()).toBe(0); expect(document.querySelector('.nc-selection-line')).toBeNull();
        expect(cell('2026-09-21')).toHaveAttribute('aria-selected', 'true');
        expect(live.read().filter(entry => /Selection|Range/.test(entry))).toEqual([]);
    });
    it('a blocking state between a request and its acceptance drops the completion speech (decision Q9)', async () => {
        const user = userEvent.setup(), props = selecting();
        const view = render(tree(props));
        await keys(user, '2026-09-03', ' ');
        view.rerender(tree({...props, selection: range('2026-09-03', '2026-09-04'), dataState: {status: 'loading', phase: 'initial'}} as CalendarProps));
        view.rerender(tree({...props, selection: range('2026-09-03', '2026-09-04')} as CalendarProps));
        expect(live.read().filter(entry => entry.includes('Selected'))).toEqual([]);
    });
    it.each([
        ['loading/refresh', {dataState: {status: 'loading', phase: 'refresh'}}],
        ['error/refresh', {dataState: {status: 'error', phase: 'refresh', error: 1}}],
        ['new items, a layout-independent prop and messages', {items: [{id: 'x', title: 'X', data: {}, interval: {kind: 'allDay', start: '2026-09-12', end: '2026-09-13'}}], messages: {todayLabel: 'Now'}}],
    ])('%s keeps the draft (decision Q16)', async (_label, change) => {
        const props = selecting(), {user, view} = await open(props);
        view.rerender(tree({...props, ...change} as CalendarProps));
        expect(draft()).toBe(2);
        await user.keyboard(' ');
        expect(changes(props)).toEqual([range('2026-09-10', '2026-09-12')]);
    });
    it('focus leaving the grid and the Calendar keeps the draft; Tab back in moves the endpoint', async () => {
        const user = userEvent.setup(), props = selecting();
        render(<StrictMode><CalendarMonth {...props}/><button>After</button></StrictMode>);
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' {ArrowRight}');
        await user.click(button('After'));
        expect(draft()).toBe(2);
        await user.click(cell('2026-09-14'));
        expect(changes(props)).toEqual([range('2026-09-10', '2026-09-15')]);
    });
    it('an external month change cancels silently; a matching toolbar acceptance keeps the draft', async () => {
        const props = selecting(), {user, view} = await open(props);
        await user.click(button('Next month'));
        expect(props.onNavigate).toBeDefined();
        view.rerender(tree({...props, anchorDate: '2026-10-01'} as CalendarProps));
        expect(document.querySelectorAll('.nc-selection-line')).toHaveLength(1);
        view.rerender(tree({...props, anchorDate: '2026-12-01'} as CalendarProps));
        expect(document.querySelector('.nc-selection-line')).toBeNull(); expect(live.read().filter(entry => entry.includes('cancelled'))).toEqual([]);
    });
});

describe('ranges across months', () => {
    it.each([['en-US', undefined], ['en-US', 'rtl'], ['ar', undefined]] as const)('%s %s: a delayed PageDown keeps the endpoint until acceptance, then follows the clamped focus', async (locale, dir) => {
        const user = userEvent.setup(), onNavigate = vi.fn(), props = selecting({anchorDate: '2026-01-01', today: '2026-01-15', locale, ...(dir ? {dir} : {}), onNavigate});
        const view = render(tree(props));
        await user.click(button('Select range'));
        await keys(user, '2026-01-20', ' ');
        act(() => cell('2026-01-31').focus());
        await user.keyboard('{PageDown}');
        expect(onNavigate).toHaveBeenCalledExactlyOnceWith('2026-02-01');
        expect(cell('2026-01-31')).toHaveFocus();
        expect(cell('2026-01-31')).toHaveAttribute('data-selection-draft', 'true'); expect(document.querySelectorAll('[data-selection-draft]')).toHaveLength(12);
        view.rerender(tree({...props, anchorDate: '2026-02-01'} as CalendarProps));
        expect(cell('2026-02-28')).toHaveFocus();
        expect(cell('2026-02-28')).toHaveAttribute('data-selection-draft', 'true');
        expect([...document.querySelectorAll<HTMLElement>('[data-selection-draft]')].every(node => node.dataset.date! <= '2026-02-28')).toBe(true);
        await user.keyboard(' ');
        expect(changes(props)).toEqual([range('2026-01-20', '2026-03-01')]);
    });
    it('Tab away before acceptance: the late acceptance takes no focus and cancels the draft silently (decision Q7)', async () => {
        const user = userEvent.setup(), onNavigate = vi.fn(), props = selecting({anchorDate: '2026-01-01', today: '2026-01-15', onNavigate});
        const view = render(<StrictMode><CalendarMonth {...props}/><button>After</button></StrictMode>);
        await user.click(button('Select range'));
        await keys(user, '2026-01-20', ' ');
        act(() => cell('2026-01-31').focus());
        await user.keyboard('{PageDown}');
        await user.tab();
        expect(button('After')).toHaveFocus();
        live.read();
        view.rerender(<StrictMode><CalendarMonth {...props} anchorDate="2026-02-01"/><button>After</button></StrictMode>);
        expect(button('After')).toHaveFocus();
        expect(document.querySelector('.nc-selection-line')).toBeNull(); expect(live.read().filter(entry => entry.includes('cancelled'))).toEqual([]);
    });
});

describe('selection never blocks viewing', () => {
    it('a blocked date is focusable, has no aria-disabled and opens its agenda with Enter and a click', async () => {
        const user = userEvent.setup(), props = selecting({interactionPolicy: blockedOn('2026-09-10'), items: [{id: 'a', title: 'Alpha', data: {}, interval: {kind: 'allDay', start: '2026-09-10', end: '2026-09-11'}}]});
        render(tree(props));
        const blocked = cell('2026-09-10');
        expect(blocked).not.toHaveAttribute('aria-disabled'); expect(blocked).toHaveAttribute('data-selection-unavailable', 'true');
        expect(blocked).toHaveAccessibleDescription(/Unavailable/); expect(blocked).not.toHaveAccessibleDescription(/Closed/);
        await keys(user, '2026-09-10', '{Enter}');
        expect(screen.getByRole('dialog')).toHaveTextContent('Alpha');
        await user.keyboard('{Escape}');
        await user.click(blocked);
        expect(screen.getByRole('dialog')).toHaveTextContent('Alpha');
        expect(changes(props)).toEqual([]);
    });
    it('selection and agenda date are independent; a controlled agenda change that is delayed or rejected opens no wrong day', async () => {
        const user = userEvent.setup(), onAgendaDateChange = vi.fn();
        const props = selecting({selection: range('2026-09-03', '2026-09-04'), interactionPolicy: blockedOn('2026-09-10'), layout: 'mobile', agendaDate: '2026-09-03', onAgendaDateChange});
        const view = render(tree(props));
        await user.click(cell('2026-09-10'));
        expect(onAgendaDateChange).toHaveBeenCalledExactlyOnceWith('2026-09-10');
        expect(screen.getByRole('region', {name: /Sep 3, 2026/})).toBeInTheDocument();
        view.rerender(tree({...props, agendaDate: '2026-09-10'} as CalendarProps));
        expect(screen.getByRole('region', {name: /Sep 10, 2026/})).toBeInTheDocument();
        expect(cell('2026-09-03')).toHaveAttribute('aria-selected', 'true'); expect(changes(props)).toEqual([]);
        // Select day is blocked for the 10th and says why.
        expect(button('Select day')).toHaveAttribute('aria-disabled', 'true'); expect(button('Select day')).toHaveAccessibleDescription('Closed on 2026-09-10');
    });
    it('a viewer calendar without the pair works as before', async () => {
        const user = userEvent.setup(), props = base();
        render(tree(props));
        expect(screen.getByRole('grid')).not.toHaveAttribute('aria-multiselectable'); expect(cell('2026-09-10')).not.toHaveAttribute('aria-selected');
        expect(screen.queryByRole('button', {name: /Select|Clear|Create/})).toBeNull();
        await keys(user, '2026-09-10', ' ');
        expect(document.querySelector('[data-selection-draft], [data-selection-unavailable], .nc-selection-line')).toBeNull();
    });
});

describe('Create (decision Q13)', () => {
    const create = () => screen.queryByRole('button', {name: 'Create event'});
    it('is present only with onCreateRequest', () => {
        const view = render(tree(selecting()));
        expect(create()).toBeNull();
        view.rerender(tree(selecting({onCreateRequest: vi.fn()})));
        expect(create()).toBeInTheDocument();
    });
    it('is unavailable and focusable, and sends nothing silently, without a selection, during a draft and while blocking', async () => {
        const user = userEvent.setup(), onCreateRequest = vi.fn(), props = selecting({onCreateRequest});
        const view = render(tree(props));
        expect(create()).toHaveAttribute('aria-disabled', 'true'); expect(create()).not.toBeDisabled();
        live.read();
        await user.click(create()!);
        act(() => create()!.focus()); expect(create()).toHaveFocus();
        view.rerender(tree({...props, selection: range('2026-09-03', '2026-09-05')} as CalendarProps));
        expect(create()).not.toHaveAttribute('aria-disabled');
        await user.click(button('Select range'));
        expect(create()).toHaveAttribute('aria-disabled', 'true');
        await user.click(create()!);
        await user.keyboard('{Escape}');
        view.rerender(tree({...props, selection: range('2026-09-03', '2026-09-05'), dataState: {status: 'loading', phase: 'initial'}} as CalendarProps));
        expect(create()).toHaveAttribute('aria-disabled', 'true'); expect(button('Select range')).toHaveAttribute('aria-disabled', 'true');
        expect(button('Clear selection')).toHaveAttribute('aria-disabled', 'true');
        await user.click(create()!);
        expect(onCreateRequest).not.toHaveBeenCalled();
        expect(live.read().filter(entry => entry.startsWith('urgent'))).toEqual([]);
    });
    it('calls once with a fresh copy of the accepted range, also while a newer request waits for props', async () => {
        const user = userEvent.setup(), onCreateRequest = vi.fn(), accepted = range('2026-09-03', '2026-09-05'), props = selecting({onCreateRequest, selection: accepted});
        render(tree(props));
        await keys(user, '2026-09-20', ' ');
        expect(changes(props)).toEqual([range('2026-09-20', '2026-09-21')]);
        await user.click(create()!);
        expect(onCreateRequest).toHaveBeenCalledExactlyOnceWith(accepted);
        expect(onCreateRequest.mock.calls[0][0]).not.toBe(accepted);
    });
    it('a policy block makes it unavailable with its reason in the mode line; each press speaks the reason urgently', async () => {
        const user = userEvent.setup(), onCreateRequest = vi.fn();
        render(tree(selecting({onCreateRequest, selection: range('2026-09-03', '2026-09-05'), interactionPolicy: {canSelectRange: () => ({allowed: false, reason: 'Fully booked'})}})));
        expect(create()).toHaveAttribute('aria-disabled', 'true'); expect(create()).toHaveAccessibleDescription('Fully booked');
        expect(document.querySelector('.nc-selection-line')).toHaveTextContent('Fully booked');
        live.read();
        await user.click(create()!); await user.click(create()!);
        expect(live.read()).toEqual(['urgent: Action unavailable: Fully booked', 'urgent: Action unavailable: Fully booked']);
        expect(onCreateRequest).not.toHaveBeenCalled();
    });
    it('a last-moment block with the latest props sends nothing, speaks urgently and shows the reason', async () => {
        const user = userEvent.setup(), onCreateRequest = vi.fn();
        let closed = false;
        render(tree(selecting({onCreateRequest, selection: range('2026-09-03', '2026-09-05'), interactionPolicy: {canSelectRange: () => closed ? {allowed: false, reason: 'Just closed'} : true}})));
        expect(create()).not.toHaveAttribute('aria-disabled');
        closed = true;
        live.read();
        await user.click(create()!);
        expect(onCreateRequest).not.toHaveBeenCalled();
        expect(live.read()).toEqual(['urgent: Action unavailable: Just closed']);
        expect(document.querySelector('.nc-selection-line')).toHaveTextContent('Just closed');
    });
    it('works in an empty ready month: select a date, then Create the first item', async () => {
        const user = userEvent.setup(), onCreateRequest = vi.fn(), props = selecting({onCreateRequest});
        const view = render(tree(props));
        expect(screen.getByRole('region', {name: 'No events in this month'})).toBeInTheDocument();
        await keys(user, '2026-09-08', ' ');
        view.rerender(tree({...props, selection: changes(props)[0]} as CalendarProps));
        await user.click(create()!);
        expect(onCreateRequest).toHaveBeenCalledExactlyOnceWith(range('2026-09-08', '2026-09-09'));
    });
});

describe('commands and focus', () => {
    it('Select range closes the agenda popover and focuses its date cell; a second Select range does nothing', async () => {
        const user = userEvent.setup(), props = selecting({items: [{id: 'a', title: 'Alpha', data: {}, interval: {kind: 'allDay', start: '2026-09-10', end: '2026-09-11'}}]});
        render(tree(props));
        await user.click(cell('2026-09-10'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        live.read();
        await user.click(button('Select range'));
        expect(screen.queryByRole('dialog')).toBeNull(); expect(cell('2026-09-10')).toHaveFocus();
        expect(live.read()).toEqual(['polite: Space or Enter sets the range start. Arrow keys choose the end. Space or Enter confirms. Escape cancels.']);
        expect(button('Select range')).toHaveAttribute('aria-disabled', 'true');
        await user.click(button('Select range'));
        expect(live.read()).toEqual([]);
    });
    it('Select range closes the open source selector and uses the roving cell for an agenda date outside the grid', async () => {
        const user = userEvent.setup(), props = selecting({sources: [{id: 'w', title: 'Work'}, {id: 'h', title: 'Home'}], visibleSourceIds: ['w', 'h'], onVisibleSourceIdsChange() {},
            agendaDate: '2026-12-24', onAgendaDateChange() {}});
        render(tree(props));
        await user.click(button('Calendars'));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        await user.click(button('Select range'));
        expect(screen.queryByRole('menu')).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole('grid').querySelector('[role=gridcell][tabindex="0"]'));
        expect(document.activeElement).toHaveAttribute('data-date', '2026-09-15');
    });
    it('Escape on the package toolbar buttons and the mode line cancels the draft; consumer toolbar content is left alone', async () => {
        const user = userEvent.setup(), props = selecting({renderToolbarContent: () => <button>Consumer</button>});
        render(tree(props));
        await user.click(button('Select range'));
        act(() => button('Consumer').focus()); await user.keyboard('{Escape}');
        expect(document.querySelector('.nc-selection-line')).not.toBeNull();
        act(() => button('Today').focus()); live.read(); await user.keyboard('{Escape}');
        expect(document.querySelector('.nc-selection-line')).toBeNull(); expect(button('Today')).toHaveFocus();
        expect(live.read()).toEqual(['polite: Selection cancelled']);
        await user.click(button('Select range'));
        act(() => button('Cancel').focus()); await user.keyboard('{Escape}');
        expect(document.querySelector('.nc-selection-line')).toBeNull(); expect(cell('2026-09-15')).toHaveFocus();
    });
    it('Cancel in the mode line cancels with its speech; its focus recovers to the roving date cell', async () => {
        const user = userEvent.setup(), props = selecting();
        render(tree(props));
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' {ArrowRight}');
        live.read();
        await user.click(button('Cancel'));
        expect(live.read()).toEqual(['polite: Selection cancelled']);
        expect(document.querySelector('.nc-selection-line')).toBeNull(); expect(cell('2026-09-11')).toHaveFocus();
        expect(changes(props)).toEqual([]);
    });
    it('in the inline agenda the first Escape only returns focus to the cell; the endpoint follows with one target', async () => {
        const user = userEvent.setup(), props = selecting({layout: 'mobile'});
        render(tree(props));
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' ');
        act(() => button('Select day').focus());
        live.read();
        await user.keyboard('{Escape}');
        expect(cell('2026-09-15')).toHaveFocus(); expect(document.querySelector('.nc-selection-line')).not.toBeNull();
        expect(live.read()).toEqual(['polite: Range: Sep 10, 2026 – Sep 15, 2026. Available']);
        await user.keyboard('{Escape}');
        expect(document.querySelector('.nc-selection-line')).toBeNull();
    });
    it('in range mode a press on an item segment is a tap on its date: no onItemPress, no agenda (decision Q11)', async () => {
        // jsdom has no layout: the measured Month boxes are given, so the desktop grid renders lanes (as in slots.test.tsx).
        const sizes: Record<string, Record<string, string>> = {'nc-month-week': {height: '120px', width: '700px'}, 'nc-day-header': {height: '32px'},
            'nc-month-item-probe': {height: '24px', marginBottom: '4px'}, 'nc-month-overflow-probe': {height: '24px'}};
        const original = window.getComputedStyle.bind(window);
        vi.spyOn(window, 'getComputedStyle').mockImplementation((node, pseudo) => {
            const style = original(node, pseudo), size = [...node.classList].map(name => sizes[name]).find(Boolean);
            return new Proxy(style, {get: (target, name) => size && typeof name === 'string' && name in size ? size[name]
                : typeof Reflect.get(target, name) === 'function' ? (Reflect.get(target, name) as (...args: unknown[]) => unknown).bind(target) : Reflect.get(target, name)});
        });
        const user = userEvent.setup(), onItemPress = vi.fn();
        const props = selecting({onItemPress, items: [{id: 'a', title: 'Alpha', data: {}, interval: {kind: 'allDay', start: '2026-09-07', end: '2026-09-12'}}]});
        render(tree(props));
        const segment = document.querySelector<HTMLElement>('.nc-month-item[data-item-id="a"]')!;
        expect(segment).not.toBeNull();
        // The hit test reads the date columns of the segment's week from their rectangles: 100 px per column.
        [...segment.closest('.nc-month-week')!.querySelectorAll<HTMLElement>('[role=gridcell]')].forEach((node, index) =>
            vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({left: index * 100, right: index * 100 + 100, top: 0, bottom: 100, width: 100, height: 100, x: index * 100, y: 0, toJSON() {}} as DOMRect));
        // Outside range mode a segment press is the item press.
        await user.pointer({keys: '[MouseLeft]', target: segment, coords: {clientX: 150}});
        expect(onItemPress).toHaveBeenCalledTimes(1);
        await user.click(button('Select range'));
        await user.pointer({keys: '[MouseLeft]', target: segment, coords: {clientX: 150}});
        await user.pointer({keys: '[MouseLeft]', target: segment, coords: {clientX: 450}});
        expect(onItemPress).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).toBeNull();
        expect(changes(props)).toEqual([range('2026-09-07', '2026-09-11')]);
    });
});

describe('Select day in the agenda (decisions Q3, Q10)', () => {
    it('never closes the popover; focus stays on it; selected rows change only with props', async () => {
        const user = userEvent.setup(), props = selecting({items: [{id: 'a', title: 'Alpha', data: {}, interval: {kind: 'allDay', start: '2026-09-10', end: '2026-09-11'}}]});
        const view = render(tree(props));
        await user.click(cell('2026-09-10'));
        await user.click(button('Select day'));
        expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(button('Select day')).toHaveFocus();
        expect(changes(props)).toEqual([range('2026-09-10', '2026-09-11')]);
        expect(screen.getByRole('listitem')).not.toHaveAttribute('data-selected');
        view.rerender(tree({...props, selection: range('2026-09-10', '2026-09-11')} as CalendarProps));
        expect(screen.getByRole('listitem')).toHaveAttribute('data-selected', 'true');
        expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(button('Select day')).toHaveFocus();
        // A no-op is silent.
        live.read(); await user.click(button('Select day'));
        expect(changes(props)).toHaveLength(1); expect(live.read()).toEqual([]);
    });
    it('in a modal sheet the completion speaks inside the sheet; the root channel stays silent', async () => {
        const user = userEvent.setup(), props = selecting({layout: 'mobile', agendaPresentation: 'overlay'});
        const view = render(tree(props));
        await user.click(cell('2026-09-10'));
        const sheet = screen.getByRole('dialog');
        await user.click(within(sheet).getByRole('button', {name: 'Select day'}));
        view.rerender(tree({...props, selection: range('2026-09-10', '2026-09-11')} as CalendarProps));
        expect(within(sheet).getByRole('status')).toHaveTextContent('Selected range: Sep 10, 2026');
        expect(document.querySelector('.nc-calendar > [role=status]')).toHaveTextContent('');
        expect(within(sheet).getByRole('button', {name: 'Select day'})).toHaveFocus();
    });
    it('is unavailable and silent during a draft', async () => {
        const user = userEvent.setup(), props = selecting({layout: 'mobile'});
        render(tree(props));
        await user.click(button('Select range'));
        expect(button('Select day')).toHaveAttribute('aria-disabled', 'true');
        live.read(); await user.click(button('Select day'));
        expect(changes(props)).toEqual([]); expect(live.read()).toEqual([]);
    });
    it('keeps its focus across a presentation switch', async () => {
        const user = userEvent.setup(), props = selecting({layout: 'mobile', agendaPresentation: 'overlay'});
        const view = render(tree(props));
        await user.click(cell('2026-09-10'));
        act(() => within(screen.getByRole('dialog')).getByRole('button', {name: 'Select day'}).focus());
        view.rerender(tree({...props, agendaPresentation: 'auto'} as CalendarProps));
        await act(async () => {});
        expect(button('Select day')).toHaveFocus();
    });
});

describe('grid description and day state', () => {
    it('gains the range instruction in range mode and loses it on exit', async () => {
        const user = userEvent.setup();
        render(tree(selecting()));
        const grid = screen.getByRole('grid'), normal = 'Use arrow keys to navigate dates. Enter opens day events. Page Up and Page Down change the month.';
        expect(grid).toHaveAccessibleDescription(normal);
        await user.click(button('Select range'));
        expect(grid).toHaveAccessibleDescription(`${normal} Space or Enter sets the range start. Arrow keys choose the end. Space or Enter confirms. Escape cancels.`);
        await user.keyboard('{Escape}');
        expect(grid).toHaveAccessibleDescription(normal);
    });
    it('passes draft and unavailable states to renderDayHeader and classNames.day, and marks draft cells', async () => {
        const user = userEvent.setup(), header = vi.fn((_state: CalendarDayState) => null), day = vi.fn((_state: CalendarDayState) => 'custom');
        render(tree(selecting({interactionPolicy: blockedOn('2026-09-12'), renderDayHeader: header, classNames: {day}})));
        expect(header).toHaveBeenCalledWith(expect.objectContaining({date: '2026-09-12', isSelectionUnavailable: true, unavailableReason: 'Closed on 2026-09-12', isSelectionDraft: false}));
        expect(header).toHaveBeenCalledWith(expect.objectContaining({date: '2026-09-11', isSelectionUnavailable: false, isSelectionDraft: false}));
        expect(header.mock.calls.find(([state]) => state.date === '2026-09-11')![0]).not.toHaveProperty('unavailableReason');
        await user.click(button('Select range'));
        await keys(user, '2026-09-10', ' {ArrowRight}{ArrowRight}');
        expect(day).toHaveBeenCalledWith(expect.objectContaining({date: '2026-09-12', isSelectionDraft: true, isSelectionUnavailable: true}));
        expect(cell('2026-09-12')).toHaveClass('custom');
        const states = header.mock.calls.slice(-35).map(([state]) => state).filter(state => state.isSelectionDraft).map(state => state.date);
        expect(states).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
        expect(cell('2026-09-12')).toHaveAttribute('data-selection-unavailable', 'true'); expect(cell('2026-09-12')).toHaveAttribute('data-selection-draft', 'true');
        // During the draft the blocked date's reason joins its description; the draft never sets aria-selected.
        expect(cell('2026-09-12')).toHaveAccessibleDescription(/Unavailable Closed on 2026-09-12/);
        expect(cell('2026-09-11')).toHaveAttribute('aria-selected', 'false');
        expect(cell('2026-09-12')).not.toHaveAttribute('aria-disabled');
    });
    it('keeps the initial roving order: selection.start decides only when a controlled agenda date is outside the grid', () => {
        const view = render(tree(selecting({selection: range('2026-09-20', '2026-09-22'), agendaDate: '2026-12-01', onAgendaDateChange() {}})));
        expect(screen.getByRole('grid').querySelector('[tabindex="0"]')).toHaveAttribute('data-date', '2026-09-20');
        view.unmount();
        render(tree(selecting({selection: range('2026-09-20', '2026-09-22'), agendaDate: '2026-09-05', onAgendaDateChange() {}})));
        expect(screen.getByRole('grid').querySelector('[tabindex="0"]')).toHaveAttribute('data-date', '2026-09-05');
    });
});

describe('SSR and hydration', () => {
    const items = [{id: 'a', title: 'Alpha', data: {}, interval: {kind: 'allDay', start: '2026-09-03', end: '2026-09-05'}}];
    it.each([
        ['viewer', {}, false],
        ['nothing selected', {selection: null, onSelectionChange() {}}, false],
        ['a selection with Create', {selection: range('2026-09-03', '2026-09-05'), onSelectionChange() {}, onCreateRequest() {}}, false],
        ['a policy without the pair', {interactionPolicy: blockedOn('2026-09-10')}, false],
        ['a policy, Create blocked by it', {selection: range('2026-09-03', '2026-09-05'), onSelectionChange() {}, onCreateRequest() {},
            interactionPolicy: {...blockedOn('2026-09-10'), canSelectRange: () => ({allowed: false, reason: 'Booked'})}}, true],
        ['a malformed policy result', {selection: null, onSelectionChange() {}, interactionPolicy: {canSelectDate: () => ({allowed: false, reason: ''})}}, true],
    ] as const)('%s: the server markup hydrates without errors in every layout, and no callback or warning runs on the server', async (_label, extra, marked) => {
        for (const layout of ['mobile', 'desktop'] as const) {
            warn.mockClear();
            const onSelectionChange = vi.fn(), onCreateRequest = vi.fn();
            const input = () => base({items, layout, agendaDate: '2026-09-10', onAgendaDateChange() {}, ...extra,
                ...('onSelectionChange' in extra ? {onSelectionChange} : {}), ...('onCreateRequest' in extra ? {onCreateRequest} : {})});
            const html = renderToString(<StrictMode><CalendarMonth {...input()}/></StrictMode>);
            expect(renderToString(<StrictMode><CalendarMonth {...input()}/></StrictMode>)).toBe(html);
            expect(warnings()).toEqual([]);
            const server = document.createElement('div'); server.innerHTML = html;
            // Decision Q4: the server marks dates that canSelectDate blocks while the pair is present.
            expect(server.querySelector('[data-date="2026-09-10"][role=gridcell]')!.hasAttribute('data-selection-unavailable')).toBe(marked);
            expect(server.querySelectorAll('[data-selection-draft]')).toHaveLength(0);
            const errors: unknown[] = [], logged = vi.spyOn(console, 'error').mockImplementation(value => { errors.push(value); });
            const container = document.createElement('div'); container.innerHTML = html; document.body.append(container);
            let root: ReturnType<typeof hydrateRoot> | undefined;
            await act(async () => { root = hydrateRoot(container, <StrictMode><CalendarMonth {...input()}/></StrictMode>, {onRecoverableError: error => errors.push(error)}); });
            try {
                // React 18 logs its documented useLayoutEffect SSR notice only on the server; hydration itself must be clean.
                expect(errors.filter(error => !String(error).includes('useLayoutEffect does nothing on the server'))).toEqual([]);
                expect(onSelectionChange).not.toHaveBeenCalled(); expect(onCreateRequest).not.toHaveBeenCalled();
            } finally { await act(async () => root!.unmount()); container.remove(); logged.mockRestore(); }
        }
    });
    it('a malformed result marks every date and warns once after the hydration commit', async () => {
        const input = () => base({items, layout: 'desktop', selection: null, onSelectionChange() {}, interactionPolicy: {canSelectDate: () => ({allowed: false, reason: ''})}});
        const html = renderToString(<CalendarMonth {...input()}/>);
        expect(warnings()).toEqual([]);
        expect(html.match(/data-selection-unavailable="true"/g)).toHaveLength(35);
        const container = document.createElement('div'); container.innerHTML = html; document.body.append(container);
        let root: ReturnType<typeof hydrateRoot> | undefined;
        await act(async () => { root = hydrateRoot(container, <StrictMode><CalendarMonth {...input()}/></StrictMode>); });
        try {
            expect(warnings().filter(message => message.includes('interactionPolicy.canSelectDate'))).toHaveLength(1);
        } finally { await act(async () => root!.unmount()); container.remove(); }
    });
});
