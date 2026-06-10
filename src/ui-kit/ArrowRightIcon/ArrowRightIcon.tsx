import React from 'react';

type IconProps = {
    size?: number;
    className?: string;
};

export const ArrowRightIcon: React.FC<IconProps> = ({size = 16, className}) => (
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
            d="M4 11H16.2L10.6 5.4L12 4L20 12L12 20L10.6 18.6L16.2 13H4V11Z"
            fill="currentColor"
        />
    </svg>
);
