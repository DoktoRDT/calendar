import type {CalendarDateRange, CalendarInteractionPolicy} from '../reference.js';
import {addCalendarDays} from './date.js';
import {normalizePolicyResult} from './policy.js';

/**
 * Pure date and range selection (#11): normalization, the check pipeline, value equality and the draft transitions. A
 * range is a date-only half-open interval like an all-day item: `end` is the day after the last included date.
 */
export type SelectionPolicy = Pick<CalendarInteractionPolicy, 'canSelectDate' | 'canSelectRange'> | undefined;
/** `boundary`: the core block (`selectionBoundaryReason`), which no policy overrides. A policy `reason` of undefined is shown as `genericBlockedReason`. */
export type SelectionBlock = Readonly<{kind: 'boundary'}> | Readonly<{kind: 'policy'; reason: string | undefined}>;
/** A malformed policy result's development diagnostic; the controller's `warn` prints it once per path and text. */
export type PolicyDiagnostic = Readonly<{path: string; reason: string}>;
export type SelectionOutcome = Readonly<{block: SelectionBlock | null; diagnostic?: PolicyDiagnostic}>;
/** A transient draft: range mode (the Select range command, or a blocked drop) or a held desktop drag. */
export type SelectionDraft = Readonly<{mode: 'range' | 'drag'; anchor: string | null; endpoint: string | null}>;
/** The last request still waiting for props: a range, or null from Clear selection. */
export type SelectionRequest = Readonly<{value: CalendarDateRange | null}>;

/** Viewable in the agenda, never selectable: its exclusive end is not a representable ISODate. */
const lastDate = '9999-12-31';
const boundary: SelectionBlock = Object.freeze({kind: 'boundary'});
const open: SelectionOutcome = Object.freeze({block: null});
export const rangeMode: SelectionDraft = Object.freeze({mode: 'range', anchor: null, endpoint: null});

/** `start = min(anchor, endpoint)`, `end` the day after the later one; null when that day is past 9999-12-31. */
export function selectionRange(anchor: string, endpoint: string): CalendarDateRange | null {
    // YYYY-MM-DD strings of 0001…9999 compare chronologically as strings.
    const [start, last] = anchor <= endpoint ? [anchor, endpoint] : [endpoint, anchor];
    return last === lastDate ? null : {start, end: addCalendarDays(last, 1)};
}
/** Ranges compare by `start` and `end`, never by identity; null is "nothing selected". */
export const sameRange = (a: CalendarDateRange | null, b: CalendarDateRange | null) => a === b || !!a && !!b && a.start === b.start && a.end === b.end;

function policyStep(result: unknown, path: string): SelectionOutcome {
    const outcome = normalizePolicyResult(result, path);
    if (outcome.allowed) return open;
    return {block: {kind: 'policy', reason: outcome.reason}, ...(outcome.diagnostic ? {diagnostic: outcome.diagnostic} : {})};
}
/** The checks of one date: the core boundary, then `canSelectDate`. Also the day state of a date cell (decision Q4). */
export function checkDate(date: string, policy: SelectionPolicy): SelectionOutcome {
    if (date === lastDate) return {block: boundary};
    return policy?.canSelectDate ? policyStep(policy.canSelectDate(date), 'interactionPolicy.canSelectDate') : open;
}
/**
 * The pipeline of decision Q6 for a representable range: `canSelectDate` for every included date `start ≤ date < end` in
 * chronological order (never the exclusive end), then `canSelectRange`, also for a single day. The first block wins.
 */
export function checkRange(range: CalendarDateRange, policy: SelectionPolicy): SelectionOutcome {
    // A representable range never includes 9999-12-31, so without canSelectDate no date can block.
    if (policy?.canSelectDate) for (let date = range.start; date < range.end; date = addCalendarDays(date, 1)) {
        const outcome = checkDate(date, policy);
        if (outcome.block) return outcome;
    }
    return policy?.canSelectRange ? policyStep(policy.canSelectRange({start: range.start, end: range.end}), 'interactionPolicy.canSelectRange') : open;
}
/** Normalizes an anchor and an endpoint and checks the result; a range that would end past 9999-12-31 is the core block. */
export function checkSelection(anchor: string, endpoint: string, policy: SelectionPolicy): SelectionOutcome & Readonly<{range: CalendarDateRange | null}> {
    const range = selectionRange(anchor, endpoint);
    return range ? {range, ...checkRange(range, policy)} : {range, block: boundary};
}

/** The normalized range of a draft with an anchor; range mode before an anchor has none. */
export const draftRange = (draft: SelectionDraft | null) => draft?.anchor && draft.endpoint ? selectionRange(draft.anchor, draft.endpoint) : null;
/** A focus or pointer move: after an anchor it moves the endpoint; before one it changes nothing (decision Q14). */
export const moveEndpoint = (draft: SelectionDraft, date: string): SelectionDraft => draft.anchor === null || draft.endpoint === date ? draft : {...draft, endpoint: date};
/** An activation in range mode: the first sets the anchor (one day); later ones set the endpoint they then confirm. */
export const activateDraft = (draft: SelectionDraft, date: string): SelectionDraft => draft.anchor === null ? {...draft, anchor: date, endpoint: date} : moveEndpoint(draft, date);

/**
 * A committed `selection` against the previously committed value. Props that first equal the last still-current
 * request accept it (decisions Q8 and Q12); any other new value is external and drops the request.
 */
export function reconcileSelection(previous: CalendarDateRange | null, next: CalendarDateRange | null, pending: SelectionRequest | null): 'unchanged' | 'accepted' | 'external' {
    if (sameRange(previous, next)) return 'unchanged';
    return pending && sameRange(pending.value, next) ? 'accepted' : 'external';
}
