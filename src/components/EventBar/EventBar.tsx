import React, {useCallback, useMemo} from 'react';
import {usePress} from '@react-aria/interactions';

import cn from 'classnames';

import {EventHoverActions} from '@/components/EventHoverActions';
import {eventVariantClassName, variantClasses} from '@/components/shared/eventVariants';
import {useLabels} from '@/labels/LabelsContext';
import {Box, ExclamationIcon, Text} from '@/ui-kit';
import type {CalendarEvent, SeriesActionScope} from '@/types';
import type {EventSegment} from '@/core/buildWeekLayout';

import classes from './EventBar.module.css';

type EventBarProps = {
    event: CalendarEvent;
    segmentKind: EventSegment['segmentKind'];
    utcOffset: string;
    locale: string;
    onPress?: (event: CalendarEvent) => void;
    onEdit?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    onDelete?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    'data-testid'?: string;
};

export const EventBar: React.FC<EventBarProps> = ({
    event,
    segmentKind,
    utcOffset,
    locale,
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

    const endIso = event.end ?? event.start;

    let timing: string;
    let untilDate: string | null = null;

    if (segmentKind === 'whole') {
        const startStr = labels.formatBarDateTime(event.start, utcOffset, locale);
        const endStr = labels.formatBarDateTime(endIso, utcOffset, locale);
        timing = `${startStr} — ${endStr}`;
    } else if (segmentKind === 'first') {
        timing = labels.formatBarTime(event.start, utcOffset);
        untilDate = labels.untilDate(labels.formatBarDate(endIso, utcOffset, locale));
    } else if (segmentKind === 'last') {
        timing = labels.untilTime(labels.formatBarTime(endIso, utcOffset));
    } else {
        timing = '';
    }

    return (
        <div
            {...(event.isClickable ? pressProps : undefined)}
            role={event.isClickable ? 'button' : undefined}
            aria-label={event.isClickable ? event.title : undefined}
            tabIndex={event.isClickable ? 0 : undefined}
            className={cn(
                classes.bar,
                eventVariantClassName(event.variant),
                (event.isClickable || showHoverActions) && classes.interactive,
            )}
            data-testid={dataTestId}
        >
            <Box alignItems="center" gap="xs" className={classes.firstRow}>
                {timing && (
                    <Text variant="caption2" weight="medium" className={classes.timing}>
                        {timing}
                    </Text>
                )}
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
                <Box className={classes.right}>
                    {untilDate && (
                        <Text variant="caption2" weight="medium" className={classes.until}>
                            {untilDate}
                        </Text>
                    )}
                    {showHoverActions && (
                        <EventHoverActions
                            className={classes.hoverActions}
                            data-testid={dataTestId ? `${dataTestId}-actions` : undefined}
                            {...hoverActionHandlers}
                        />
                    )}
                </Box>
            </Box>
            {event.isOverdue && (
                <Text variant="caption2" weight="medium" className={variantClasses.overdueLabel}>
                    {labels.overdue}
                </Text>
            )}
        </div>
    );
};
