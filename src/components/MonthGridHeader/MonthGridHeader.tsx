import React from 'react';

import {Box, Text} from '@/ui-kit';

import classes from './MonthGridHeader.module.css';

type MonthGridHeaderProps = {
    weekdays: string[];
    'data-testid'?: string;
};

export const MonthGridHeader: React.FC<MonthGridHeaderProps> = ({
    weekdays,
    'data-testid': dataTestId,
}) => (
    <div className={classes.headerRow} role="row" data-testid={dataTestId}>
        {weekdays.map(name => (
            <Box
                key={name}
                alignItems="center"
                justifyContent="center"
                className={classes.headerCell}
                role="columnheader"
            >
                <Text variant="caption2" weight="medium" className={classes.text}>
                    {name}
                </Text>
            </Box>
        ))}
    </div>
);
