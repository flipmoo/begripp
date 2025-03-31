import React from 'react';
import { PersonIcon, ReloadIcon, InfoCircledIcon } from '@radix-ui/react-icons';

export function IconPerson({ className, ...props }: React.ComponentProps<typeof PersonIcon>) {
  return <PersonIcon className={className} {...props} />;
}

export function IconSync({ className, ...props }: React.ComponentProps<typeof ReloadIcon>) {
  return <ReloadIcon className={className} {...props} />;
}

export function IconInfo({ className, ...props }: React.ComponentProps<typeof InfoCircledIcon>) {
  return <InfoCircledIcon className={className} {...props} />;
} 