import React from 'react';

import cn from 'classnames';

import classes from './Text.module.css';

type TextVariant = 'caption1' | 'caption2' | 'body1';
type TextWeight = 'medium' | 'regular';
type TextColor = 'minor' | 'invert';

type TextProps = React.HTMLAttributes<HTMLSpanElement> & {
    variant?: TextVariant;
    weight?: TextWeight;
    color?: TextColor;
    display?: 'inline-block';
    as?: 'span' | 'p';
};

export const Text: React.FC<TextProps> = ({
    variant = 'body1',
    weight = 'regular',
    color,
    display,
    as: Component = 'span',
    className,
    children,
    ...props
}) => (
    <Component
        className={cn(
            classes.text,
            classes[variant],
            classes[weight],
            color === 'minor' && classes.minor,
            color === 'invert' && classes.invert,
            display === 'inline-block' && classes.inlineBlock,
            className,
        )}
        {...props}
    >
        {children}
    </Component>
);
