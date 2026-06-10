import React from 'react';

type IconProps = {
    size?: number;
    className?: string;
};

export const ArrowLeftIcon: React.FC<IconProps> = ({size = 16, className}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M7.8 11L13.4 5.4L12 4L4 12L12 20L13.4 18.6L7.8 13H20V11H7.8Z"
            fill="currentColor"
        />
    </svg>
);
