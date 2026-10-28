import {StrictMode, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import type {CalendarDateRange, CalendarProps} from '../../src/v02/reference.js';
import {CalendarMonth} from '../../src/v02/calendar/CalendarMonth.js';

// #11 probe entry: the internal CalendarMonth with a controlled selection that the fixture accepts at once (or never, with
// `accept: false`), and a canSelectDate policy that blocks the `blocked` dates. Every callback is recorded in `events`.
type Options = Partial<CalendarProps> & {accept?: boolean; blocked?: readonly string[]};
type Event = {type: string; value: unknown};

function Fixture({options, events}: {options: Options; events: Event[]}) {
    const {accept = true, blocked = [], ...props} = options;
    const [selection, setSelection] = useState<CalendarDateRange | null>(props.selection ?? null);
    const input = {items: [], anchorDate: '2026-09-01', today: '2026-09-15', timeZone: 'UTC', locale: 'en-US', layout: 'desktop', ...props,
        onNavigate: (value: string) => events.push({type: 'navigate', value}), onItemPress: (value: unknown) => events.push({type: 'item', value}),
        onCreateRequest: (value: unknown) => events.push({type: 'create', value}),
        interactionPolicy: {canSelectDate: (date: string) => blocked.includes(date) ? {allowed: false as const, reason: `Closed ${date}`} : true as const},
        selection, onSelectionChange: (value: CalendarDateRange | null) => { events.push({type: 'selection', value}); if (accept) setSelection(value); }} as CalendarProps;
    return <CalendarMonth {...input}/>;
}
export function mountSelection(container: Element, initial: Options) {
    const events: Event[] = [], root = createRoot(container);
    let options = initial;
    const render = () => flushSync(() => root.render(<StrictMode><Fixture options={options} events={events}/></StrictMode>));
    render();
    return {events, patch(next: Options) { options = {...options, ...next}; render(); }, unmount: () => root.unmount()};
}
