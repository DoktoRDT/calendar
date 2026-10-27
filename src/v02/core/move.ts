import type {CalendarInteractionPolicy, CalendarInterval, CalendarItem, CalendarMoveInput, CalendarMoveProposal, CalendarWeekday} from '../reference.js';
import {
    MAX_INSTANT, UTC_DAY_MS, intervalsEqual, parseISODate, type CanonicalInterval, type GregorianProjection, type WallTime, type createDateAdapter,
} from './date.js';
import {getCalendarVisibleRange} from './formatting.js';
import {snapshotItemTitle} from './messages.js';
import {normalizePolicyResult} from './policy.js';
import {MAX_DAY, MIN_DAY, dateToDay, dayToDate} from './projection.js';
import type {ValidatedItem} from './validation.js';

// The move proposal core (#9): pure date math and draft lifetime shared by every move input. No React, DOM, clock or logging.
type Dates = ReturnType<typeof createDateAdapter>;

/** Where the day shift is measured from: the presentation the move started in, not the device (rule 1). */
export type MoveOrigin =
    | Readonly<{kind: 'grid'; grabDate: string}> // Month grid drag: the date cell grabbed, on any segment of the bar
    | Readonly<{kind: 'start'}>; // DayAgenda drag (inline, popover, sheet) and the Move command

/** Everything a draft keeps between renders (rule 7): never the item object or its `data`. */
export type MoveDraft = Readonly<{
    itemId: string;
    interval: CanonicalInterval; // ValidatedItem.interval at draft start
    timeZone: string; // the exact accepted Calendar.timeZone at draft start
    title: string; // raw item.title at draft start, resolved through untitledItemLabel when spoken
    origin: MoveOrigin;
}>;

type PolicyPath = 'interactionPolicy.canMoveItem' | 'interactionPolicy.canDropItem';
/** The shape of ControllerDiagnostic; core must not import src/v02/calendar. */
export type PolicyDiagnostic = Readonly<{path: PolicyPath; reason: string}>;

export type MoveBlock =
    | Readonly<{kind: 'gap'; wall: WallTime}> // moveDstGapReason(wall.date, localTime)
    | Readonly<{kind: 'boundary'}> // moveBoundaryReason
    // reason undefined: a malformed policy result, a blank reason included (Q7); show genericBlockedReason
    | Readonly<{kind: 'policy'; reason: string | undefined; diagnostic?: PolicyDiagnostic}>;

/**
 * `startDate`: the proposed start date the preview shows (the origin date for a no-op), null only outside 0001…9999.
 * `foldOffset`: the offset of the chosen start instant in Calendar.timeZone, present only when its wall time occurs twice.
 */
export type MoveTarget<I> =
    | Readonly<{kind: 'noop'; item: CalendarItem<I>; startDate: string | null; foldOffset?: number}>
    | Readonly<{kind: 'blocked'; block: MoveBlock; startDate: string | null; foldOffset?: number}>
    | Readonly<{kind: 'allowed'; proposal: CalendarMoveProposal<I>; startDate: string; foldOffset?: number}>;

/** What one committed render hands the draft. */
export type MoveCommit<I, S> =
    | Readonly<{kind: 'contract'}>
    | Readonly<{kind: 'data'; blocking: boolean; timeZone: string; visible: ReadonlyMap<string, ValidatedItem<I, S>>}>;

export type MoveCancelReason = 'blocking' | 'unavailable' | 'timeZone' | 'interval';

export type MoveStep<I, S> =
    | Readonly<{draft: MoveDraft; outcome: Readonly<{kind: 'keep'; latest: ValidatedItem<I, S>}>}>
    | Readonly<{draft: null; outcome: Readonly<{kind: 'cancel'; reason: MoveCancelReason}>}>
    | Readonly<{draft: null; outcome: null}>; // there was no open draft

const wallOn = (date: string, local: GregorianProjection): WallTime =>
    ({date, hour: local.hour, minute: local.minute, second: local.second, millisecond: local.millisecond});

/** The date a move starts from: allDay.start, or the timed start projected into Calendar.timeZone (null outside 0001…9999). */
export function moveOriginDate(interval: CanonicalInterval, timeZone: string, dates: Dates): string | null {
    return interval.kind === 'allDay' ? interval.start : dates.projectInstant(interval.start, timeZone).date;
}

const gridBounds = new Map<CalendarWeekday, Readonly<{first: string; end: string}>>();
/** Whether a date is a cell of any supported Month grid (anchor months February 0001 to November 9999) for this week start. */
export function isInSupportedMonthGrid(date: string, firstDayOfWeek: CalendarWeekday): boolean {
    parseISODate(date);
    let bounds = gridBounds.get(firstDayOfWeek);
    if (!bounds) {
        bounds = {first: getCalendarVisibleRange({anchorDate: '0001-02-01', timeZone: 'UTC', firstDayOfWeek}).start,
            end: getCalendarVisibleRange({anchorDate: '9999-11-01', timeZone: 'UTC', firstDayOfWeek}).end};
        gridBounds.set(firstDayOfWeek, bounds);
    }
    return bounds.first <= date && date < bounds.end;
}

/** The `utcOffset` of moveTargetAnnouncement (Q2): ±HH:MM, plus :SS only when non-zero; never Z or -00:00, never rounded. */
export function formatUtcOffset(offset: number): string {
    if (!Number.isInteger(offset / 1000) || Math.abs(offset) >= UTC_DAY_MS) throw new RangeError('Expected a whole-second offset below 24 h');
    const total = Math.abs(offset) / 1000, seconds = total % 60, pad = (value: number) => String(value).padStart(2, '0');
    return `${offset < 0 ? '-' : '+'}${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}${seconds ? `:${pad(seconds)}` : ''}`;
}

export function startMoveDraft<I, S>(latest: ValidatedItem<I, S>, timeZone: string, origin: MoveOrigin): MoveDraft {
    return {itemId: latest.item.id, interval: latest.interval, timeZone, title: snapshotItemTitle(latest.item), origin};
}

const idle = Object.freeze({draft: null, outcome: null});
const cancel = (reason: MoveCancelReason) => ({draft: null, outcome: {kind: 'cancel', reason}} as const);
/**
 * One step per committed render (rule 9), the first match wins: blocking, unavailable, time zone, interval, else keep.
 * `keep` returns the same draft object; feed the returned draft into the next call, so a cancelled draft stays null.
 */
export function reconcileMoveDraft<I, S>(draft: MoveDraft | null, commit: MoveCommit<I, S>): MoveStep<I, S> {
    if (!draft) return idle;
    if (commit.kind === 'contract' || commit.blocking) return cancel('blocking');
    // Looked up among all valid, filter-passing items: an item outside the visible range is still available.
    const latest = commit.visible.get(draft.itemId);
    if (!latest) return cancel('unavailable');
    if (commit.timeZone !== draft.timeZone) return cancel('timeZone');
    if (!intervalsEqual(latest.interval, draft.interval)) return cancel('interval');
    return {draft, outcome: {kind: 'keep', latest}};
}

/**
 * The preview of a target and the final check at confirm (rules 1–6 and 10), in the order of Q5: core boundary and gap
 * blocks, then canMoveItem(latest item), then canDropItem(proposal). A zero shift is a no-op before any policy call (Q4).
 * A throwing policy callback is not caught.
 */
export function evaluateMoveTarget<I, S>(draft: MoveDraft, latest: ValidatedItem<I, S>, target: string, input: CalendarMoveInput,
    policy: CalendarInteractionPolicy<I> | undefined, dates: Dates): MoveTarget<I> {
    const zone = draft.timeZone, interval = latest.interval, origin = draft.origin;
    const local = interval.kind === 'timed' ? dates.projectInstant(interval.start, zone) : undefined;
    const originDate = interval.kind === 'allDay' ? interval.start : local!.date;
    // A local start outside the ISO domain (0000-12-31 or 10000-01-01) is the day next to it, never a year-0 date string (Q6).
    const originDay = originDate !== null ? dateToDay(originDate) : local!.year < 1 ? MIN_DAY - 1 : MAX_DAY + 1;
    // Rule 1: a grid drag keeps the grab offset; an agenda drag and the Move command name the new start date.
    const day = origin.kind === 'grid' ? originDay + dateToDay(target) - dateToDay(origin.grabDate) : dateToDay(target);
    if (day === originDay) {
        // Q3: the offset of the latest start itself when its wall time occurs twice; the no-op builds no interval.
        const fold = local && originDate !== null && dates.resolveWallTimeResult(wallOn(originDate, local), zone);
        return {kind: 'noop', item: latest.item, startDate: originDate, ...(fold && fold.kind === 'instant' && fold.fold ? {foldOffset: local.offsetMilliseconds} : {})};
    }
    const blocked = (block: MoveBlock, startDate: string | null): MoveTarget<I> => ({kind: 'blocked', block, startDate});
    if (day < MIN_DAY || day > MAX_DAY) return blocked({kind: 'boundary'}, null);
    const startDate = dayToDate(day);
    let proposedInterval: CalendarInterval, foldOffset: number | undefined;
    if (interval.kind === 'allDay') {
        const end = dateToDay(interval.end) + day - originDay;
        if (end > MAX_DAY) return blocked({kind: 'boundary'}, startDate);
        proposedInterval = {kind: 'allDay', start: startDate, end: dayToDate(end)};
    } else {
        // Rule 3: keep the wall time in Calendar.timeZone on the new date; never move a gap to the next valid time.
        const wall = wallOn(startDate, local!);
        const resolved = dates.resolveWallTimeResult(wall, zone);
        if (resolved.kind === 'gap') return blocked({kind: 'gap', wall}, startDate);
        if (resolved.kind === 'outsideDomain') return blocked({kind: 'boundary'}, startDate);
        // The end keeps the elapsed duration and is not resolved as a wall time again.
        const start = resolved.instant, end = interval.end === undefined ? undefined : start + interval.end - interval.start;
        if (end !== undefined && end > MAX_INSTANT) return blocked({kind: 'boundary'}, startDate);
        // Rule 4: each boundary in the author zone when there is one; the author zone is copied, never added.
        const author = interval.timeZone ?? zone;
        proposedInterval = {kind: 'timed', start: dates.serializeInstant(start, author), ...(end === undefined ? {} : {end: dates.serializeInstant(end, author)}),
            ...(interval.timeZone === undefined ? {} : {timeZone: interval.timeZone})};
        if (resolved.fold) foldOffset = dates.projectInstant(start, zone).offsetMilliseconds;
    }
    const fold = foldOffset === undefined ? {} : {foldOffset};
    const proposal: CalendarMoveProposal<I> = {item: latest.item, previousInterval: latest.item.interval, proposedInterval, input};
    const denial = (path: PolicyPath, call: () => unknown): MoveBlock | undefined => {
        const result = normalizePolicyResult(call(), path);
        return result.allowed ? undefined : {kind: 'policy', reason: result.reason, ...(result.diagnostic ? {diagnostic: result.diagnostic} : {})};
    };
    const canMoveItem = policy?.canMoveItem, canDropItem = policy?.canDropItem;
    const block = (canMoveItem && denial('interactionPolicy.canMoveItem', () => canMoveItem.call(policy, latest.item)))
        || (canDropItem && denial('interactionPolicy.canDropItem', () => canDropItem.call(policy, proposal)));
    return block ? {kind: 'blocked', block, startDate, ...fold} : {kind: 'allowed', proposal, startDate, ...fold};
}
