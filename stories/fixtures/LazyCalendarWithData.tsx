import React, {useEffect, useState} from 'react';

import {Calendar} from '@/calendar/Calendar';
import {defaultPalette} from '@/theme/defaultCalendarColors';
import type {CalendarEvent, SeriesActionScope} from '@/types';

import {STORY_PROGRESS_BAR_COLOR} from './calendarColors';
import {fetchEventsForRange} from './mockEventApi';

const UTC_OFFSET = '+03:00';

export type LazyCalendarWithDataProps = {
    anchorDate: string;
    onNavigate: (date: string) => void;
    onFetchingChange?: (isFetching: boolean) => void;
};

export function LazyCalendarWithData({
    anchorDate,
    onNavigate,
    onFetchingChange,
}: LazyCalendarWithDataProps) {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        let cancelled = false;

        setIsFetching(true);
        onFetchingChange?.(true);

        fetchEventsForRange(anchorDate, UTC_OFFSET).then(result => {
            if (cancelled) {
                return;
            }

            setEvents(result.events);
            setIsFetching(false);
            onFetchingChange?.(false);
        });

        return () => {
            cancelled = true;
        };
    }, [anchorDate, onFetchingChange]);

    return (
        <Calendar
            anchorDate={anchorDate}
            events={events}
            utcOffset={UTC_OFFSET}
            palette={defaultPalette}
            overdueColor="#e5453a"
            criticalColor="#e5453a"
            progressBarColor={STORY_PROGRESS_BAR_COLOR}
            isFetching={isFetching}
            onNavigate={onNavigate}
            onEventPress={event => console.log('press', event.id)}
            onEventEdit={(event: CalendarEvent, scope: SeriesActionScope) =>
                console.log('edit', event.id, scope)
            }
            onEventDelete={(event: CalendarEvent, scope: SeriesActionScope) =>
                console.log('delete', event.id, scope)
            }
            data-testid="lazy-calendar"
        />
    );
}
