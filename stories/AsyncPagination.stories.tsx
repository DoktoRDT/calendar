import type {Meta, StoryObj} from '@storybook/react';
import React, {useEffect, useState} from 'react';

import {Calendar} from '@/calendar/Calendar';
import {defaultPalette} from '@/theme/defaultCalendarColors';
import type {CalendarEvent, SeriesActionScope} from '@/types';

import {STORY_PROGRESS_BAR_COLOR} from './fixtures/calendarColors';
import {eventCatalog} from './fixtures/eventCatalog';
import {fetchEventsForRange, type FetchEventsResult} from './fixtures/mockEventApi';

const UTC_OFFSET = '+03:00';

const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    padding: '10px 12px',
    borderRadius: 8,
    background: '#fff',
    border: '1px solid #ebebeb',
    font: '13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#404a52',
};

function AsyncPaginationDemo() {
    const [anchorDate, setAnchorDate] = useState('2026-06-01');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [fetchMeta, setFetchMeta] = useState<FetchEventsResult | null>(null);
    const [requestCount, setRequestCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        setIsFetching(true);
        setRequestCount(count => count + 1);

        fetchEventsForRange(anchorDate, UTC_OFFSET).then(result => {
            if (cancelled) {
                return;
            }

            setEvents(result.events);
            setFetchMeta(result);
            setIsFetching(false);
        });

        return () => {
            cancelled = true;
        };
    }, [anchorDate]);

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 12, height: '100%'}}>
            <div style={panelStyle}>
                <span>
                    <strong>anchorDate:</strong> {anchorDate}
                </span>
                {fetchMeta && (
                    <>
                        <span>
                            <strong>range:</strong> {fetchMeta.from} → {fetchMeta.to}
                        </span>
                        <span>
                            <strong>events:</strong> {fetchMeta.events.length} / {eventCatalog.length}
                        </span>
                        <span>
                            <strong>latency:</strong> {fetchMeta.durationMs}ms
                        </span>
                    </>
                )}
                <span>
                    <strong>requests:</strong> {requestCount}
                </span>
                <span>
                    <strong>status:</strong> {isFetching ? 'loading…' : 'idle'}
                </span>
            </div>
            <div style={{flex: 1, minHeight: 0}}>
                <Calendar
                    anchorDate={anchorDate}
                    events={events}
                    utcOffset={UTC_OFFSET}
                    palette={defaultPalette}
                    overdueColor="#e5453a"
                    criticalColor="#e5453a"
                    progressBarColor={STORY_PROGRESS_BAR_COLOR}
                    isFetching={isFetching}
                    onNavigate={setAnchorDate}
                    onEventPress={event => console.log('press', event.id)}
                    onEventEdit={(event: CalendarEvent, scope: SeriesActionScope) =>
                        console.log('edit', event.id, scope)
                    }
                    onEventDelete={(event: CalendarEvent, scope: SeriesActionScope) =>
                        console.log('delete', event.id, scope)
                    }
                    data-testid="async-calendar"
                />
            </div>
        </div>
    );
}

const meta: Meta = {
    title: 'Calendar/Async pagination',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Simulates paginated API fetch on month change. Catalog has ~90 events across May–Aug 2026; each navigation triggers a delayed request filtered by `getMonthGridRange`.',
            },
        },
    },
    decorators: [
        Story => (
            <div style={{height: 700, padding: 24, background: '#f5f5f5'}}>
                <Story />
            </div>
        ),
    ],
};

export default meta;

type Story = StoryObj;

export const MonthNavigation: Story = {
    render: () => <AsyncPaginationDemo />,
};
