import React, {useCallback, useMemo} from 'react';
import {usePress} from '@react-aria/interactions';

import cn from 'classnames';

import {EventHoverActions} from '@/components/EventHoverActions';
import {eventVariantClassName, variantClasses} from '@/components/shared/eventVariants';
import {formatEventTime} from '@/core/formatEventTime';
import {useLabels} from '@/labels/LabelsContext';
import {Box, ExclamationIcon, Text} from '@/ui-kit';
import type {CalendarEvent, SeriesActionScope} from '@/types';

import classes from './EventChip.module.css';

type EventChipProps = {
    event: CalendarEvent;
    utcOffset: string;
    allDayLabel: string;
    onPress?: (event: CalendarEvent) => void;
    onEdit?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    onDelete?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    'data-testid'?: string;
};

export const EventChip: React.FC<EventChipProps> = ({
    event,
    utcOffset,
    allDayLabel,
    onPress,
    onEdit,
    onDelete,
    'data-testid': dataTestId,
}) => {
    const labels = useLabels();

    const handlePress = useCallback(() => {
        onPress?.(event);
    }, [event, onPress]);

    const {pressProps} = usePress({
        onPress: event.isClickable ? handlePress : undefined,
    });

    const showHoverActions = event.hasHoverActions && Boolean(onEdit || onDelete);

    const hoverActionHandlers = useMemo(
        () => ({
            onEdit: onEdit ? (scope: SeriesActionScope) => onEdit(event, scope) : undefined,
            onDelete: onDelete ? (scope: SeriesActionScope) => onDelete(event, scope) : undefined,
        }),
        [event, onEdit, onDelete],
    );

    const timeText = event.isAllDay ? allDayLabel : formatEventTime(event, utcOffset);

    return (
        <div
            {...(event.isClickable ? pressProps : undefined)}
            role={event.isClickable ? 'button' : undefined}
            aria-label={event.isClickable ? event.title : undefined}
            tabIndex={event.isClickable ? 0 : undefined}
            className={cn(
                classes.chip,
                eventVariantClassName(event.variant),
                (event.isClickable || showHoverActions) && classes.interactive,
            )}
            data-testid={dataTestId}
        >
            {timeText && (
                <Text variant="caption2" weight="medium" className={classes.time}>
                    {timeText}
                </Text>
            )}
            <Box alignItems="center" className={classes.titleRow}>
                <Text
                    display="inline-block"
                    variant="caption2"
                    weight="medium"
                    className={classes.title}
                >
                    {event.title}
                </Text>
                {event.isCritical && (
                    <ExclamationIcon size={12} className={variantClasses.criticalIcon} />
                )}
                {showHoverActions && (
                    <EventHoverActions
                        className={classes.hoverActions}
                        data-testid={dataTestId ? `${dataTestId}-actions` : undefined}
                        {...hoverActionHandlers}
                    />
                )}
            </Box>
            {event.isOverdue && (
                <Text variant="caption2" weight="medium" className={variantClasses.overdueLabel}>
                    {labels.overdue}
                </Text>
            )}
        </div>
    );
};
