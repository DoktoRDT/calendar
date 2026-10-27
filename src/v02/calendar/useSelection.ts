import {useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type RefObject} from 'react';
import type {CalendarDateRange} from '../reference.js';
import type {LocalizedText} from '../core/formatting.js';
import type {PolicyDiagnostic} from '../core/policy.js';
import {inRange} from '../core/controller.js';
import {activateDraft, checkDate, checkRange, checkSelection, draftRange, moveEndpoint, rangeMode, reconcileSelection, sameRange,
    type SelectionBlock, type SelectionDraft, type SelectionOutcome, type SelectionRequest} from '../core/selection.js';
import {activeElement, focusElement} from './dom.js';
import type {CalendarDataModel, CalendarModel} from './model.js';
import type {OverlayStackController} from './overlays.js';

const useClientLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;
/** CSS px a desktop press travels, over another date cell, before it becomes a range drag (decision Q5; shared with the move drag of #13, not API). */
export const dragThreshold = 4;

type Data = CalendarDataModel<unknown, unknown>;
type Target = Readonly<{range: CalendarDateRange; allowed: boolean}>;
type Transition = {kind: 'start' | 'target' | 'other'; texts: readonly LocalizedText[]};
/** The speech of one commit: its polite transitions in order (written as one payload) and the latest urgent block. */
type Queue = {polite: Transition[]; urgent?: readonly LocalizedText[]};
type Press = {pointer: number; date: string; x: number; y: number; recognized: boolean; done: AbortController};
export type SelectionOptions = {
    overlays: OverlayStackController; warn: (path: string, reason: string) => void;
    rootRef: RefObject<HTMLElement | null>; gridRef: RefObject<HTMLElement | null>; weekdaysRef: RefObject<HTMLElement | null>;
    getDateCell: (date: string) => HTMLElement | undefined; focusDate: string | null; agendaDate: string | null;
    /** The move integration (#13) sets it while a move draft is open: Select range, Select day, Space and Create are then unavailable. */
    moveDraftActive?: boolean;
};

/** Diagnostics of render-time policy calls, printed after the commit that rendered them (decision Q6). */
function createDiagnostics() {
    const pending: PolicyDiagnostic[] = [];
    return {note: (outcome: SelectionOutcome) => { if (outcome.diagnostic) pending.push(outcome.diagnostic); return outcome.block; }, drain: () => pending.splice(0)};
}
const sameTarget = (a: Target | null, b: Target | null) => a === b || !!a && !!b && a.allowed === b.allowed && sameRange(a.range, b.range);
/** The text of a block: `unavailableReason`, and the argument of `blockedAnnouncement`. */
export const blockReason = (model: Data, block: SelectionBlock) => block.kind === 'boundary' ? model.message('selectionBoundaryReason').text
    : block.reason ?? model.message('genericBlockedReason').text;

/**
 * Date and range selection (#11). Three pieces of state stay apart: the accepted selection (the `selection` prop only), the
 * transient draft and the pending acceptance, which only decides the completion or cleared announcement. Callbacks run
 * in handlers only; announcements are queued and written after the commit, merged with the controller's own payload.
 */
export function useSelection<I, S>(model: CalendarModel<I, S>, options: SelectionOptions) {
    const {overlays, warn, rootRef, gridRef, weekdaysRef, getDateCell, focusDate, agendaDate, moveDraftActive = false} = options;
    const data = model.kind === 'data' ? model as unknown as Data : null, props = data?.props;
    const enabled = !!props && props.selection !== undefined, accepted = props?.selection ?? null, policy = props?.interactionPolicy;
    const [stored, setStored] = useState<SelectionDraft | null>(null);
    // A removed pair or a blocking state stops showing the draft at once; the commit then drops it for good.
    const draft = enabled && !model.blocking ? stored : null;
    // The line kept after a blocked single-date Space; `date` names the date whose reason it shows (decision Q3).
    const [space, setSpace] = useState<{date: string | null} | null>(null);
    // A Create block found only by the last-moment check; shown until the props change (decision Q13).
    const [pressBlock, setPressBlock] = useState<{model: unknown; block: SelectionBlock} | null>(null);
    const [, requestFlush] = useReducer((value: number) => value + 1, 0);
    const [diagnostics] = useState(createDiagnostics);
    const draftRef = useRef<SelectionDraft | null>(null), queue = useRef<Queue>({polite: []}), pending = useRef<SelectionRequest | null>(null);
    const previous = useRef<CalendarDateRange | null | undefined>(undefined), target = useRef<Target | null>(null);
    const press = useRef<Press | null>(null), quiet = useRef<string | null>(null), committed = useRef<CalendarModel<I, S>>(model);
    useClientLayoutEffect(() => { committed.current = model; });

    const range = draftRange(draft), rangeOpen = draft?.mode === 'range';
    const dateBlock = (date: string) => enabled ? diagnostics.note(checkDate(date, policy)) : null;
    const targetBlock = range ? diagnostics.note(checkRange(range, policy)) : null;
    const spaceBlock = enabled && space?.date ? diagnostics.note(checkSelection(space.date, space.date, policy)) : null;
    const createBlock = enabled && props?.onCreateRequest && accepted
        ? diagnostics.note(checkRange(accepted, policy)) ?? (pressBlock?.model === model ? pressBlock.block : null) : null;
    // The mode line: range mode with its target reason and Cancel; otherwise a kept Space line and Create's reason, which a
    // held drag leaves in place so the grid never moves under the pointer.
    const line = !enabled || model.blocking ? null : rangeOpen ? {kind: 'range' as const, reason: targetBlock, create: null}
        : space || createBlock ? {kind: 'idle' as const, reason: spaceBlock, create: createBlock} : null;

    const update = (next: SelectionDraft | null) => { draftRef.current = next; setStored(next); };
    const enqueue = (polite?: Transition, urgent?: readonly LocalizedText[]) => {
        const queued = queue.current.polite, last = queued[queued.length - 1] as Transition | undefined;
        // Several transitions of one commit are spoken together. A newer target replaces only the older target, also the
        // target part of a start payload, which is never replaced itself.
        if (polite?.kind === 'target' && last?.kind === 'target') queued[queued.length - 1] = polite;
        else if (polite?.kind === 'target' && last?.kind === 'start') queued[queued.length - 1] = {kind: 'start', texts: [last.texts[0], ...polite.texts]};
        else if (polite) queued.push(polite);
        if (urgent) queue.current.urgent = urgent;
    };
    const announce = (polite?: Transition, urgent?: readonly LocalizedText[]) => { enqueue(polite, urgent); requestFlush(); };
    const report = (outcome: SelectionOutcome) => { if (outcome.diagnostic) warn(outcome.diagnostic.path, outcome.diagnostic.reason); return outcome.block; };
    /** The latest committed model while selection can act: data, the pair present and not blocking. */
    const current = () => { const latest = committed.current; return latest.kind === 'data' && latest.props.selection !== undefined && !latest.blocking ? latest as unknown as Data : null; };
    const blocked = (latest: Data, block: SelectionBlock) => announce(undefined, [latest.message('blockedAnnouncement', blockReason(latest, block))]);

    const endPress = () => {
        const held = press.current;
        if (!held) return;
        press.current = null; held.done.abort();
        const grid = gridRef.current;
        if (!held.recognized || !grid) return;
        if (grid.hasPointerCapture?.(held.pointer)) grid.releasePointerCapture(held.pointer);
        grid.style.removeProperty('user-select'); grid.style.removeProperty('-webkit-user-select');
    };
    const cancel = (explicit: boolean) => {
        endPress();
        if (!draftRef.current) return;
        update(null); target.current = null;
        const latest = committed.current;
        if (explicit && latest.kind === 'data') announce({kind: 'other', texts: [latest.message('selectionCancelledAnnouncement')]});
    };
    const cancelRef = useRef(cancel);
    useClientLayoutEffect(() => { cancelRef.current = cancel; });
    /** Silent cancellation: an external change, or a move starting (#13). */
    const cancelDraft = useCallback(() => cancelRef.current(false), []);
    /** An allowed completion requests the range once and closes the draft; one equal to the accepted props is a silent no-op. */
    const complete = (latest: Data, value: CalendarDateRange) => {
        update(null); target.current = null;
        if (sameRange(value, latest.props.selection ?? null)) return;
        pending.current = {value};
        latest.props.onSelectionChange?.({start: value.start, end: value.end});
    };
    /** Space outside range mode and Select day: `[date, next day)` at once, without a draft. Returns the block, if any. */
    const propose = (date: string) => {
        const latest = current();
        if (!latest || draftRef.current || moveDraftActive) return null;
        const result = checkSelection(date, date, latest.props.interactionPolicy), block = report(result);
        if (block) { blocked(latest, block); return block; }
        if (result.range && !sameRange(result.range, latest.props.selection ?? null)) {
            pending.current = {value: result.range};
            latest.props.onSelectionChange?.({start: result.range.start, end: result.range.end});
        }
        return null;
    };
    /** Space or Enter, a click or a tap in range mode: the first sets the anchor, a later one completes at its date. */
    const activate = (date: string) => {
        const latest = current(), held = draftRef.current;
        if (!latest || !held) return;
        const next = activateDraft(held, date), result = checkSelection(next.anchor!, next.endpoint!, latest.props.interactionPolicy), block = report(result);
        if (held.anchor === null) {
            if (!result.range) return;
            update(next); target.current = {range: result.range, allowed: !block};
            announce({kind: 'start', texts: [latest.message('selectionStartedAnnouncement', date), latest.message('selectionTargetAnnouncement', result.range, !block)]});
            return;
        }
        if (!block && result.range) { complete(latest, result.range); return; }
        // A blocked confirmation keeps the draft with that date as endpoint; only the urgent block speaks.
        update(next);
        if (result.range) target.current = {range: result.range, allowed: false};
        if (block) blocked(latest, block);
    };
    const hit = (x: number, y: number) => {
        const grid = gridRef.current, box = grid?.getBoundingClientRect(), weekdays = weekdaysRef.current?.getBoundingClientRect();
        if (!grid || !box || x < box.left || x >= box.right || y < box.top || y >= box.bottom || (weekdays && y < weekdays.bottom)) return null;
        for (const cell of grid.querySelectorAll<HTMLElement>('[role=gridcell][data-date]')) {
            const rect = cell.getBoundingClientRect();
            if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) return cell.dataset.date!;
        }
        return null;
    };
    /** The click that follows a recognized drag never views a day or presses an item. */
    const suppressClick = () => {
        const root = rootRef.current;
        if (!root) return;
        const stop = (event: Event) => { event.stopPropagation(); event.preventDefault(); };
        root.addEventListener('click', stop, {capture: true, once: true});
        // The click of a release follows its pointerup in the same task; a later click, such as a virtual one, is not the drop's.
        root.ownerDocument.defaultView?.setTimeout(() => root.removeEventListener('click', stop, true), 0);
    };
    /** Focus moves to the endpoint without scrolling; MonthView skips its scroll for this one focus. */
    const focusQuietly = (date: string) => {
        const cell = getDateCell(date);
        if (!cell || activeElement(cell.ownerDocument) === cell) return;
        quiet.current = date;
        if (!focusElement(cell)) quiet.current = null;
    };
    const recognize = (held: Press, over: string) => {
        const latest = current();
        if (!latest) { endPress(); return; }
        held.recognized = true;
        const grid = gridRef.current;
        if (grid && typeof grid.setPointerCapture === 'function') grid.setPointerCapture(held.pointer);
        // A recognized drag selects dates, not text; a press that never becomes one keeps the native text selection.
        grid?.style.setProperty('user-select', 'none'); grid?.style.setProperty('-webkit-user-select', 'none');
        grid?.ownerDocument.getSelection()?.removeAllRanges();
        const next: SelectionDraft = {mode: 'drag', anchor: held.date, endpoint: over}, value = draftRange(next)!;
        const block = report(checkRange(value, latest.props.interactionPolicy));
        update(next); target.current = {range: value, allowed: !block};
        announce({kind: 'start', texts: [latest.message('selectionStartedAnnouncement', held.date), latest.message('selectionTargetAnnouncement', value, !block)]});
    };
    const release = (held: Press, event: globalThis.PointerEvent) => {
        const recognized = held.recognized, dragged = draftRef.current, date = recognized ? hit(event.clientX, event.clientY) ?? dragged?.endpoint : null;
        endPress();
        const latest = current();
        if (!recognized || !dragged?.anchor || !date) return;
        suppressClick();
        setSpace(null);
        if (!latest) { update(null); return; }
        const result = checkSelection(dragged.anchor, date, latest.props.interactionPolicy), block = report(result);
        if (!block && result.range) complete(latest, result.range);
        else {
            // A blocked drop keeps the draft as range mode with the same anchor and endpoint (decision Q5).
            update({mode: 'range', anchor: dragged.anchor, endpoint: date});
            if (result.range) target.current = {range: result.range, allowed: false};
            if (block) blocked(latest, block);
        }
        focusQuietly(date);
    };
    /** Desktop drag over the empty area of date cells (decision Q5): pointer down anchors, movement sets the endpoint. */
    const onCellPointerDown = (event: PointerEvent<HTMLElement>, date: string) => {
        const latest = current(), document = event.currentTarget.ownerDocument, window = document.defaultView, grid = gridRef.current;
        if (!latest || latest.state.layout !== 'desktop' || draftRef.current || moveDraftActive || press.current || !window || !grid) return;
        if ((event.pointerType !== 'mouse' && event.pointerType !== 'pen') || !event.isPrimary || event.button !== 0) return;
        const done = new AbortController(), signal = done.signal;
        const held: Press = {pointer: event.pointerId, date, x: event.clientX, y: event.clientY, recognized: false, done};
        press.current = held;
        const mine = (pointer: globalThis.PointerEvent) => press.current === held && pointer.pointerId === held.pointer;
        // Any loss of capture after recognition cancels with the cancellation speech; before it nothing is announced.
        const abandon = () => { if (press.current !== held) return; if (held.recognized) cancelRef.current(true); else endPress(); };
        document.addEventListener('pointermove', pointer => {
            if (!mine(pointer)) return;
            const over = hit(pointer.clientX, pointer.clientY);
            if (!held.recognized) {
                if (over && over !== held.date && Math.hypot(pointer.clientX - held.x, pointer.clientY - held.y) >= dragThreshold) recognize(held, over);
                return;
            }
            const dragged = draftRef.current;
            if (over && dragged) { const next = moveEndpoint(dragged, over); if (next !== dragged) update(next); }
        }, {capture: true, signal});
        document.addEventListener('pointerup', pointer => { if (mine(pointer)) release(held, pointer); }, {capture: true, signal});
        document.addEventListener('pointercancel', pointer => { if (mine(pointer)) abandon(); }, {capture: true, signal});
        grid.addEventListener('lostpointercapture', pointer => { if (mine(pointer)) abandon(); }, {signal});
        window.addEventListener('blur', abandon, {signal});
        document.addEventListener('keydown', key => {
            if (!held.recognized || key.key !== 'Escape') return;
            key.preventDefault(); key.stopPropagation(); abandon();
        }, {capture: true, signal});
        document.addEventListener('selectstart', start => { if (held.recognized) start.preventDefault(); }, {capture: true, signal});
    };

    // Unmount ends a held press silently.
    useEffect(() => () => {
        const held = press.current;
        press.current = null; held?.done.abort();
    }, []);
    // Each commit: render-time diagnostics, then the cancellation table and the acceptance of the pending request
    // (blocking wins, decision Q9), then target speech when the normalized range or its allowed state changed.
    useEffect(() => {
        for (const diagnostic of diagnostics.drain()) warn(diagnostic.path, diagnostic.reason);
        const drop = () => { cancelRef.current(false); if (space) setSpace(null); };
        if (model.kind === 'contract') { pending.current = null; drop(); return; }
        const value = enabled ? accepted : undefined, last = previous.current;
        previous.current = value;
        if (model.blocking || value === undefined) { pending.current = null; drop(); return; }
        const request = pending.current, change = last === undefined ? 'external' : reconcileSelection(last, value, request);
        if (change !== 'unchanged') pending.current = null;
        if (change === 'accepted' && data) {
            const requested = request?.value;
            enqueue({kind: 'other', texts: [requested ? data.message('selectionCompletedAnnouncement', requested) : data.message('selectionClearedAnnouncement')]});
        } else if (change === 'external' && last !== undefined) { drop(); return; }
        // Only a held desktop drag ends on a switch to the mobile layout (decision Q16), with the cancellation speech.
        if (model.state.layout !== 'desktop' && press.current) { cancelRef.current(true); return; }
        if (draftRef.current !== stored || !data) return;
        const now = range ? {range, allowed: !targetBlock} : null;
        if (now && !sameTarget(now, target.current)) {
            target.current = now;
            enqueue({kind: 'target', texts: [data.message('selectionTargetAnnouncement', now.range, now.allowed)]});
        }
    });
    const take = useCallback(() => {
        const {polite, urgent} = queue.current;
        queue.current = {polite: []};
        return {polite: polite.length ? polite.flatMap(transition => transition.texts) : undefined, urgent};
    }, []);
    const flush = useCallback(() => {
        const {polite, urgent} = take();
        if (polite || urgent) overlays.announce(polite, urgent);
    }, [take, overlays]);

    const focusRoving = () => { const cell = focusDate ? getDateCell(focusDate) : undefined; focusElement(cell); };
    const busy = !!draft || moveDraftActive;
    return {
        enabled, draftActive: !!draft, rangeMode: rangeOpen, line, take, flush, cancelDraft,
        ids: {reason: overlays.domId('selection_reason'), create: overlays.domId('selection_create')},
        rangeAvailable: enabled && !busy && !model.blocking,
        clearAvailable: enabled && accepted !== null && !draft && !model.blocking,
        createShown: enabled && !!props?.onCreateRequest,
        createAvailable: enabled && accepted !== null && !busy && !model.blocking && !createBlock,
        /** Select day: blocked by the core boundary or the policy (its shown reason), or unavailable during any draft. */
        selectDayBlock: (date: string) => enabled ? diagnostics.note(checkSelection(date, date, policy)) : null,
        selectDayAvailable: enabled && !busy && !model.blocking,
        dateBlock,
        isDraftDate: (date: string) => !!range && inRange(date, range),
        reason: (block: SelectionBlock) => blockReason(data!, block),
        startRange: () => {
            const latest = current();
            if (!latest || draftRef.current || moveDraftActive) return;
            // Close the open package overlays, so a draft never sits under a dialog or menu; never navigate.
            overlays.dismissAll();
            setSpace(null);
            update(rangeMode);
            announce({kind: 'other', texts: [latest.message('rangeSelectionInstructions')]});
            const agenda = agendaDate ? getDateCell(agendaDate) : undefined;
            if (!focusElement(agenda)) focusRoving();
        },
        clear: () => {
            const latest = current();
            if (!latest || draftRef.current || latest.props.selection === null) return;
            setSpace(null);
            pending.current = {value: null};
            latest.props.onSelectionChange?.(null);
        },
        create: () => {
            const latest = current(), value = latest?.props.selection;
            if (!latest || !value || !latest.props.onCreateRequest || draftRef.current || moveDraftActive) return;
            setSpace(null);
            // The last-moment check with the latest committed props.
            const block = report(checkRange(value, latest.props.interactionPolicy));
            if (block) { setPressBlock({model: committed.current, block}); blocked(latest, block); return; }
            latest.props.onCreateRequest({start: value.start, end: value.end});
        },
        selectDay: (date: string) => { setSpace(null); propose(date); },
        /** Cancel in the mode line (and Escape on it): the line goes, so its focus recovers to the roving date cell. */
        cancelFromLine: () => { cancel(true); focusRoving(); },
        /** A key on a date cell; true when selection handled it and the viewer branches must not run. */
        onKey: (event: KeyboardEvent<HTMLElement>, date: string) => {
            if (!enabled) return false;
            const held = draftRef.current, key = event.key;
            if (held?.mode === 'drag') {
                if (key !== ' ' && key !== 'Enter') return false;
                event.preventDefault(); return true;
            }
            if (held) {
                if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(true); return true; }
                if (key !== ' ' && key !== 'Enter') return false;
                event.preventDefault();
                if (!event.repeat) activate(date);
                return true;
            }
            if (key !== ' ') return false;
            event.preventDefault();
            if (!event.repeat && propose(date)) setSpace({date});
            return true;
        },
        /** Every focus on a date cell after an anchor moves the endpoint (decision Q14); returns true for the drop's own focus. */
        onDateFocus: (date: string, pointer: boolean) => {
            if (quiet.current === date) { quiet.current = null; return true; }
            if (space?.date && space.date !== date) setSpace({date: null});
            const held = draftRef.current;
            // A pointer press in range mode is one transition: its click, not its focus, moves the endpoint.
            if (!held || held.mode === 'drag' || pointer) return false;
            const next = moveEndpoint(held, date);
            if (next !== held) update(next);
            return false;
        },
        /** A click or tap on a date, a `+N` or an item segment's hit-tested date: in range mode a date tap, never a view. */
        onDatePress: (date: string) => {
            if (!enabled || draftRef.current?.mode !== 'range') return false;
            activate(date);
            return true;
        },
        onCellPointerDown,
        onGridBlur: (event: FocusEvent<HTMLElement>) => {
            const next = event.relatedTarget as Node | null;
            if (space && !(next && event.currentTarget.contains(next))) setSpace(null);
        },
        /** Escape on the package's toolbar buttons and mode-line controls cancels a draft; consumer content is left alone. */
        onControlKey: (event: KeyboardEvent<HTMLElement>, fromLine = false) => {
            const node = event.target as Element;
            if (event.key !== 'Escape' || event.nativeEvent.isComposing || !draftRef.current || !node.closest('button') || node.closest('.nc-toolbar-content')) return;
            event.preventDefault(); event.stopPropagation();
            if (fromLine) { cancel(true); focusRoving(); } else cancel(true);
        },
    };
}
export type CalendarSelection = ReturnType<typeof useSelection>;
