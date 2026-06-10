import React from 'react';
import {Button, Menu, MenuItem, MenuTrigger, Popover} from 'react-aria-components';

import cn from 'classnames';

import buttonReset from '@/ui-kit/styles/buttonReset.module.css';

import classes from './ActionMenu.module.css';

export type ActionMenuOption<T extends string = string> = {
    key: T;
    text: string;
};

type ActionMenuProps<T extends string> = {
    icon: React.ReactNode;
    items: ActionMenuOption<T>[];
    onSelect: (key: T) => void;
    className?: string;
    'data-testid'?: string;
    'aria-label': string;
};

const stopParentPress = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
};

export function ActionMenu<T extends string>({
    icon,
    items,
    onSelect,
    className,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
}: ActionMenuProps<T>) {
    return (
        <MenuTrigger>
            <Button
                className={cn(buttonReset.reset, classes.trigger, className)}
                onPointerDown={stopParentPress}
                aria-label={ariaLabel}
                data-testid={dataTestId ? `${dataTestId}-trigger` : undefined}
            >
                {icon}
            </Button>
            <Popover className={classes.popover} placement="bottom end">
                <Menu className={classes.menu} onAction={key => onSelect(key as T)}>
                    {items.map(item => (
                        <MenuItem
                            key={item.key}
                            id={item.key}
                            className={classes.item}
                            data-testid={dataTestId ? `${dataTestId}-option-${item.key}` : undefined}
                        >
                            {item.text}
                        </MenuItem>
                    ))}
                </Menu>
            </Popover>
        </MenuTrigger>
    );
}
