import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[#333] bg-[#1a1a1a] text-[#888]',
        success: 'border-[#00cc88]/20 bg-[#00cc88]/10 text-[#00cc88]',
        error: 'border-[#ff4444]/20 bg-[#ff4444]/10 text-[#ff4444]',
        blue: 'border-[#0070f3]/20 bg-[#0070f3]/10 text-[#0070f3]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
