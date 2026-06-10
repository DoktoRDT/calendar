import React, {createContext, useContext} from 'react';

import {defaultLabels, mergeLabels} from './defaultLabels';
import type {CalendarLabels} from './types';

const LabelsContext = createContext<CalendarLabels>(defaultLabels);

type LabelsProviderProps = {
    labels?: Partial<CalendarLabels>;
    children: React.ReactNode;
};

export const LabelsProvider: React.FC<LabelsProviderProps> = ({labels, children}) => (
    <LabelsContext.Provider value={mergeLabels(labels)}>{children}</LabelsContext.Provider>
);

export function useLabels(): CalendarLabels {
    return useContext(LabelsContext);
}
