import React from 'react';
import {useHover, usePress} from '@react-aria/interactions';

import cn from 'classnames';

import classes from './IconButton.module.css';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: () => void;
    iconOnly?: boolean;
};

export const IconButton: React.FC<IconButtonProps> = ({
    className,
    onPress,
    iconOnly,
    children,
    ...props
}) => {
    const {hoverProps, isHovered} = useHover({});
    const {pressProps, isPressed} = usePress({onPress});

    return (
        <button
            type="button"
            className={cn(
                classes.button,
                iconOnly && classes.iconOnly,
                isHovered && classes.hovered,
                onPress && isPressed && classes.pressed,
                className,
            )}
            {...props}
            {...hoverProps}
            {...(onPress ? pressProps : {})}
        >
            {children}
        </button>
    );
};
