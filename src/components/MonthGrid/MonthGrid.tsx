import React, {useMemo} from 'react';

import {EventBar} from '@/components/EventBar';
import {EventChip} from '@/components/EventChip';
import {MonthGridCell} from '@/components/MonthGridCell';
import {MonthGridHeader} from '@/components/MonthGridHeader';
import {buildWeekLayout} from '@/core/buildWeekLayout';
import {getMonthGridWeeks, isToday} from '@/core/dateUtils';
import {Box} from '@/ui-kit';
import type {CalendarEvent, SeriesActionScope} from '@/types';

import classes from './MonthGrid.module.css';

type MonthGridProps = {
    anchorDate: string;
    events: CalendarEvent[];
    weekdays: string[];
    utcOffset: string;
    locale: string;
    gridLabel: string;
    allDayLabel: string;
    onEventPress?: (event: CalendarEvent) => void;
    onEventEdit?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    onEventDelete?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    'data-testid'?: string;
};

export const MonthGrid: React.FC<MonthGridProps> = ({
    anchorDate,
    events,
    weekdays,
    utcOffset,
    locale,
    gridLabel,
    allDayLabel,
    onEventPress,
    onEventEdit,
    onEventDelete,
    'data-testid': dataTestId,
}) => {
    const weeks = useMemo(() => getMonthGridWeeks(anchorDate), [anchorDate]);
    const layouts = useMemo(
        () => buildWeekLayout(events, weeks, utcOffset),
        [events, weeks, utcOffset],
    );

    return (
        <div className={classes.grid} role="grid" aria-label={gridLabel}>
            <MonthGridHeader
                weekdays={weekdays}
                data-testid={dataTestId ? `${dataTestId}-header` : undefined}
            />
            <Box direction="column" className={classes.weeks}>
                {weeks.map((week, wi) => {
                    const layout = layouts[wi];
                    const weekStyle = {
                        ['--lane-count' as never]: layout.laneCount,
                    } as React.CSSProperties;
                    return (
                        <div
                            key={week[0].format('YYYY-MM-DD')}
                            className={classes.weekRow}
                            style={weekStyle}
                            role="row"
                            aria-rowindex={wi + 2}
                        >
                            {week.map((d, i) => (
                                <MonthGridCell
                                    key={d.format('YYYY-MM-DD')}
                                    date={d}
                                    isToday={isToday(d, utcOffset)}
                                    columnIndex={i}
                                    locale={locale}
                                    data-testid={
                                        dataTestId
                                            ? `${dataTestId}-cell-${d.format('YYYY-MM-DD')}`
                                            : undefined
                                    }
                                />
                            ))}
                            {layout.segments.map(seg => {
                                const span = seg.endCol - seg.startCol + 1;
                                const itemStyle: React.CSSProperties = {
                                    gridColumn: `${seg.startCol} / span ${span}`,
                                    gridRow: seg.lane + 2,
                                };
                                return (
                                    <div
                                        key={`${seg.event.id}-${seg.startCol}-${seg.endCol}-${seg.lane}`}
                                        className={classes.laneItem}
                                        style={itemStyle}
                                        role="gridcell"
                                        aria-colindex={seg.startCol}
                                        aria-colspan={span}
                                        aria-label={seg.event.title}
                                    >
                                        {seg.isMultiDay ? (
                                            <EventBar
                                                event={seg.event}
                                                segmentKind={seg.segmentKind}
                                                utcOffset={utcOffset}
                                                locale={locale}
                                                onPress={onEventPress}
                                                onEdit={onEventEdit}
                                                onDelete={onEventDelete}
                                                data-testid={
                                                    dataTestId
                                                        ? `${dataTestId}-bar-${seg.event.id}`
                                                        : undefined
                                                }
                                            />
                                        ) : (
                                            <EventChip
                                                event={seg.event}
                                                utcOffset={utcOffset}
                                                allDayLabel={allDayLabel}
                                                onPress={onEventPress}
                                                onEdit={onEventEdit}
                                                onDelete={onEventDelete}
                                                data-testid={
                                                    dataTestId
                                                        ? `${dataTestId}-chip-${seg.event.id}`
                                                        : undefined
                                                }
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </Box>
        </div>
    );
};
