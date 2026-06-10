import React, {useMemo} from 'react';

import {useLabels} from '@/labels/LabelsContext';
import {ActionMenu, EditIcon} from '@/ui-kit';
import type {SeriesActionScope} from '@/types';

type EventEditDropdownProps = {
    onSelect: (scope: SeriesActionScope) => void;
    'data-testid'?: string;
};

export const EventEditDropdown: React.FC<EventEditDropdownProps> = ({
    onSelect,
    'data-testid': dataTestId,
}) => {
    const labels = useLabels();

    const items = useMemo(
        () => [
            {key: 'single' as const, text: labels.editSingle},
            {key: 'series' as const, text: labels.editSeries},
        ],
        [labels.editSingle, labels.editSeries],
    );

    return (
        <ActionMenu
            icon={<EditIcon size={16} />}
            aria-label={labels.editEvent}
            items={items}
            onSelect={onSelect}
            data-testid={dataTestId}
        />
    );
};
