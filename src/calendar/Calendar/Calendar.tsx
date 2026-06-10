import React, {useCallback, useMemo} from 'react';

import cn from 'classnames';

import {MonthGrid} from '@/components/MonthGrid';
import {buildCalendarPaletteStyle} from '@/core/calendarPaletteVars';
import {DEFAULT_LOCALE, dayjs} from '@/core/dayjs';
import {getCurrentMonthAnchor, isViewingCurrentMonth, shiftMonth} from '@/core/dateUtils';
import {useProgressBarVisible} from '@/core/useProgressBarVisible';
import {resolveUtcOffset} from '@/core/validateCalendarInput';
import {LabelsProvider, useLabels} from '@/labels/LabelsContext';
import {buildThemeStyle} from '@/theme/buildThemeStyle';
import {
    defaultCriticalColor,
    defaultOverdueColor,
    defaultPalette,
    defaultProgressBarColor,
} from '@/theme/defaultCalendarColors';
import {ArrowLeftIcon, ArrowRightIcon, Box, IconButton, Text} from '@/ui-kit';
import type {CalendarProps} from '@/types';

import classes from './Calendar.module.css';

function buildWeekdays(locale: string): string[] {
    const monday = dayjs('2024-01-01').locale(locale);
    return Array.from({length: 7}, (_, i) => monday.add(i, 'day').format('dd'));
}

const CalendarInner: React.FC<CalendarProps> = ({
    anchorDate,
    events,
    utcOffset,
    timezone,
    locale = DEFAULT_LOCALE,
    onNavigate,
    onEventPress,
    onEventEdit,
    onEventDelete,
    className,
    palette,
    overdueColor,
    criticalColor,
    progressBarColor,
    isFetching = false,
    theme,
    'data-testid': dataTestId,
}) => {
    const labels = useLabels();

    const resolvedPalette = palette ?? defaultPalette;
    const resolvedOverdueColor = overdueColor ?? defaultOverdueColor;
    const resolvedCriticalColor = criticalColor ?? defaultCriticalColor;
    const resolvedProgressBarColor = progressBarColor ?? defaultProgressBarColor;

    const resolvedUtcOffset = useMemo(
        () => resolveUtcOffset(utcOffset, timezone),
        [utcOffset, timezone],
    );

    const weekdays = useMemo(() => buildWeekdays(locale), [locale]);

    const {monthLabel, yearLabel, gridLabel} = useMemo(() => {
        const d = dayjs(anchorDate).locale(locale);
        return {
            monthLabel: d.format('MMMM'),
            yearLabel: d.format('YYYY'),
            gridLabel: d.format('MMMM YYYY'),
        };
    }, [anchorDate, locale]);

    const goPrev = useCallback(
        () => onNavigate(shiftMonth(anchorDate, -1)),
        [anchorDate, onNavigate],
    );
    const goNext = useCallback(
        () => onNavigate(shiftMonth(anchorDate, 1)),
        [anchorDate, onNavigate],
    );
    const showTodayButton = useMemo(
        () => !isViewingCurrentMonth(anchorDate, resolvedUtcOffset),
        [anchorDate, resolvedUtcOffset],
    );

    const goToday = useCallback(
        () => onNavigate(getCurrentMonthAnchor(resolvedUtcOffset)),
        [onNavigate, resolvedUtcOffset],
    );

    const rootStyle = useMemo(
        () => ({
            ...buildCalendarPaletteStyle({
                palette: resolvedPalette,
                overdueColor: resolvedOverdueColor,
                criticalColor: resolvedCriticalColor,
                progressBarColor: resolvedProgressBarColor,
            }),
            ...buildThemeStyle(theme),
        }),
        [
            resolvedPalette,
            resolvedOverdueColor,
            resolvedCriticalColor,
            resolvedProgressBarColor,
            theme,
        ],
    );

    const showProgressBar = useProgressBarVisible(isFetching);

    return (
        <div
            className={cn(classes.root, className)}
            style={rootStyle}
            aria-busy={isFetching || undefined}
            aria-label={gridLabel}
            data-testid={dataTestId}
        >
            <Box
                alignItems="center"
                gap="s"
                className={classes.filters}
                data-testid={dataTestId ? `${dataTestId}-filters` : undefined}
            >
                <Box alignItems="center" className={classes.titleWrap}>
                    <Text variant="body1" weight="medium" className={classes.titleMonth}>
                        {monthLabel}
                    </Text>
                    <Text variant="body1" weight="medium" color="minor" className={classes.titleYear}>
                        {yearLabel}
                    </Text>
                </Box>
                {showTodayButton && (
                    <IconButton
                        onPress={goToday}
                        data-testid={dataTestId ? `${dataTestId}-today` : undefined}
                    >
                        {labels.today}
                    </IconButton>
                )}
                <IconButton
                    iconOnly
                    onPress={goPrev}
                    aria-label={labels.prevMonth}
                    data-testid={dataTestId ? `${dataTestId}-prev` : undefined}
                >
                    <ArrowLeftIcon size={24} />
                </IconButton>
                <IconButton
                    iconOnly
                    onPress={goNext}
                    aria-label={labels.nextMonth}
                    data-testid={dataTestId ? `${dataTestId}-next` : undefined}
                >
                    <ArrowRightIcon size={24} />
                </IconButton>
                {showProgressBar && (
                    <div
                        className={classes.progressBar}
                        role="progressbar"
                        aria-valuetext={labels.loading}
                        data-testid={dataTestId ? `${dataTestId}-progress` : undefined}
                    />
                )}
            </Box>
            <div className={classes.grid}>
                <MonthGrid
                    anchorDate={anchorDate}
                    events={events}
                    weekdays={weekdays}
                    utcOffset={resolvedUtcOffset}
                    locale={locale}
                    gridLabel={gridLabel}
                    allDayLabel={labels.allDay}
                    onEventPress={onEventPress}
                    onEventEdit={onEventEdit}
                    onEventDelete={onEventDelete}
                    data-testid={dataTestId ? `${dataTestId}-grid` : undefined}
                />
            </div>
        </div>
    );
};

export const Calendar: React.FC<CalendarProps> = props => (
    <LabelsProvider labels={props.labels}>
        <CalendarInner {...props} />
    </LabelsProvider>
);
