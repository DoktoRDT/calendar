import {useEffect, useId, useLayoutEffect, useRef} from 'react';
import type {SelectionBlock} from '../core/selection.js';
import {LocalizedText} from '../LocalizedText.js';
import {Button, Stack} from '../primitives/index.js';
import type {CalendarDataModel} from './model.js';
import type {CalendarController} from './useCalendarController.js';

const useClientLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;
const unavailable = (available: boolean) => available ? undefined : true;

/** A block's visible reason: the consumer's text as returned, or the package's boundary or generic reason. */
export function SelectionReason<I, S>({model, block}: {model: CalendarDataModel<I, S>; block: SelectionBlock}) {
    if (block.kind === 'policy' && block.reason !== undefined) return <bdi dir="auto">{block.reason}</bdi>;
    return <LocalizedText value={model.message(block.kind === 'boundary' ? 'selectionBoundaryReason' : 'genericBlockedReason')}/>;
}

/**
 * The selection group of the toolbar (decision Q1): Select range, Clear selection and Create, only with the selection
 * pair. Labels never change. An unavailable command is `aria-disabled` and stays focusable; its handler sends nothing.
 */
export function SelectionToolbar<I, S>({controller}: {controller: CalendarController<I, S>}) {
    const {model, selection} = controller;
    if (model.kind !== 'data' || !selection.enabled) return null;
    const range = model.message('selectRangeLabel'), clear = model.message('clearSelectionLabel'), create = model.message('createLabel');
    const createReason = selection.createAvailable ? undefined : selection.line?.create ? selection.ids.create : undefined;
    return <Stack direction="row" className="nc-selection-controls">
        <Button lang={range.lang} aria-disabled={unavailable(selection.rangeAvailable)} onPress={selection.startRange}><LocalizedText value={range}/></Button>
        <Button lang={clear.lang} aria-disabled={unavailable(selection.clearAvailable)} onPress={selection.clear}><LocalizedText value={clear}/></Button>
        {selection.createShown && <Button lang={create.lang} aria-disabled={unavailable(selection.createAvailable)} aria-describedby={createReason}
            onPress={selection.create}><LocalizedText value={create}/></Button>}
    </Stack>;
}

/**
 * The package-owned mode line (decision Q3): in flow after the toolbar and its data-state banner, before the grid, with no
 * live role. Its block size never shrinks while it stays in one mode, so a reason that appears or clears never moves the
 * controls or the grid; the key starts a new measurement for a new mode.
 */
export function SelectionLine<I, S>({controller}: {controller: CalendarController<I, S>}) {
    const {model, selection} = controller, line = selection.line;
    if (model.kind !== 'data' || !line) return null;
    return <ModeLine key={line.kind} controller={controller} model={model} line={line}/>;
}
function ModeLine<I, S>({controller, model, line}: {controller: CalendarController<I, S>; model: CalendarDataModel<I, S>; line: NonNullable<CalendarController<I, S>['selection']['line']>}) {
    const {selection} = controller, node = useRef<HTMLDivElement>(null), size = useRef(0);
    const grow = useRef(() => {
        const element = node.current, height = element ? Number.parseFloat(element.ownerDocument.defaultView!.getComputedStyle(element).height) || 0 : 0;
        if (element && height > size.current) { size.current = height; element.style.minBlockSize = `${height}px`; }
    });
    // Each commit (a reason appeared) and each resize (the text wrapped) can only raise the reserved block size.
    useClientLayoutEffect(() => grow.current());
    useClientLayoutEffect(() => {
        const element = node.current, window = element?.ownerDocument.defaultView;
        if (!element || !window?.ResizeObserver) return;
        const observer = new window.ResizeObserver(() => grow.current());
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const cancel = model.message('cancelLabel');
    return <div ref={node} className="nc-selection-line" lang={model.lang} data-mode={line.kind} onKeyDown={event => selection.onControlKey(event, true)}>
        <span id={selection.ids.reason} className="nc-selection-reason">{line.reason && <SelectionReason model={model} block={line.reason}/>}</span>
        {line.create && <span id={selection.ids.create} className="nc-selection-reason"><SelectionReason model={model} block={line.create}/></span>}
        {line.kind === 'range' && <Button lang={cancel.lang} onPress={selection.cancelFromLine}><LocalizedText value={cancel}/></Button>}
    </div>;
}

/**
 * Select day in the agenda body, every presentation (decisions Q3 and Q10): the pointer and touch equivalent of `Space`.
 * It never closes the agenda; a blocked one is `aria-disabled`, focusable and described by its visible reason.
 */
export function SelectDay<I, S>({controller, model, date}: {controller: CalendarController<I, S>; model: CalendarDataModel<I, S>; date: string}) {
    const {selection} = controller, id = useId(), label = model.message('selectDateLabel'), block = selection.selectDayBlock(date);
    return <div className="nc-day-list-select">
        <Button data-agenda-select lang={label.lang} aria-disabled={unavailable(selection.selectDayAvailable && !block)} aria-describedby={block ? id : undefined}
            onPress={() => selection.selectDay(date)}><LocalizedText value={label}/></Button>
        {block && <span id={id} className="nc-selection-reason"><SelectionReason model={model} block={block}/></span>}
    </div>;
}
