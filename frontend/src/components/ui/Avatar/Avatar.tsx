'use client';

import { cn, getInitials } from '@/lib/utils';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(styles.avatar, styles[size], className)}
      />
    );
  }
  
  return (
    <div className={cn(styles.avatar, styles.placeholder, styles[size], className)}>
    {initials}
    </div>
  );
}
