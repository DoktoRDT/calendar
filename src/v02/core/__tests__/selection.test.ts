// @vitest-environment node
import {describe, expect, it, vi} from 'vitest';
import type {CalendarDateRange, PolicyResult} from '../../reference.js';
import {activateDraft, checkDate, checkRange, checkSelection, draftRange, moveEndpoint, rangeMode, reconcileSelection, sameRange, selectionRange,
    type SelectionPolicy} from '../selection.js';

const range = (start: string, end: string): CalendarDateRange => ({start, end});
const blockedOn = (...dates: string[]) => ({canSelectDate: (date: string): PolicyResult => dates.includes(date) ? {allowed: false, reason: `Closed ${date}`} : true});

describe('selection core (#11)', () => {
    it.each([
        ['2026-09-10', '2026-09-03', range('2026-09-03', '2026-09-11')],
        ['2026-09-03', '2026-09-10', range('2026-09-03', '2026-09-11')],
        ['2026-09-03', '2026-09-03', range('2026-09-03', '2026-09-04')],
        ['2026-01-20', '2026-02-28', range('2026-01-20', '2026-03-01')],
        ['2028-02-28', '2028-02-29', range('2028-02-28', '2028-03-01')],
        ['9999-12-30', '9999-12-29', range('9999-12-29', '9999-12-31')],
        ['0001-01-01', '0001-01-01', range('0001-01-01', '0001-01-02')],
    ])('normalizes anchor %s and endpoint %s to a half-open range', (anchor, endpoint, expected) => {
        expect(selectionRange(anchor, endpoint)).toEqual(expected);
    });
    it('cannot represent a range that includes 9999-12-31', () => {
        expect(selectionRange('9999-12-31', '9999-12-31')).toBeNull();
        expect(selectionRange('9999-12-20', '9999-12-31')).toBeNull();
    });
    it('compares ranges by value', () => {
        expect(sameRange(range('2026-09-03', '2026-09-04'), {start: '2026-09-03', end: '2026-09-04'})).toBe(true);
        expect(sameRange(range('2026-09-03', '2026-09-04'), range('2026-09-03', '2026-09-05'))).toBe(false);
        expect(sameRange(null, null)).toBe(true); expect(sameRange(null, range('2026-09-03', '2026-09-04'))).toBe(false);
    });
    describe('check pipeline (decision Q6)', () => {
        it('never checks the exclusive end: one day with only the next day blocked is allowed', () => {
            const policy = blockedOn('2026-09-04');
            expect(checkSelection('2026-09-03', '2026-09-03', policy)).toEqual({range: range('2026-09-03', '2026-09-04'), block: null});
            expect(checkSelection('2026-09-03', '2026-09-04', policy).block).toEqual({kind: 'policy', reason: 'Closed 2026-09-04'});
        });
        it('cannot skip a blocked day inside a range', () => {
            expect(checkSelection('2026-09-01', '2026-09-30', blockedOn('2026-09-15')).block).toEqual({kind: 'policy', reason: 'Closed 2026-09-15'});
        });
        it('checks every included date in chronological order, then the range; the first block wins', () => {
            const calls: string[] = [];
            const policy: SelectionPolicy = {
                canSelectDate: date => { calls.push(date); return date === '2026-09-05' ? {allowed: false, reason: 'Fifth'} : true; },
                canSelectRange: value => { calls.push(`range ${value.start}/${value.end}`); return true; },
            };
            expect(checkSelection('2026-09-06', '2026-09-03', policy).block).toEqual({kind: 'policy', reason: 'Fifth'});
            expect(calls).toEqual(['2026-09-03', '2026-09-04', '2026-09-05']);
            calls.length = 0;
            expect(checkSelection('2026-09-03', '2026-09-04', policy).block).toBeNull();
            expect(calls).toEqual(['2026-09-03', '2026-09-04', 'range 2026-09-03/2026-09-05']);
        });
        it('runs canSelectRange for a single day too, with a fresh range object', () => {
            const accepted = range('2026-09-03', '2026-09-04'), canSelectRange = vi.fn((_value: CalendarDateRange): PolicyResult => ({allowed: false, reason: 'Too short'}));
            expect(checkRange(accepted, {canSelectRange}).block).toEqual({kind: 'policy', reason: 'Too short'});
            expect(canSelectRange).toHaveBeenCalledExactlyOnceWith(accepted);
            expect(canSelectRange.mock.calls[0][0]).not.toBe(accepted);
        });
        it('blocks 9999-12-31 with the core boundary and calls no policy', () => {
            const canSelectDate = vi.fn((): PolicyResult => true), canSelectRange = vi.fn((): PolicyResult => true);
            expect(checkSelection('9999-12-31', '9999-12-31', {canSelectDate, canSelectRange})).toEqual({range: null, block: {kind: 'boundary'}});
            expect(checkDate('9999-12-31', {canSelectDate})).toEqual({block: {kind: 'boundary'}});
            expect(canSelectDate).not.toHaveBeenCalled(); expect(canSelectRange).not.toHaveBeenCalled();
            expect(checkDate('9999-12-30', {canSelectDate})).toEqual({block: null});
        });
        it('turns a malformed result into a denial with a diagnostic and stops there', () => {
            const canSelectRange = vi.fn((): PolicyResult => true);
            const result = checkSelection('2026-09-03', '2026-09-05', {canSelectDate: () => ({allowed: false, reason: ' '}), canSelectRange});
            expect(result.block).toEqual({kind: 'policy', reason: undefined});
            expect(result.diagnostic).toEqual({path: 'interactionPolicy.canSelectDate', reason: expect.stringContaining('treating the result as a denial')});
            expect(canSelectRange).not.toHaveBeenCalled();
            expect(checkRange(range('2026-09-03', '2026-09-04'), {canSelectRange: () => false as unknown as PolicyResult}).diagnostic?.path).toBe('interactionPolicy.canSelectRange');
        });
        it('lets a throwing callback propagate', () => {
            const error = new Error('policy failed');
            expect(() => checkDate('2026-09-03', {canSelectDate: () => { throw error; }})).toThrow(error);
        });
        it('allows everything without a policy', () => {
            expect(checkSelection('2026-09-03', '2026-12-03', undefined).block).toBeNull();
        });
    });
    describe('draft transitions', () => {
        it('range mode before an anchor has no range; focus moves change nothing until the first activation', () => {
            expect(draftRange(rangeMode)).toBeNull();
            expect(moveEndpoint(rangeMode, '2026-09-03')).toBe(rangeMode);
            const anchored = activateDraft(rangeMode, '2026-09-10');
            expect(anchored).toEqual({mode: 'range', anchor: '2026-09-10', endpoint: '2026-09-10'});
            expect(draftRange(anchored)).toEqual(range('2026-09-10', '2026-09-11'));
        });
        it('later activations and focus moves set the endpoint; the anchor never moves', () => {
            const anchored = activateDraft(rangeMode, '2026-09-10'), moved = moveEndpoint(anchored, '2026-09-03');
            expect(moved).toEqual({mode: 'range', anchor: '2026-09-10', endpoint: '2026-09-03'});
            expect(draftRange(moved)).toEqual(range('2026-09-03', '2026-09-11'));
            expect(activateDraft(moved, '2026-09-12')).toEqual({mode: 'range', anchor: '2026-09-10', endpoint: '2026-09-12'});
            expect(moveEndpoint(moved, '2026-09-03')).toBe(moved);
        });
    });
    describe('acceptance of the pending request (decisions Q8, Q12)', () => {
        const a = range('2026-09-03', '2026-09-04'), b = range('2026-09-10', '2026-09-11');
        it.each([
            ['an unchanged value (a new object with the same dates)', a, {...a}, {value: b}, 'unchanged'],
            ['props first equal to the request', null, {...b}, {value: b}, 'accepted'],
            ['a Clear request accepted', a, null, {value: null}, 'accepted'],
            ['another value while a request waits', null, a, {value: b}, 'external'],
            ['a change without a request', a, b, null, 'external'],
        ] as const)('%s', (_label, previous, next, pending, expected) => {
            expect(reconcileSelection(previous, next, pending)).toBe(expected);
        });
    });
});
