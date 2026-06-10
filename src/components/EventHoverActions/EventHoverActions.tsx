import React from 'react';

import cn from 'classnames';

import {EventDeleteDropdown} from '@/components/EventDeleteDropdown';
import {EventEditDropdown} from '@/components/EventEditDropdown';
import {Box} from '@/ui-kit';
import type {SeriesActionScope} from '@/types';

import classes from './EventHoverActions.module.css';

type EventHoverActionsProps = {
    className?: string;
    onEdit?: (scope: SeriesActionScope) => void;
    onDelete?: (scope: SeriesActionScope) => void;
    'data-testid'?: string;
};

export const EventHoverActions: React.FC<EventHoverActionsProps> = ({
    className,
    onEdit,
    onDelete,
    'data-testid': dataTestId,
}) => {
    if (!onEdit && !onDelete) {
        return null;
    }

    return (
        <Box gap="s" className={cn(classes.root, className)}>
            {onEdit && (
                <EventEditDropdown
                    onSelect={onEdit}
                    data-testid={dataTestId ? `${dataTestId}-edit` : undefined}
                />
            )}
            {onDelete && (
                <EventDeleteDropdown
                    onSelect={onDelete}
                    data-testid={dataTestId ? `${dataTestId}-delete` : undefined}
                />
            )}
        </Box>
    );
};
