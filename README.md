# @nelmad/calendar

React month-view calendar built for **task and event lists** — not a generic date picker.

Use it when you need to show scheduled work on a classic grid: single-day items as chips, multi-day items as bars spanning cells, overdue/critical markers, and quick edit/delete on hover (single occurrence vs whole series).

**Problems it handles:**

- **Month grid layout** — events clipped to weeks, stacked in lanes when they overlap; helpers to fetch only the visible date range
- **Multi-day rendering** — one event drawn as a bar across days, with correct segment labels at week edges
- **Fixed UTC offset** — dates and times interpreted in a single offset (`+03:00`), without IANA timezone plugins
- **Product UI out of the box** — navigation, today button, loading bar, skeleton, Russian defaults with overridable labels
- **Theming** — event palette, structural colors via CSS tokens, no hard dependency on your design system

Peer deps: React 18+, dayjs, react-aria-components (menus and keyboard access).

**Storybook:** [nelmad.github.io/calendar](https://nelmad.github.io/calendar/)

## Install

```bash
npm install @nelmad/calendar react react-dom dayjs react-aria-components @react-aria/interactions
```

## Quick start

```tsx
'use client'; // Next.js App Router

import {useState} from 'react';
import {Calendar, defaultPalette, type CalendarEvent} from '@nelmad/calendar';
import '@nelmad/calendar/styles.css';

const events: CalendarEvent[] = [
  {
    id: '1',
    start: '2026-06-03T09:00:00+03:00',
    end: '2026-06-03T11:00:00+03:00',
    title: 'Inspection',
    variant: 'blue',
    isOverdue: false,
    isCritical: false,
    isAllDay: false,
    taskId: '1',
    isClickable: true,
    hasHoverActions: true,
  },
  {
    id: '2',
    start: '2026-06-02T10:00:00+03:00',
    end: '2026-06-05T18:00:00+03:00',
    title: 'Multi-day audit',
    variant: 'green',
    isOverdue: false,
    isCritical: false,
    isAllDay: false,
    taskId: '2',
    isClickable: true,
    hasHoverActions: true,
  },
];

export function TaskCalendar() {
  const [anchorDate, setAnchorDate] = useState('2026-06-01');

  return (
    <div style={{height: 600}}>
      <Calendar
        anchorDate={anchorDate}
        events={events}
        utcOffset="+03:00"
        palette={defaultPalette}
        onNavigate={setAnchorDate}
        onEventPress={e => console.log(e)}
        onEventEdit={(e, scope) => console.log('edit', e, scope)}
        onEventDelete={(e, scope) => console.log('delete', e, scope)}
      />
    </div>
  );
}
```

**Required:** parent with fixed height, `styles.css`, `utcOffset` (`+03:00` / `-05:00`).

`anchorDate` — any date inside the month (`2026-06-15` works). `onNavigate` returns the first day of the target month (`YYYY-MM-01`); keep that as state.

## Data flow

Calendar does not fetch data. You own `anchorDate` and `events`:

```tsx
import {useEffect, useState} from 'react';
import {Calendar, getMonthGridRange, type CalendarEvent} from '@nelmad/calendar';

function TaskCalendar() {
  const [anchorDate, setAnchorDate] = useState('2026-06-01');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const {from, to} = getMonthGridRange(anchorDate);
    setIsLoading(true);
    fetchEvents({from, to}).then(setEvents).finally(() => setIsLoading(false));
  }, [anchorDate]);

  return (
    <div style={{height: 600}}>
      <Calendar
        anchorDate={anchorDate}
        events={events}
        utcOffset="+03:00"
        isFetching={isLoading}
        onNavigate={setAnchorDate}
      />
    </div>
  );
}
```

`getMonthGridRange` covers the full visible grid (including trailing/leading days from adjacent months).

## Not a fit for

- Week / day / agenda views
- IANA time zones (`Europe/Moscow`) — fixed offset only
- Custom event colors beyond 4 variants (`red`, `blue`, `green`, `grey`)
- Drag-and-drop, resize, inline editing
- Touch-first edit/delete UI (hover actions are desktop-oriented)

Invalid `start`/`end` or `end < start` — event is skipped; dev builds log `[@nelmad/calendar]` warnings.

## `CalendarEvent`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Unique id |
| `start` | `string` | ISO datetime |
| `end` | `string?` | Omit for single-day; set for multi-day bar |
| `title` | `string` | |
| `variant` | `'red' \| 'blue' \| 'green' \| 'grey'` | |
| `isOverdue` / `isCritical` / `isAllDay` | `boolean` | |
| `taskId` | `string \| null` | Pass-through for your app (unused by the lib) |
| `isClickable` | `boolean` | Enables `onEventPress` |
| `hasHoverActions` | `boolean` | Edit/delete on hover (needs `onEventEdit` / `onEventDelete`) |

| `isClickable` | `hasHoverActions` | Result |
|:---:|:---:|---|
| ✓ | ✓ | Click + edit/delete on hover |
| ✓ | ✗ | Click only |
| ✗ | ✓ | Edit/delete on hover, no click |
| ✗ | ✗ | Read-only |

`onEventEdit` / `onEventDelete` receive `scope`: `'single' | 'series'`.

## Loading

```tsx
<Calendar {...props} isFetching={isLoading} />
<CalendarSkeleton anchorDate="2026-06-01" utcOffset="+03:00" />
```

## Locale

Default: `ru`. Built-in dayjs locales: `ru`, `en`.

```tsx
import {Calendar, defaultLabels} from '@nelmad/calendar';

<Calendar locale="en" labels={{...defaultLabels, today: 'Today'}} {...props} />
```

Override `labels` for full i18n. Import other dayjs locales in your app if needed.

## Theming

Defaults: `defaultPalette`, `defaultTheme`. Override via props:

```tsx
<Calendar
  palette={defaultPalette}
  overdueColor="#e5453a"
  theme={{backgroundColor: '#fff', borderColor: '#e0e0e0'}}
  {...props}
/>
```

**CSS:** `@nelmad/calendar/styles.css` — tokens + component styles (use this). `@nelmad/calendar/tokens.css` — only `--tc-*` variables, if you restyle from scratch.

**Font** (not bundled — load in your app):

```css
@font-face {
  font-family: 'YS Text';
  font-weight: 400;
  src: url('https://yastatic.net/s3/home/fonts/ys/1/text-regular.woff2') format('woff2');
}
@font-face {
  font-family: 'YS Text';
  font-weight: 500;
  src: url('https://yastatic.net/s3/home/fonts/ys/1/text-medium.woff2') format('woff2');
}
```

## Exports

`Calendar`, `CalendarSkeleton`, `getMonthGridRange`, `getMonthGridWeeks`, `buildWeekLayout`, `formatEventTime`, `defaultPalette`, `defaultTheme`, `defaultLabels`, `DEFAULT_LOCALE`, types.

## Dev

```bash
npm test && npm run build && npm run storybook
```

MIT
