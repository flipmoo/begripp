import React from 'react';
import { Cross2Icon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export default function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div className={cn(
      'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative',
      className
    )}>
      <div className="flex items-center">
        <Cross2Icon className="h-5 w-5 mr-2 text-red-500" />
        <span>{message}</span>
      </div>
    </div>
  );
} 