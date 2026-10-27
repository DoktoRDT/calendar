// @vitest-environment node
import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import type {CalendarInteractionPolicy, CalendarInterval, CalendarItem, CalendarTheme, CalendarWeekday} from '../../reference.js';
import {isBlocking} from '../controller.js';
import {addCalendarDays, createDateAdapter, parseRFC3339, type WallTime} from '../date.js';
import {getCalendarVisibleRange} from '../formatting.js';
import {
    evaluateMoveTarget, formatUtcOffset, isInSupportedMonthGrid, moveOriginDate, reconcileMoveDraft, startMoveDraft,
    type MoveCancelReason, type MoveCommit, type MoveOrigin, type MoveTarget,
} from '../move.js';
import {validateCalendarInput, type ValidatedItem} from '../validation.js';

// Explicit fixture set, not the package accepted-set or a host-derived list (as in date.test.ts).
const zones = new Set(['UTC', 'Europe/Moscow', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo', 'Pacific/Apia', 'Europe/Paris', 'Africa/Monrovia']);
const dates = createDateAdapter(zones);
const services = {dates, isTheme: (_: unknown): _ is CalendarTheme => false};
const malformed = 'Expected true or {allowed: false, reason: non-empty string}; treating the result as a denial';

/** Item `data` that the move core must never read: every trap throws. Validation never reads it either. */
const sealed = () => new Proxy({}, Object.fromEntries(['get', 'set', 'has', 'ownKeys', 'getOwnPropertyDescriptor', 'defineProperty', 'deleteProperty',
    'getPrototypeOf', 'setPrototypeOf', 'isExtensible', 'preventExtensions'].map(trap => [trap, () => { throw new Error(`data was read (${trap})`); }])));
const cyclic = () => {
    const data: {self?: unknown; label: string} = {label: 'cyclic'};
    data.self = data;
    return data;
};
const allDay = (start: string, end: string): CalendarInterval => ({kind: 'allDay', start, end});
const timed = (start: string, end?: string, timeZone?: string): CalendarInterval =>
    ({kind: 'timed', start, ...(end === undefined ? {} : {end}), ...(timeZone === undefined ? {} : {timeZone})});
const moment = (start: string, timeZone?: string) => timed(start, undefined, timeZone);
const itemOf = (interval: CalendarInterval, extra: Partial<CalendarItem> = {}): CalendarItem => ({id: 'a', title: 'Standup', interval, data: sealed(), ...extra});
const originOf = (value: string): MoveOrigin => value === 'start' ? {kind: 'start'} : {kind: 'grid', grabDate: value.slice('grid@'.length)};
const wallOf = (value: string): WallTime => {
    const [date, time] = value.split(' '), [hour, minute, second] = time.split(':').map(Number);
    return {date, hour, minute, second: Math.floor(second), millisecond: Math.round(second % 1 * 1000)};
};

/** A commit built from core only, mirroring createCalendarModel in src/v02/calendar/model.ts. */
function commitOf<I>(props: Record<string, unknown>): MoveCommit<I, unknown> {
    const result = validateCalendarInput<I, unknown>({anchorDate: '2026-09-01', onNavigate: () => undefined, ...props}, services, 'Untitled');
    if (result.kind === 'contract') return {kind: 'contract'};
    return {kind: 'data', blocking: isBlocking(result.props.dataState ?? {status: 'ready'}), timeZone: result.props.timeZone,
        visible: new Map(result.records.visibleItems.map(record => [record.item.id, record]))};
}
function latestOf<I>(commit: MoveCommit<I, unknown>, id = 'a'): ValidatedItem<I, unknown> {
    const latest = commit.kind === 'data' ? commit.visible.get(id) : undefined;
    if (!latest) throw new Error(`Expected a valid, visible item ${id}`);
    return latest;
}
type Allowed = Extract<MoveTarget<unknown>, {kind: 'allowed'}>;
type Blocked = Extract<MoveTarget<unknown>, {kind: 'blocked'}>;
function allowed(result: MoveTarget<unknown>): Allowed['proposal'] {
    expect(result.kind).toBe('allowed');
    return (result as Allowed).proposal;
}
function blockOf(result: MoveTarget<unknown>): Blocked['block'] {
    expect(result.kind).toBe('blocked');
    return (result as Blocked).block;
}
/** A data-free view of a result, for comparisons that must not traverse the item. */
const summary = (result: MoveTarget<unknown>, latest: ValidatedItem<unknown, unknown>) => result.kind === 'allowed'
    ? {...result, proposal: {...result.proposal, item: result.proposal.item === latest.item, previousInterval: result.proposal.previousInterval === latest.item.interval}}
    : result.kind === 'noop' ? {...result, item: result.item === latest.item} : result;

type Expected = {proposed: CalendarInterval} | {noop: true} | {gap: string} | {boundary: true};
type ProposalRow = {n: number; zone: string; interval: CalendarInterval; origin: string; target: string; startDate: string | null; expected: Expected; foldOffset?: number};
const row = (n: number, zone: string, interval: CalendarInterval, origin: string, target: string, startDate: string | null, expected: Expected, foldOffset?: number): ProposalRow =>
    ({n, zone, interval, origin, target, startDate, expected, ...(foldOffset === undefined ? {} : {foldOffset})});
const noop = {noop: true} as const, boundary = {boundary: true} as const;
const longAllDay = allDay('2026-09-03', '2026-09-12'), overnight = timed('2026-09-03T22:00:00+03:00', '2026-09-05T10:00:00+03:00');
const secondHalf = moment('2026-10-25T02:30:00+01:00'), apiaMoment = moment('2011-12-29T10:00:00-10:00');
const apiaNight = timed('2011-12-29T23:00:00-10:00', '2011-12-31T01:00:00+14:00'), monrovia = moment('1972-01-05T00:30:00Z');
const proposalRows: ProposalRow[] = [
    row(1, 'Europe/Moscow', longAllDay, 'start', '2026-09-11', '2026-09-11', {proposed: allDay('2026-09-11', '2026-09-20')}),
    row(2, 'Europe/Moscow', longAllDay, 'grid@2026-09-10', '2026-09-11', '2026-09-04', {proposed: allDay('2026-09-04', '2026-09-13')}),
    row(3, 'Europe/Moscow', longAllDay, 'start', '2026-09-10', '2026-09-10', {proposed: allDay('2026-09-10', '2026-09-19')}),
    row(4, 'Europe/Moscow', longAllDay, 'start', '2026-09-03', '2026-09-03', noop),
    row(5, 'Europe/Moscow', longAllDay, 'grid@2026-09-10', '2026-09-10', '2026-09-03', noop),
    row(6, 'Europe/Moscow', overnight, 'start', '2026-09-06', '2026-09-06', {proposed: timed('2026-09-06T22:00:00+03:00', '2026-09-08T10:00:00+03:00')}),
    row(7, 'Europe/Moscow', overnight, 'grid@2026-09-04', '2026-09-06', '2026-09-05', {proposed: timed('2026-09-05T22:00:00+03:00', '2026-09-07T10:00:00+03:00')}),
    row(8, 'Europe/Moscow', timed('2026-09-03T23:00:00+03:00', '2026-09-04T00:00:00+03:00'), 'start', '2026-09-04', '2026-09-04',
        {proposed: timed('2026-09-04T23:00:00+03:00', '2026-09-05T00:00:00+03:00')}),
    row(9, 'Europe/Moscow', moment('2026-09-04T00:00:00+03:00'), 'start', '2026-09-05', '2026-09-05', {proposed: moment('2026-09-05T00:00:00+03:00')}),
    row(10, 'Europe/Moscow', timed('2026-09-04T00:00:00+03:00', '2026-09-03T21:00:00Z'), 'start', '2026-09-05', '2026-09-05',
        {proposed: timed('2026-09-05T00:00:00+03:00', '2026-09-05T00:00:00+03:00')}),
    row(11, 'Europe/Moscow', moment('2026-09-03T10:00:00.5+03:00'), 'start', '2026-09-04', '2026-09-04', {proposed: moment('2026-09-04T10:00:00.500+03:00')}),
    row(12, 'Europe/Moscow', moment('2026-09-03T07:00:00.000Z'), 'start', '2026-09-05', '2026-09-05', {proposed: moment('2026-09-05T10:00:00+03:00')}),
    row(13, 'UTC', moment('2026-09-03T07:00:00Z'), 'start', '2026-09-05', '2026-09-05', {proposed: moment('2026-09-05T07:00:00+00:00')}),
    row(14, 'Europe/Berlin', moment('2026-03-28T12:00:00+01:00'), 'start', '2026-03-29', '2026-03-29', {proposed: moment('2026-03-29T12:00:00+02:00')}),
    row(15, 'Europe/Berlin', moment('2026-03-28T02:30:00+01:00'), 'start', '2026-03-29', '2026-03-29', {gap: '2026-03-29 02:30:00.000'}),
    row(16, 'Europe/Berlin', moment('2026-03-28T01:59:59.999+01:00'), 'start', '2026-03-29', '2026-03-29', {proposed: moment('2026-03-29T01:59:59.999+01:00')}),
    row(17, 'Europe/Berlin', moment('2026-03-28T03:00:00+01:00'), 'start', '2026-03-29', '2026-03-29', {proposed: moment('2026-03-29T03:00:00+02:00')}),
    row(18, 'Europe/Berlin', moment('2026-10-24T02:30:00+02:00'), 'start', '2026-10-25', '2026-10-25', {proposed: moment('2026-10-25T02:30:00+02:00')}, 7_200_000),
    row(19, 'Europe/Berlin', secondHalf, 'start', '2026-10-25', '2026-10-25', noop, 3_600_000),
    row(20, 'Europe/Berlin', secondHalf, 'start', '2026-10-26', '2026-10-26', {proposed: moment('2026-10-26T02:30:00+01:00')}),
    row(21, 'Europe/Berlin', secondHalf, 'start', '2026-10-24', '2026-10-24', {proposed: moment('2026-10-24T02:30:00+02:00')}),
    row(22, 'Europe/Berlin', timed('2026-03-28T01:30:00+01:00', '2026-03-28T03:30:00+01:00'), 'start', '2026-03-29', '2026-03-29',
        {proposed: timed('2026-03-29T01:30:00+01:00', '2026-03-29T04:30:00+02:00')}),
    row(23, 'Europe/Berlin', timed('2026-10-24T01:30:00+02:00', '2026-10-24T03:30:00+02:00'), 'start', '2026-10-25', '2026-10-25',
        {proposed: timed('2026-10-25T01:30:00+02:00', '2026-10-25T02:30:00+01:00')}),
    row(24, 'Europe/Berlin', timed('2026-03-28T01:30:00+01:00', '2026-03-28T03:30:00+01:00', 'America/New_York'), 'start', '2026-03-29', '2026-03-29',
        {proposed: timed('2026-03-28T20:30:00-04:00', '2026-03-28T22:30:00-04:00', 'America/New_York')}),
    row(25, 'Asia/Tokyo', moment('2026-09-03T20:00:00Z', 'Europe/Berlin'), 'start', '2026-09-05', '2026-09-05', {proposed: moment('2026-09-04T22:00:00+02:00', 'Europe/Berlin')}),
    row(26, 'Pacific/Apia', apiaMoment, 'start', '2011-12-30', '2011-12-30', {gap: '2011-12-30 10:00:00.000'}),
    row(27, 'Pacific/Apia', apiaMoment, 'start', '2011-12-31', '2011-12-31', {proposed: moment('2011-12-31T10:00:00+14:00')}),
    row(28, 'Pacific/Apia', allDay('2011-12-29', '2011-12-30'), 'start', '2011-12-30', '2011-12-30', {proposed: allDay('2011-12-30', '2011-12-31')}),
    row(29, 'Pacific/Apia', allDay('2011-12-29', '2012-01-01'), 'grid@2011-12-31', '2012-01-01', '2011-12-30', {proposed: allDay('2011-12-30', '2012-01-02')}),
    row(30, 'Pacific/Apia', apiaNight, 'start', '2011-12-30', '2011-12-30', {gap: '2011-12-30 23:00:00.000'}),
    row(31, 'Pacific/Apia', apiaNight, 'start', '2011-12-31', '2011-12-31', {proposed: timed('2011-12-31T23:00:00+14:00', '2012-01-01T01:00:00+14:00')}),
    row(32, 'Pacific/Apia', apiaNight, 'start', '2011-12-28', '2011-12-28', {proposed: timed('2011-12-28T23:00:00-10:00', '2011-12-29T01:00:00-10:00')}),
    row(33, 'Europe/Paris', moment('1890-03-10T12:00:00Z'), 'start', '1890-03-11', '1890-03-11', {proposed: moment('1890-03-11T12:00:00.000Z')}),
    row(34, 'UTC', moment('1890-03-10T12:00:00Z', 'Europe/Paris'), 'start', '1890-03-11', '1890-03-11', {proposed: moment('1890-03-11T12:00:00.000Z', 'Europe/Paris')}),
    row(35, 'Africa/Monrovia', monrovia, 'start', '1972-01-05', '1972-01-05', {proposed: moment('1972-01-06T00:30:00.000Z')}),
    row(36, 'Africa/Monrovia', monrovia, 'start', '1972-01-07', '1972-01-07', {proposed: moment('1972-01-07T23:45:30+00:00')}),
    row(37, 'Africa/Monrovia', moment('1972-01-06T01:04:30Z'), 'start', '1972-01-07', '1972-01-07', {gap: '1972-01-07 00:20:00.000'}),
    row(38, 'UTC', timed('9999-11-29T20:00:00Z', '9999-12-30T20:00:00Z', 'Asia/Tokyo'), 'start', '9999-11-30', '9999-11-30',
        {proposed: timed('9999-12-01T05:00:00+09:00', '9999-12-31T20:00:00.000Z', 'Asia/Tokyo')}),
    row(39, 'UTC', allDay('9999-11-20', '9999-12-31'), 'grid@9999-11-25', '9999-12-05', '9999-11-30', boundary),
    row(40, 'UTC', allDay('0001-01-01', '0001-03-01'), 'grid@0001-02-20', '0001-01-29', null, boundary),
    row(41, 'UTC', timed('9999-11-20T10:00:00Z', '9999-12-31T10:00:00Z'), 'start', '9999-11-21', '9999-11-21', boundary),
    row(42, 'America/New_York', moment('9999-12-30T23:00:00-05:00'), 'start', '9999-12-31', '9999-12-31', boundary),
    row(43, 'America/New_York', moment('1883-11-17T16:57:02Z'), 'start', '1883-11-18', '1883-11-18', {proposed: moment('1883-11-18T16:57:02.000Z')}, -17_762_000),
    row(44, 'Europe/Berlin', moment('2026-10-25T02:30:00+02:00'), 'start', '2026-10-25', '2026-10-25', noop, 7_200_000),
    row(45, 'Europe/Berlin', moment('2026-10-25T01:30:00+02:00'), 'start', '2026-10-25', '2026-10-25', noop),
];

describe('proposal table (rules 1–6)', () => {
    it.each(proposalRows)('row $n: $zone, $origin → $target', ({zone, interval, origin, target, startDate, expected, foldOffset}) => {
        const latest = latestOf(commitOf({items: [itemOf(interval)], timeZone: zone}));
        const draft = startMoveDraft(latest, zone, originOf(origin));
        const result = evaluateMoveTarget(draft, latest, target, 'pointer', undefined, dates);
        expect(result.startDate).toBe(startDate);
        expect('foldOffset' in result).toBe(foldOffset !== undefined);
        expect(result.foldOffset).toBe(foldOffset);
        if ('proposed' in expected) {
            const proposal = allowed(result);
            // Exact strings, not instants; a missing end or author zone stays missing.
            expect(proposal.proposedInterval).toStrictEqual(expected.proposed);
            expect('end' in proposal.proposedInterval).toBe('end' in expected.proposed);
            expect('timeZone' in proposal.proposedInterval).toBe('timeZone' in expected.proposed);
            expect(proposal.item).toBe(latest.item);
            expect(proposal.previousInterval).toBe(latest.item.interval);
            // Rule 1: every input method proposes the same interval for the same origin and target.
            for (const input of ['touch', 'keyboard'] as const) {
                const other = allowed(evaluateMoveTarget(draft, latest, target, input, undefined, dates));
                expect(other.proposedInterval).toStrictEqual(expected.proposed);
                expect(other.input).toBe(input);
            }
        } else if ('noop' in expected) {
            expect(result.kind).toBe('noop');
            expect(result.kind === 'noop' && result.item).toBe(latest.item);
            expect(Object.keys(result).sort()).toEqual(['item', 'kind', 'startDate', ...(foldOffset === undefined ? [] : ['foldOffset'])].sort());
        } else if ('gap' in expected) {
            expect(result).toStrictEqual({kind: 'blocked', block: {kind: 'gap', wall: wallOf(expected.gap)}, startDate});
        } else {
            expect(result).toStrictEqual({kind: 'blocked', block: {kind: 'boundary'}, startDate});
        }
    });
    // The fold and its offset belong to Calendar.timeZone, serialization to the author zone (Watch out for: two zones, two jobs).
    it.each([
        {target: '2026-10-25', interval: moment('2026-10-24T02:30:00+02:00', 'Asia/Tokyo'), kind: 'allowed', start: '2026-10-25T09:30:00+09:00', foldOffset: 7_200_000},
        {target: '2026-10-25', interval: moment('2026-10-25T02:30:00+01:00', 'Asia/Tokyo'), kind: 'noop', start: '2026-10-25T02:30:00+01:00', foldOffset: 3_600_000},
    ])('takes the fold offset of a $kind target from Calendar.timeZone, not from the author zone', ({target, interval, kind, start, foldOffset}) => {
        const latest = latestOf(commitOf({items: [itemOf(interval)], timeZone: 'Europe/Berlin'}));
        const result = evaluateMoveTarget(startMoveDraft(latest, 'Europe/Berlin', {kind: 'start'}), latest, target, 'pointer', undefined, dates);
        expect(result.kind).toBe(kind);
        expect(result.foldOffset).toBe(foldOffset);
        const written = result.kind === 'allowed' ? result.proposal.proposedInterval : result.kind === 'noop' ? result.item.interval : undefined;
        expect(written).toStrictEqual(moment(start, 'Asia/Tokyo'));
    });
    it.each([
        {name: 'an exclusive all-day end of 9999-12-31', interval: allDay('9999-12-29', '9999-12-30'), target: '9999-12-30', proposed: allDay('9999-12-30', '9999-12-31')},
        {name: 'a timed end at the last instant', interval: timed('9999-12-30T00:00:00Z', '9999-12-30T23:59:59.999Z'), target: '9999-12-31',
            proposed: timed('9999-12-31T00:00:00+00:00', '9999-12-31T23:59:59.999+00:00')},
    ])('allows $name (rule 5 bounds are inclusive)', ({interval, target, proposed}) => {
        const latest = latestOf(commitOf({items: [itemOf(interval)], timeZone: 'UTC'}));
        const result = evaluateMoveTarget(startMoveDraft(latest, 'UTC', {kind: 'start'}), latest, target, 'pointer', undefined, dates);
        expect(allowed(result).proposedInterval).toStrictEqual(proposed);
    });
    it('measures the shift in calendar days, not 24 h (row 14 is 23 elapsed hours)', () => {
        const latest = latestOf(commitOf({items: [itemOf(moment('2026-03-28T12:00:00+01:00'))], timeZone: 'Europe/Berlin'}));
        const proposal = allowed(evaluateMoveTarget(startMoveDraft(latest, 'Europe/Berlin', {kind: 'start'}), latest, '2026-03-29', 'pointer', undefined, dates));
        expect(parseRFC3339((proposal.proposedInterval as {start: string}).start) - parseRFC3339('2026-03-28T12:00:00+01:00')).toBe(23 * 3_600_000);
    });
    it('keeps the latest strings on a no-op (rules 6 and 10)', () => {
        const first = latestOf(commitOf({items: [itemOf(moment('2026-10-25T02:30:00+01:00'))], timeZone: 'Europe/Berlin'}));
        const draft = startMoveDraft(first, 'Europe/Berlin', {kind: 'start'});
        const rewritten = itemOf(moment('2026-10-25T01:30:00.000Z'));
        const step = reconcileMoveDraft(draft, commitOf({items: [rewritten], timeZone: 'Europe/Berlin'}));
        expect(step.outcome?.kind).toBe('keep');
        const latest = latestOf(commitOf({items: [rewritten], timeZone: 'Europe/Berlin'}));
        const result = evaluateMoveTarget(draft, latest, '2026-10-25', 'keyboard', undefined, dates);
        expect(result.kind === 'noop' && result.item).toBe(rewritten);
        expect(result.kind === 'noop' && result.item.interval).toStrictEqual(moment('2026-10-25T01:30:00.000Z'));
        expect(result.foldOffset).toBe(3_600_000);
    });
    it('gives equal results when called twice', () => {
        for (const {zone, interval, origin, target} of proposalRows) {
            const latest = latestOf(commitOf({items: [itemOf(interval)], timeZone: zone}));
            const draft = startMoveDraft(latest, zone, originOf(origin));
            expect(summary(evaluateMoveTarget(draft, latest, target, 'pointer', undefined, dates), latest))
                .toStrictEqual(summary(evaluateMoveTarget(draft, latest, target, 'pointer', undefined, dates), latest));
        }
    });
});

// Q6: a timed start outside the ISO date domain in Calendar.timeZone (local 0000-12-31 19:03:58 at −04:56:02).
describe('timed start outside the ISO date domain (Q6)', () => {
    const interval = timed('0001-01-01T00:00:00Z', '0001-02-10T00:00:00Z');
    it.each([
        {origin: 'start', target: '0001-02-05', startDate: '0001-02-05', proposed: timed('0001-02-06T00:00:00.000Z', '0001-03-18T00:00:00.000Z')},
        {origin: 'grid@0001-02-01', target: '0001-02-02', startDate: '0001-01-01', proposed: timed('0001-01-02T00:00:00.000Z', '0001-02-11T00:00:00.000Z')},
    ])('$origin → $target is allowed', ({origin, target, startDate, proposed}) => {
        const latest = latestOf(commitOf({items: [itemOf(interval)], timeZone: 'America/New_York'}));
        expect(moveOriginDate(latest.interval, 'America/New_York', dates)).toBeNull();
        const result = evaluateMoveTarget(startMoveDraft(latest, 'America/New_York', originOf(origin)), latest, target, 'pointer', undefined, dates);
        expect(result.startDate).toBe(startDate);
        expect(allowed(result).proposedInterval).toStrictEqual(proposed);
    });
    it('a zero grid shift is a no-op with a null start date; a shift out of the domain is a boundary without policy calls', () => {
        const latest = latestOf(commitOf({items: [itemOf(interval)], timeZone: 'America/New_York'}));
        const draft = startMoveDraft(latest, 'America/New_York', {kind: 'grid', grabDate: '0001-02-01'});
        const policy = {canMoveItem: vi.fn(() => true as const), canDropItem: vi.fn(() => true as const)};
        const noopResult = evaluateMoveTarget(draft, latest, '0001-02-01', 'pointer', policy, dates);
        expect(noopResult.kind === 'noop' && noopResult.item).toBe(latest.item);
        expect(noopResult.startDate).toBeNull();
        expect('foldOffset' in noopResult).toBe(false);
        expect(evaluateMoveTarget(draft, latest, '0001-01-31', 'pointer', policy, dates)).toStrictEqual({kind: 'blocked', block: {kind: 'boundary'}, startDate: null});
        expect(policy.canMoveItem).not.toHaveBeenCalled();
        expect(policy.canDropItem).not.toHaveBeenCalled();
    });
});

describe('origin date and supported Month grids (rules 1 and 5, Q9)', () => {
    it.each([
        {zone: 'Europe/Moscow', interval: allDay('2026-09-03', '2026-09-12'), date: '2026-09-03'},
        {zone: 'Europe/Moscow', interval: moment('2026-09-03T07:00:00.000Z'), date: '2026-09-03'},
        {zone: 'Asia/Tokyo', interval: moment('2026-09-03T20:00:00Z', 'Europe/Berlin'), date: '2026-09-04'},
        {zone: 'Africa/Monrovia', interval: moment('1972-01-05T00:30:00Z'), date: '1972-01-04'},
        {zone: 'America/New_York', interval: moment('0001-01-01T00:00:00Z'), date: null},
    ])('the origin of $interval.start in $zone is $date', ({zone, interval, date}) => {
        expect(moveOriginDate(dates.parseInterval(interval), zone, dates)).toBe(date);
    });
    it.each([
        ['monday', '0001-01-29', '9999-12-05'], ['tuesday', '0001-01-30', '9999-12-06'], ['wednesday', '0001-01-31', '9999-11-30'],
        ['thursday', '0001-02-01', '9999-12-01'], ['friday', '0001-01-26', '9999-12-02'], ['saturday', '0001-01-27', '9999-12-03'],
        ['sunday', '0001-01-28', '9999-12-04'],
    ] as const)('a %s week start covers %s…%s', (firstDayOfWeek: CalendarWeekday, first, last) => {
        expect(getCalendarVisibleRange({anchorDate: '0001-02-01', timeZone: 'UTC', firstDayOfWeek}).start).toBe(first);
        expect(getCalendarVisibleRange({anchorDate: '9999-11-01', timeZone: 'UTC', firstDayOfWeek}).end).toBe(addCalendarDays(last, 1));
        expect(isInSupportedMonthGrid(first, firstDayOfWeek)).toBe(true);
        expect(isInSupportedMonthGrid(last, firstDayOfWeek)).toBe(true);
        expect(isInSupportedMonthGrid(addCalendarDays(first, -1), firstDayOfWeek)).toBe(false);
        expect(isInSupportedMonthGrid(addCalendarDays(last, 1), firstDayOfWeek)).toBe(false);
    });
    it('rejects the Q9 origins for a monday week start and invalid input', () => {
        expect(isInSupportedMonthGrid('0001-01-10', 'monday')).toBe(false);
        expect(isInSupportedMonthGrid('9999-12-20', 'monday')).toBe(false);
        expect(isInSupportedMonthGrid('2026-09-03', 'monday')).toBe(true);
        expect(() => isInSupportedMonthGrid('2026-02-30', 'monday')).toThrow(RangeError);
        expect(() => isInSupportedMonthGrid('2026-09-03', 'someday' as CalendarWeekday)).toThrow(RangeError);
    });
});

describe('utcOffset of moveTargetAnnouncement (Q2)', () => {
    it.each([[7_200_000, '+02:00'], [3_600_000, '+01:00'], [-17_762_000, '-04:56:02'], [-2_670_000, '-00:44:30'], [561_000, '+00:09:21'], [0, '+00:00'],
        [-0, '+00:00'], [-18_000_000, '-05:00'], [50_400_000, '+14:00']])('formats %i ms as %s', (offset, label) => {
        expect(formatUtcOffset(offset)).toBe(label);
    });
    it('rejects offsets that no zone has', () => {
        for (const offset of [1_500, 86_400_000, -86_400_000, Number.NaN]) expect(() => formatUtcOffset(offset)).toThrow(RangeError);
    });
});

describe('structured wall-time resolution', () => {
    const wall = (date: string, hour: number, minute = 30, second = 0, millisecond = 0): WallTime => ({date, hour, minute, second, millisecond});
    it.each([
        ['a DST gap', wall('2026-03-29', 2), 'Europe/Berlin', {kind: 'gap'}],
        ['a skipped civil date', wall('2011-12-30', 10, 0), 'Pacific/Apia', {kind: 'gap'}],
        ['the Monrovia gap up to its last millisecond', wall('1972-01-07', 0, 44, 29, 999), 'Africa/Monrovia', {kind: 'gap'}],
        ['the first Monrovia time after the gap', wall('1972-01-07', 0, 44, 30), 'Africa/Monrovia', {kind: 'instant', instant: parseRFC3339('1972-01-07T00:44:30Z'), fold: false}],
        ['the earlier instant of a fold', wall('2026-10-25', 2), 'Europe/Berlin', {kind: 'instant', instant: parseRFC3339('2026-10-25T00:30:00Z'), fold: true}],
        ['the 1883 fold of local mean time', wall('1883-11-18', 12, 1), 'America/New_York', {kind: 'instant', instant: parseRFC3339('1883-11-18T16:57:02Z'), fold: true}],
        ['a wall time that occurs once', wall('2026-10-25', 1), 'Europe/Berlin', {kind: 'instant', instant: parseRFC3339('2026-10-24T23:30:00Z'), fold: false}],
        ['a wall time before the first instant', wall('0001-01-01', 0, 0), 'Asia/Tokyo', {kind: 'outsideDomain'}],
        ['a wall time after the last instant', wall('9999-12-31', 23, 59), 'America/New_York', {kind: 'outsideDomain'}],
    ] as const)('reports %s', (_label, input, zone, expected) => {
        expect(dates.resolveWallTimeResult(input, zone)).toStrictEqual(expected);
    });
    it('still throws RangeError for invalid input', () => {
        for (const input of [wall('2026-02-30', 10), wall('0000-12-31', 10), wall('2026-09-03', 24), wall('2026-09-03', 10, 60), wall('2026-09-03', 10, 0, 0, 1000), wall('2026-09-03', 1.5)]) {
            expect(() => dates.resolveWallTimeResult(input, 'UTC')).toThrow(RangeError);
        }
        expect(() => dates.resolveWallTimeResult(wall('2026-09-03', 10), 'Asia/Kolkata')).toThrow(RangeError);
    });
    it('keeps resolveWallTime and its messages on top of it', () => {
        expect(() => dates.resolveWallTime(wall('2026-03-29', 2), 'Europe/Berlin')).toThrow(new RangeError('Local wall time is in a timezone gap'));
        expect(() => dates.resolveWallTime(wall('0001-01-01', 0, 0), 'Asia/Tokyo')).toThrow(new RangeError('Local wall time exceeds the supported instant domain'));
        expect(dates.resolveWallTime(wall('2026-10-25', 2), 'Europe/Berlin')).toBe(parseRFC3339('2026-10-25T00:30:00Z'));
    });
});

describe('draft snapshot (rule 7)', () => {
    it('keeps the ID, canonical interval, exact zone, raw title and origin, never the item or its data', () => {
        const item = itemOf(timed('2026-09-03T10:00:00+03:00', '2026-09-03T11:00:00+03:00'), {title: '  '});
        const latest = latestOf(commitOf({items: [item], timeZone: 'Europe/Moscow'}));
        const origin = {kind: 'grid', grabDate: '2026-09-03'} as const;
        const draft = startMoveDraft(latest, 'Europe/Moscow', origin);
        expect(Object.keys(draft).sort()).toEqual(['interval', 'itemId', 'origin', 'timeZone', 'title']);
        expect(draft).toMatchObject({itemId: 'a', timeZone: 'Europe/Moscow', title: '  ', origin});
        // Raw title (resolved through untitledItemLabel only when spoken), unlike ValidatedItem.title.
        expect(latest.title).toBe('Untitled');
        expect(draft.interval).toBe(latest.interval);
        expect((Object.values(draft) as unknown[]).some(value => value === item || value === item.data)).toBe(false);
    });
});

describe('reconciliation table (rules 8 and 9)', () => {
    const standupInterval = timed('2026-09-03T10:00:00+03:00', '2026-09-03T11:00:00+03:00');
    const momentInterval = moment('2026-09-04T00:00:00+03:00');
    const sources = [{id: 'work', title: 'Work'}, {id: 'home', title: 'Home'}];
    const props = (items: readonly unknown[], extra: Record<string, unknown> = {}) => ({items, timeZone: 'Europe/Moscow', sources, ...extra});
    const withInterval = (item: CalendarItem, interval: Partial<CalendarInterval> | CalendarInterval) => ({...item, interval: {...item.interval, ...interval} as CalendarInterval});
    type Next = (item: CalendarItem, items: readonly CalendarItem[]) => Record<string, unknown>;
    type Outcome = 'keep' | MoveCancelReason;
    const rows: {n: number; next: Next; outcome: Outcome; moment?: true}[] = [
        {n: 1, next: (_item, items) => props(items), outcome: 'keep'},
        {n: 2, next: item => props([{...item, interval: {...item.interval}}]), outcome: 'keep'},
        {n: 3, next: item => props([{...item, title: 'Daily', data: cyclic(), calendarId: 'home'}]), outcome: 'keep'},
        {n: 4, next: item => props([withInterval(item, {start: '2026-09-03T07:00:00Z', end: '2026-09-03T08:00:00.000Z'})]), outcome: 'keep'},
        {n: 5, next: item => props([withInterval(item, {end: '2026-09-03T11:30:00+03:00'})]), outcome: 'interval'},
        {n: 6, next: item => props([withInterval(item, {start: '2026-09-03T10:01:00+03:00'})]), outcome: 'interval'},
        {n: 7, next: item => props([{...item, interval: allDay('2026-09-03', '2026-09-04')}]), outcome: 'interval'},
        {n: 8, next: item => props([withInterval(item, {timeZone: 'Europe/Moscow'})]), outcome: 'interval'},
        {n: 9, moment: true, next: item => props([withInterval(item, {end: undefined})]), outcome: 'keep'},
        {n: 10, moment: true, next: item => props([withInterval(item, {end: '2026-09-04T00:00:00+03:00'})]), outcome: 'interval'},
        {n: 11, moment: true, next: item => props([withInterval(item, {timeZone: 'Asia/Tokyo'})]), outcome: 'interval'},
        {n: 12, next: () => props([]), outcome: 'unavailable'},
        {n: 13, next: item => props([item, {...item, title: 'Copy'}]), outcome: 'unavailable'},
        {n: 14, next: item => props([withInterval(item, {end: '2026-09-03T09:00:00+03:00'})]), outcome: 'unavailable'},
        {n: 15, next: item => props([{...item, title: 42}]), outcome: 'unavailable'},
        {n: 16, next: item => props([{...item, calendarId: 'home'}], {visibleSourceIds: ['work'], onVisibleSourceIdsChange: () => undefined}), outcome: 'unavailable'},
        {n: 17, next: item => props([{...item, calendarId: 'missing'}]), outcome: 'keep'},
        {n: 18, next: (_item, items) => props(items, {anchorDate: '2026-11-01'}), outcome: 'keep'},
        {n: 19, next: (_item, items) => props(items, {timeZone: 'Europe/Berlin'}), outcome: 'timeZone'},
        {n: 20, next: (_item, items) => props(items, {dataState: {status: 'loading', phase: 'refresh'}}), outcome: 'keep'},
        {n: 21, next: (_item, items) => props(items, {dataState: {status: 'loading', phase: 'initial'}}), outcome: 'blocking'},
        {n: 22, next: (_item, items) => props(items, {anchorDate: '2026-02-30'}), outcome: 'blocking'},
        // The removed item's changed interval travels under another ID; neither the zone nor that interval is reached.
        {n: 23, next: item => props([withInterval({...item, id: 'b'}, {end: '2026-09-03T11:30:00+03:00'})], {timeZone: 'Europe/Berlin'}), outcome: 'unavailable'},
        {n: 24, next: item => props([withInterval(item, {end: '2026-09-03T11:30:00+03:00'})], {timeZone: 'Europe/Berlin'}), outcome: 'timeZone'},
        {n: 25, next: () => props([], {dataState: {status: 'loading', phase: 'initial'}}), outcome: 'blocking'},
        {n: 26, next: (_item, items) => props(items, {interactionPolicy: {canMoveItem: () => ({allowed: false, reason: 'Locked'})}}), outcome: 'keep'},
    ];
    const open = (interval: CalendarInterval) => {
        const item = itemOf(interval, {calendarId: 'work'}), items = [item];
        const latest = latestOf(commitOf(props(items)));
        return {item, items, draft: startMoveDraft(latest, 'Europe/Moscow', {kind: 'start'})};
    };
    it.each(rows)('row $n: $outcome', ({n, next, outcome, moment: isMoment}) => {
        const {item, items, draft} = open(isMoment ? momentInterval : standupInterval);
        const nextProps = next(item, items), step = reconcileMoveDraft(draft, commitOf(nextProps));
        if (outcome !== 'keep') {
            expect(step).toStrictEqual({draft: null, outcome: {kind: 'cancel', reason: outcome}});
            return;
        }
        expect(step.draft).toBe(draft);
        expect(step.outcome?.kind).toBe('keep');
        const latest = step.outcome?.kind === 'keep' ? step.outcome.latest : undefined;
        expect(latest?.item).toBe((nextProps.items as readonly CalendarItem[]).find(value => value.id === 'a'));
        if (n === 3) {
            expect(latest?.item.title).toBe('Daily');
            expect(draft.title).toBe('Standup');
        }
        if (n === 4) {
            const policy = {canDropItem: vi.fn(() => true as const)};
            const result = evaluateMoveTarget(draft, latest!, '2026-09-04', 'keyboard', policy, dates);
            expect(allowed(result).previousInterval).toBe(latest!.item.interval);
            expect(allowed(result).previousInterval).toStrictEqual(timed('2026-09-03T07:00:00Z', '2026-09-03T08:00:00.000Z'));
            const unchanged = evaluateMoveTarget(draft, latest!, '2026-09-03', 'keyboard', policy, dates);
            expect(unchanged.kind === 'noop' && unchanged.item.interval).toStrictEqual(timed('2026-09-03T07:00:00Z', '2026-09-03T08:00:00.000Z'));
        }
        if (n === 26) {
            const policy = (nextProps.interactionPolicy as CalendarInteractionPolicy);
            expect(blockOf(evaluateMoveTarget(draft, latest!, '2026-09-04', 'keyboard', policy, dates))).toStrictEqual({kind: 'policy', reason: 'Locked'});
        }
    });
    it('row 27: a cancelled draft is not restored when the original commit returns', () => {
        const {item, items, draft} = open(standupInterval);
        const first = reconcileMoveDraft(draft, commitOf(props(items)));
        expect(first.draft).toBe(draft);
        expect(first.outcome?.kind).toBe('keep');
        const second = reconcileMoveDraft(first.draft, commitOf(props([withInterval(item, {end: '2026-09-03T11:30:00+03:00'})])));
        expect(second).toStrictEqual({draft: null, outcome: {kind: 'cancel', reason: 'interval'}});
        expect(reconcileMoveDraft(second.draft, commitOf(props(items)))).toStrictEqual({draft: null, outcome: null});
    });
    it('gives equal steps when called twice', () => {
        const {items, draft} = open(standupInterval);
        const commit = commitOf(props(items));
        expect(reconcileMoveDraft(draft, commit)).toStrictEqual(reconcileMoveDraft(draft, commit));
        expect(reconcileMoveDraft(null, commit)).toStrictEqual({draft: null, outcome: null});
    });
});

describe('policy table (rule 10)', () => {
    const base = itemOf(allDay('2026-09-03', '2026-09-04'), {id: 'b'});
    const gapItem = itemOf(moment('2026-03-28T02:30:00+01:00'), {id: 'b'});
    const spies = () => ({canMoveItem: vi.fn((_item: unknown) => true as const), canDropItem: vi.fn((_proposal: unknown) => true as const)});
    type PolicyRow = {n: number; name: string; policy: () => CalendarInteractionPolicy | undefined; expected: Record<string, unknown>;
        zone?: string; item?: CalendarItem; target?: string; changed?: CalendarItem};
    const proposed = {kind: 'allowed', startDate: '2026-09-05', proposal: {item: true, previousInterval: true, input: 'keyboard', proposedInterval: allDay('2026-09-05', '2026-09-06')}};
    const rows: PolicyRow[] = [
        {n: 1, name: 'no interactionPolicy allows the plain proposal', policy: () => undefined, expected: proposed},
        {n: 2, name: 'canMoveItem denies with its reason', policy: () => ({canMoveItem: () => ({allowed: false, reason: 'Locked'})}),
            expected: {kind: 'blocked', block: {kind: 'policy', reason: 'Locked'}, startDate: '2026-09-05'}},
        {n: 3, name: 'canDropItem denies with its reason', policy: () => ({canDropItem: () => ({allowed: false, reason: 'Weekend'})}),
            expected: {kind: 'blocked', block: {kind: 'policy', reason: 'Weekend'}, startDate: '2026-09-05'}},
        {n: 4, name: 'a blank reason denies with genericBlockedReason and one diagnostic', policy: () => ({canDropItem: () => ({allowed: false, reason: '  '})}),
            expected: {kind: 'blocked', startDate: '2026-09-05', block: {kind: 'policy', reason: undefined, diagnostic: {path: 'interactionPolicy.canDropItem', reason: malformed}}}},
        {n: 5, name: 'a gap never reaches the policy', policy: spies, zone: 'Europe/Berlin', item: gapItem, target: '2026-03-29',
            expected: {kind: 'blocked', block: {kind: 'gap', wall: wallOf('2026-03-29 02:30:00.000')}, startDate: '2026-03-29'}},
        {n: 6, name: 'canDropItem receives the proposal of the latest item without requestId', policy: spies,
            changed: {...base, title: 'Renamed', data: cyclic()}, expected: proposed},
    ];
    it.each(rows)('row $n: $name', ({n, policy: makePolicy, expected, zone = 'Europe/Moscow', item = base, target = '2026-09-05', changed}) => {
        const draft = startMoveDraft(latestOf(commitOf({items: [item], timeZone: zone}), 'b'), zone, {kind: 'start'});
        const policy = makePolicy();
        // The draft stays open whatever the policy says (row 2); row 6 changes title and data during the draft.
        const step = reconcileMoveDraft(draft, commitOf({items: [changed ?? item], timeZone: zone, ...(policy ? {interactionPolicy: policy} : {})}));
        expect(step.draft).toBe(draft);
        const latest = latestOf(commitOf({items: [changed ?? item], timeZone: zone}), 'b');
        expect(step.outcome?.kind === 'keep' && step.outcome.latest.item).toBe(latest.item);
        const result = evaluateMoveTarget(draft, latest, target, 'keyboard', policy, dates);
        expect(summary(result, latest)).toStrictEqual(expected);
        if (n === 1) expect(Object.keys(allowed(result)).sort()).toEqual(['input', 'item', 'previousInterval', 'proposedInterval']);
        if (n === 5) expect([(policy as ReturnType<typeof spies>).canMoveItem.mock.calls.length, (policy as ReturnType<typeof spies>).canDropItem.mock.calls.length]).toEqual([0, 0]);
        if (n === 6) {
            const {canDropItem, canMoveItem} = policy as ReturnType<typeof spies>;
            expect(canMoveItem.mock.calls.length === 1 && canMoveItem.mock.calls[0][0]).toBe(changed);
            expect(canDropItem).toHaveBeenCalledTimes(1);
            const received = canDropItem.mock.calls[0][0] as Allowed['proposal'];
            expect(Object.keys(received).sort()).toEqual(['input', 'item', 'previousInterval', 'proposedInterval']);
            expect(received.item).toBe(changed);
            expect(received.previousInterval).toBe(changed!.interval);
            expect(allowed(result)).toBe(received);
        }
    });
    it('a policy object without callbacks allows', () => {
        const latest = latestOf(commitOf({items: [base], timeZone: 'Europe/Moscow'}), 'b');
        const result = evaluateMoveTarget(startMoveDraft(latest, 'Europe/Moscow', {kind: 'start'}), latest, '2026-09-05', 'keyboard', {}, dates);
        expect(summary(result, latest)).toStrictEqual(proposed);
    });
});

describe('maintainer decisions on policy (Q4, Q5, Q7)', () => {
    const berlin = () => {
        const latest = latestOf(commitOf({items: [itemOf(moment('2026-03-28T02:30:00+01:00'))], timeZone: 'Europe/Berlin'}));
        return {latest, draft: startMoveDraft(latest, 'Europe/Berlin', {kind: 'start'})};
    };
    it('Q4: a no-op calls no policy, even one that denies the item', () => {
        const latest = latestOf(commitOf({items: [itemOf(allDay('2026-09-03', '2026-09-04'))], timeZone: 'Europe/Moscow'}));
        const policy = {canMoveItem: vi.fn(() => ({allowed: false, reason: 'Locked'}) as const), canDropItem: vi.fn(() => true as const)};
        const result = evaluateMoveTarget(startMoveDraft(latest, 'Europe/Moscow', {kind: 'start'}), latest, '2026-09-03', 'keyboard', policy, dates);
        expect(result.kind === 'noop' && result.item).toBe(latest.item);
        expect(policy.canMoveItem).not.toHaveBeenCalled();
        expect(policy.canDropItem).not.toHaveBeenCalled();
    });
    it('Q5: core blocks, then canMoveItem, then canDropItem; each callback at most once', () => {
        const {latest, draft} = berlin();
        const canMoveItem = vi.fn(() => ({allowed: false, reason: 'Locked'}) as const), canDropItem = vi.fn(() => ({allowed: false, reason: 'Weekend'}) as const);
        expect(blockOf(evaluateMoveTarget(draft, latest, '2026-03-29', 'keyboard', {canMoveItem, canDropItem}, dates)).kind).toBe('gap');
        expect([canMoveItem.mock.calls.length, canDropItem.mock.calls.length]).toEqual([0, 0]);
        expect(blockOf(evaluateMoveTarget(draft, latest, '2026-03-30', 'keyboard', {canMoveItem, canDropItem}, dates))).toStrictEqual({kind: 'policy', reason: 'Locked'});
        expect([canMoveItem.mock.calls.length, canDropItem.mock.calls.length]).toEqual([1, 0]);
        canMoveItem.mockReturnValue(true as never);
        expect(blockOf(evaluateMoveTarget(draft, latest, '2026-03-30', 'keyboard', {canMoveItem, canDropItem}, dates))).toStrictEqual({kind: 'policy', reason: 'Weekend'});
        expect([canMoveItem.mock.calls.length, canDropItem.mock.calls.length]).toEqual([2, 1]);
    });
    it('Q5: canMoveItem receives the latest item object itself', () => {
        const {latest, draft} = berlin();
        const canMoveItem = vi.fn((_item: unknown) => true as const);
        evaluateMoveTarget(draft, latest, '2026-03-30', 'touch', {canMoveItem}, dates);
        expect(canMoveItem).toHaveBeenCalledTimes(1);
        expect(canMoveItem.mock.calls[0][0]).toBe(latest.item);
    });
    it.each([['false', false], ['undefined', undefined], ['{allowed: false} without a reason', {allowed: false}], ['{allowed: true}', {allowed: true}],
        ['a Promise', Promise.resolve(true)]])('Q7: a malformed canMoveItem result (%s) denies with one diagnostic and skips canDropItem', (_label, value) => {
        const {latest, draft} = berlin();
        const canDropItem = vi.fn(() => true as const);
        const result = evaluateMoveTarget(draft, latest, '2026-03-30', 'keyboard', {canMoveItem: () => value as never, canDropItem}, dates);
        expect(result).toStrictEqual({kind: 'blocked', startDate: '2026-03-30',
            block: {kind: 'policy', reason: undefined, diagnostic: {path: 'interactionPolicy.canMoveItem', reason: malformed}}});
        expect(canDropItem).not.toHaveBeenCalled();
    });
    it('Q7: a fold offset stays on a policy-blocked target', () => {
        const latest = latestOf(commitOf({items: [itemOf(moment('2026-10-24T02:30:00+02:00'))], timeZone: 'Europe/Berlin'}));
        const result = evaluateMoveTarget(startMoveDraft(latest, 'Europe/Berlin', {kind: 'start'}), latest, '2026-10-25', 'keyboard',
            {canDropItem: () => ({allowed: false, reason: 'Closed'})}, dates);
        expect(result).toStrictEqual({kind: 'blocked', block: {kind: 'policy', reason: 'Closed'}, startDate: '2026-10-25', foldOffset: 7_200_000});
        expect(formatUtcOffset(result.foldOffset!)).toBe('+02:00');
    });
    it('Q7: a throwing callback propagates the same error and leaves the draft open', () => {
        const {latest, draft} = berlin();
        const failure = new Error('policy failure');
        let thrown: unknown;
        try { evaluateMoveTarget(draft, latest, '2026-03-30', 'keyboard', {canDropItem() { throw failure; }}, dates); } catch (error) { thrown = error; }
        expect(thrown).toBe(failure);
        expect(() => evaluateMoveTarget(draft, latest, '2026-03-30', 'keyboard', {canMoveItem() { throw failure; }}, dates)).toThrow(failure);
        expect(reconcileMoveDraft(draft, commitOf({items: [latest.item], timeZone: 'Europe/Berlin'})).draft).toBe(draft);
    });
});

describe('purity', () => {
    it('uses an item data fixture that throws on any read', () => {
        const data = sealed() as Record<string, unknown>;
        expect(() => data.anything).toThrow(/data was read/);
        expect(() => ({...data})).toThrow(/data was read/);
        expect(() => JSON.stringify(data)).toThrow(/data was read/);
        expect(() => structuredClone(data)).toThrow();
    });
    it.each(['move.ts', 'policy.ts'])('%s imports only core modules and reads no clock, console, crypto or DOM', file => {
        const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
        const imports = [...source.matchAll(/from '([^']+)'/g)].map(match => match[1]);
        expect(imports.filter(path => path !== '../reference.js' && !/^\.\/(date|formatting|messages|policy|projection|validation)\.js$/.test(path))).toEqual([]);
        expect(source).not.toMatch(/\b(console|crypto|window|document|navigator|performance|setTimeout|Math\.random|Date\.now|new Date)\b/);
    });
});
