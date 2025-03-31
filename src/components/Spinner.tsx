import React from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

type SpinnerSize = 'small' | 'medium' | 'large';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export default function Spinner({ size = 'medium', className }: SpinnerProps) {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-6 w-6',
    large: 'h-8 w-8',
  };

  return (
    <ReloadIcon
      className={cn(
        'animate-spin text-primary',
        sizeClasses[size],
        className
      )}
    />
  );
} 