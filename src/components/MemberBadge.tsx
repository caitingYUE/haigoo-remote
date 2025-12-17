import React from 'react';
import { Target, Sparkles } from 'lucide-react';

interface MemberBadgeProps {
    variant?: 'referral' | 'verified' | 'featured';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const MemberBadge: React.FC<MemberBadgeProps> = ({
    variant = 'referral',
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base'
    };

    const iconSizes = {
        sm: 'w-3 h-3',
        md: 'w-3.5 h-3.5',
        lg: 'w-4 h-4'
    };

    if (variant === 'referral') {
        return (
            <span
                className={`inline-flex items-center gap-1 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 text-yellow-800 font-bold rounded-full ${sizeClasses[size]} ${className}`}
            >
                <Target className={iconSizes[size]} />
                可内推
            </span>
        );
    }

    if (variant === 'verified') {
        return (
            <span
                className={`inline-flex items-center gap-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 text-green-800 font-bold rounded-full ${sizeClasses[size]} ${className}`}
            >
                <Sparkles className={iconSizes[size]} />
                已审核
            </span>
        );
    }

    if (variant === 'featured') {
        return (
            <span
                className={`inline-flex items-center gap-1 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-300 text-purple-800 font-bold rounded-full ${sizeClasses[size]} ${className}`}
            >
                <Sparkles className={iconSizes[size]} />
                精选
            </span>
        );
    }

    return null;
};
