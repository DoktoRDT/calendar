import React from 'react';

type IconProps = {
    size?: number;
    className?: string;
};

export const ExclamationIcon: React.FC<IconProps> = ({size = 12, className}) => (
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
            d="M12 2C9.34784 2 6.8043 3.05357 4.92893 4.92893C3.05357 6.8043 2 9.34784 2 12C2 14.6522 3.05357 17.1957 4.92893 19.0711C6.8043 20.9464 9.34784 22 12 22C14.6522 22 17.1957 20.9464 19.0711 19.0711C20.9464 17.1957 22 14.6522 22 12C22 9.34784 20.9464 6.8043 19.0711 4.92893C17.1957 3.05357 14.6522 2 12 2ZM11 14L10.5 6H13.5L13 14H11ZM12 19C12.9665 19 13.75 18.2165 13.75 17.25C13.75 16.2835 12.9665 15.5 12 15.5C11.0335 15.5 10.25 16.2835 10.25 17.25C10.25 18.2165 11.0335 19 12 19Z"
            fill="currentColor"
        />
    </svg>
);
