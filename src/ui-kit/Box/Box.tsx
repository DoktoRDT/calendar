import React from 'react';

import cn from 'classnames';

import classes from './Box.module.css';

type BoxProps = React.HTMLAttributes<HTMLDivElement> & {
    direction?: 'row' | 'column';
    display?: 'flex' | 'block';
    alignItems?: 'center';
    justifyContent?: 'center';
    gap?: 'xs' | 's';
    p?: 's';
};

export const Box: React.FC<BoxProps> = ({
    direction = 'row',
    display = 'flex',
    alignItems,
    justifyContent,
    gap,
    p,
    className,
    children,
    ...props
}) => (
    <div
        className={cn(
            classes.box,
            display === 'block' && classes.block,
            direction === 'column' ? classes.column : classes.row,
            alignItems === 'center' && classes.alignCenter,
            justifyContent === 'center' && classes.justifyCenter,
            gap === 'xs' && classes.gapXs,
            gap === 's' && classes.gapS,
            p === 's' && classes.pS,
            className,
        )}
        {...props}
    >
        {children}
    </div>
);
