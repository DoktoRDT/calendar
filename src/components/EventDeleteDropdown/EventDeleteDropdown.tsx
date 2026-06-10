import React, {useMemo} from 'react';

import {useLabels} from '@/labels/LabelsContext';
import {ActionMenu, TrashIcon} from '@/ui-kit';
import type {SeriesActionScope} from '@/types';

type EventDeleteDropdownProps = {
    onSelect: (scope: SeriesActionScope) => void;
    'data-testid'?: string;
};

export const EventDeleteDropdown: React.FC<EventDeleteDropdownProps> = ({
    onSelect,
    'data-testid': dataTestId,
}) => {
    const labels = useLabels();

    const items = useMemo(
        () => [
            {key: 'single' as const, text: labels.deleteSingle},
            {key: 'series' as const, text: labels.deleteSeries},
        ],
        [labels.deleteSingle, labels.deleteSeries],
    );

    return (
        <ActionMenu
            icon={<TrashIcon size={16} />}
            aria-label={labels.deleteEvent}
            items={items}
            onSelect={onSelect}
            data-testid={dataTestId}
        />
    );
};
