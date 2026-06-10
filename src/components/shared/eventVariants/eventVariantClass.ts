import type {CalendarEventVariant} from '@/types';

import variantClasses from './eventVariants.module.css';

export function eventVariantClassName(variant: CalendarEventVariant): string {
    switch (variant) {
        case 'red':
            return variantClasses.variantRed;
        case 'blue':
            return variantClasses.variantBlue;
        case 'green':
            return variantClasses.variantGreen;
        case 'grey':
            return variantClasses.variantGrey;
        default: {
            const _exhaustive: never = variant;
            return _exhaustive;
        }
    }
}

export {variantClasses};
