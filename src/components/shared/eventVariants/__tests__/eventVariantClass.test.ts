import {describe, expect, it} from 'vitest';

import {eventVariantClassName, variantClasses} from '@/components/shared/eventVariants';

describe('eventVariantClassName', () => {
    it('maps every variant to a scoped CSS module class', () => {
        const variants = ['red', 'blue', 'green', 'grey'] as const;

        for (const variant of variants) {
            const className = eventVariantClassName(variant);
            expect(className).toBeTruthy();
            expect(className).toMatch(/variantRed|variantBlue|variantGreen|variantGrey/);
        }
    });

    it('exposes camelCase keys in the CSS module map', () => {
        expect(variantClasses.variantRed).toMatch(/variantRed/);
        expect(variantClasses.variantBlue).toMatch(/variantBlue/);
        expect(variantClasses.variantGreen).toMatch(/variantGreen/);
        expect(variantClasses.variantGrey).toMatch(/variantGrey/);
    });
});
