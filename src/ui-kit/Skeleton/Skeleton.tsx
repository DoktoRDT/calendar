import React from 'react';

import cn from 'classnames';

import classes from './Skeleton.module.css';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton: React.FC<SkeletonProps> = ({className, style, ...props}) => (
    <div className={cn(classes.skeleton, className)} style={style} {...props} />
);
