import React, {useMemo} from 'react';

import type {Dayjs} from '@/core/dayjs';
import {Box, Text} from '@/ui-kit';

import classes from '@/components/MonthGrid/MonthGrid.module.css';

type MonthGridCellProps = {
    date: Dayjs;
    isToday: boolean;
    columnIndex: number;
    locale: string;
    'data-testid'?: string;
};

export const MonthGridCell: React.FC<MonthGridCellProps> = ({
    date,
    isToday,
    columnIndex,
    locale,
    'data-testid': dataTestId,
}) => {
    const ariaLabel = useMemo(
        () => date.locale(locale).format('D MMMM YYYY'),
        [date, locale],
    );

    return (
        <Box
            display="block"
            p="s"
            className={classes.cell}
            style={{gridColumn: columnIndex + 1}}
            role="gridcell"
            aria-label={ariaLabel}
            data-testid={dataTestId}
        >
            {isToday ? (
                <Text
                    display="inline-block"
                    variant="caption1"
                    weight="medium"
                    color="invert"
                    className={classes.todayBadge}
                >
                    {date.date()}
                </Text>
            ) : (
                <Text variant="caption1" weight="medium" color="minor" className={classes.dayNumber}>
                    {date.date()}
                </Text>
            )}
        </Box>
    );
};
