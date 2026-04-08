'use client';

import styles from './Spinner.module.css';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return <div className={cn(styles.spinner, styles[size], className)} />;
}
