import type {CalendarEvent} from '@/types';

import {dayjs, type Dayjs} from './dayjs';
import {validateEventDates} from './validateCalendarInput';

export type EventSegment = {
    event: CalendarEvent;
    startCol: number;
    endCol: number;
    lane: number;
    segmentKind: 'whole' | 'first' | 'middle' | 'last';
    isMultiDay: boolean;
};

export type WeekLayout = {
    segments: EventSegment[];
    laneCount: number;
};

export function buildWeekLayout(
    events: CalendarEvent[],
    weeks: Dayjs[][],
    utcOffset: string,
): WeekLayout[] {
    return weeks.map(week => {
        const weekDates = week.map(d => d.format('YYYY-MM-DD'));
        const weekStartStr = weekDates[0];
        const weekEndStr = weekDates[6];

        type Item = {
            event: CalendarEvent;
            startCol: number;
            endCol: number;
            isMultiDay: boolean;
            segmentKind: EventSegment['segmentKind'];
            sortKey: number;
        };
        const overlapping: Item[] = [];

        for (const event of events) {
            if (!validateEventDates(event)) {
                continue;
            }

            const startStr = dayjs(event.start).utcOffset(utcOffset).format('YYYY-MM-DD');
            const endStr = event.end
                ? dayjs(event.end).utcOffset(utcOffset).format('YYYY-MM-DD')
                : startStr;

            if (endStr < startStr) {
                continue;
            }

            if (endStr < weekStartStr || startStr > weekEndStr) {
                continue;
            }

            const clippedStartStr = startStr < weekStartStr ? weekStartStr : startStr;
            const clippedEndStr = endStr > weekEndStr ? weekEndStr : endStr;

            const startCol = weekDates.indexOf(clippedStartStr) + 1;
            const endCol = weekDates.indexOf(clippedEndStr) + 1;

            const isMultiDay = startStr !== endStr;
            const startsInWeek = startStr >= weekStartStr;
            const endsInWeek = endStr <= weekEndStr;
            const segmentKind: EventSegment['segmentKind'] =
                startsInWeek && endsInWeek
                    ? 'whole'
                    : startsInWeek
                      ? 'first'
                      : endsInWeek
                        ? 'last'
                        : 'middle';

            overlapping.push({
                event,
                startCol,
                endCol,
                isMultiDay,
                segmentKind,
                sortKey: (isMultiDay ? 0 : 1) * 1e13 + dayjs(event.start).valueOf(),
            });
        }

        overlapping.sort((a, b) => a.sortKey - b.sortKey);

        const laneOccupancy: number[][] = [];
        const segments: EventSegment[] = [];
        for (const item of overlapping) {
            let lane = 0;
            while (true) {
                if (!laneOccupancy[lane]) laneOccupancy[lane] = [];
                const laneRow = laneOccupancy[lane];
                let conflict = false;
                for (let c = item.startCol; c <= item.endCol; c++) {
                    if (laneRow[c]) {
                        conflict = true;
                        break;
                    }
                }
                if (!conflict) {
                    for (let c = item.startCol; c <= item.endCol; c++) {
                        laneRow[c] = 1;
                    }
                    break;
                }
                lane++;
            }
            segments.push({
                event: item.event,
                startCol: item.startCol,
                endCol: item.endCol,
                lane,
                segmentKind: item.segmentKind,
                isMultiDay: item.isMultiDay,
            });
        }

        return {segments, laneCount: laneOccupancy.length};
    });
}
