export const utcOffsetOptions = [
    {value: '-05:00', label: 'New York (-05:00)'},
    {value: '+00:00', label: 'UTC (+00:00)'},
    {value: '+03:00', label: 'Moscow (+03:00)'},
    {value: '+05:30', label: 'India (+05:30)'},
    {value: '+09:00', label: 'Tokyo (+09:00)'},
] as const;

export type UtcOffsetValue = (typeof utcOffsetOptions)[number]['value'];
