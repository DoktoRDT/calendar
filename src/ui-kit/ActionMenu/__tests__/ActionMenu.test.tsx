import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {describe, expect, it, vi} from 'vitest';

import {ActionMenu} from '@/ui-kit/ActionMenu';
import {EditIcon} from '@/ui-kit';

function ActionMenuHarness({onSelect = vi.fn()}: {onSelect?: (key: string) => void}) {
    return (
        <ActionMenu
            icon={<EditIcon size={16} />}
            aria-label="Edit"
            items={[
                {key: 'single', text: 'Single'},
                {key: 'series', text: 'Series'},
            ]}
            data-testid="action-menu"
            onSelect={onSelect}
        />
    );
}

describe('ActionMenu', () => {
    it('opens and selects an option', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(<ActionMenuHarness onSelect={onSelect} />);

        await user.click(screen.getByTestId('action-menu-trigger'));
        expect(screen.getByTestId('action-menu-option-single')).toBeInTheDocument();

        await user.click(screen.getByTestId('action-menu-option-series'));
        expect(onSelect).toHaveBeenCalledWith('series');
        expect(screen.queryByTestId('action-menu-option-series')).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
        const user = userEvent.setup();
        render(<ActionMenuHarness />);

        await user.click(screen.getByTestId('action-menu-trigger'));
        expect(screen.getByTestId('action-menu-option-single')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByTestId('action-menu-option-single')).not.toBeInTheDocument();
    });
});
