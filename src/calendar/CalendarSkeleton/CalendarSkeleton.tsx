import React, {useMemo} from 'react';

import cn from 'classnames';

import gridClasses from '@/components/MonthGrid/MonthGrid.module.css';
import headerClasses from '@/components/MonthGridHeader/MonthGridHeader.module.css';
import calendarClasses from '@/calendar/Calendar/Calendar.module.css';
import {getMonthGridWeeks, isViewingCurrentMonth} from '@/core/dateUtils';
import {resolveUtcOffset} from '@/core/validateCalendarInput';
import {LabelsProvider, useLabels} from '@/labels/LabelsContext';
import {buildThemeStyle} from '@/theme/buildThemeStyle';
import {Box, Skeleton} from '@/ui-kit';
import type {CalendarLabels} from '@/labels/types';

const WEEKDAY_COUNT = 7;
const DEFAULT_WEEK_COUNT = 6;

export type CalendarSkeletonProps = {
    className?: string;
    anchorDate?: string;
    utcOffset?: string;
    timezone?: string;
    labels?: Partial<CalendarLabels>;
    'data-testid'?: string;
};

const CalendarSkeletonInner: React.FC<CalendarSkeletonProps> = ({
    className,
    anchorDate,
    utcOffset,
    timezone,
    'data-testid': dataTestId,
}) => {
    const labels = useLabels();
    const rootStyle = useMemo(() => buildThemeStyle(), []);

    const weekCount = useMemo(() => {
        if (!anchorDate) {
            return DEFAULT_WEEK_COUNT;
        }

        return getMonthGridWeeks(anchorDate).length;
    }, [anchorDate]);

    const resolvedUtcOffset = useMemo(
        () => (utcOffset ?? timezone ? resolveUtcOffset(utcOffset, timezone) : undefined),
        [utcOffset, timezone],
    );

    const showTodaySkeleton =
        !anchorDate ||
        !resolvedUtcOffset ||
        !isViewingCurrentMonth(anchorDate, resolvedUtcOffset);

    return (
        <div
            className={cn(calendarClasses.root, className)}
            style={rootStyle}
            role="status"
            aria-busy="true"
            aria-label={labels.loading}
            data-testid={dataTestId}
        >
            <Box alignItems="center" gap="s" className={calendarClasses.filters}>
                <Box alignItems="center" className={calendarClasses.titleWrap}>
                    <Skeleton style={{width: 140, height: 20, borderRadius: 4}} />
                </Box>
                {showTodaySkeleton && (
                    <Skeleton style={{width: 88, height: 40, borderRadius: 13, flexShrink: 0}} />
                )}
                <Skeleton style={{width: 40, height: 40, borderRadius: 13, flexShrink: 0}} />
                <Skeleton style={{width: 40, height: 40, borderRadius: 13, flexShrink: 0}} />
            </Box>
            <div className={calendarClasses.grid}>
                <div className={gridClasses.grid} role="grid" aria-hidden="true">
                    <div className={headerClasses.headerRow} role="row">
                        {Array.from({length: WEEKDAY_COUNT}, (_, i) => (
                            <Box
                                key={i}
                                alignItems="center"
                                justifyContent="center"
                                className={headerClasses.headerCell}
                                role="columnheader"
                            >
                                <Skeleton style={{width: 20, height: 14, borderRadius: 4}} />
                            </Box>
                        ))}
                    </div>
                    <Box direction="column" className={gridClasses.weeks}>
                        {Array.from({length: weekCount}, (_, weekIndex) => (
                            <div
                                key={weekIndex}
                                className={gridClasses.weekRow}
                                style={{'--lane-count': 0} as React.CSSProperties}
                                role="row"
                            >
                                {Array.from({length: WEEKDAY_COUNT}, (_, dayIndex) => (
                                    <Box
                                        key={dayIndex}
                                        display="block"
                                        p="s"
                                        className={gridClasses.cell}
                                        style={{gridColumn: dayIndex + 1}}
                                        role="gridcell"
                                    >
                                        <Skeleton
                                            style={{width: 18, height: 14, borderRadius: 4}}
                                        />
                                    </Box>
                                ))}
                            </div>
                        ))}
                    </Box>
                </div>
            </div>
        </div>
    );
};

export const CalendarSkeleton: React.FC<CalendarSkeletonProps> = props => (
    <LabelsProvider labels={props.labels}>
        <CalendarSkeletonInner {...props} />
    </LabelsProvider>
);
