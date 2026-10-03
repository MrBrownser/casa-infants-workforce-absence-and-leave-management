import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold tracking-[0.01em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:opacity-[0.88] active:scale-[0.98] active:opacity-80',
        secondary:
          'bg-hover text-foreground hover:bg-selected active:scale-[0.98]',
        accent:
          'bg-accent text-accent-foreground hover:opacity-[0.88] active:scale-[0.98] active:opacity-80',
        outline:
          'border border-muted-foreground bg-transparent text-muted-foreground hover:bg-hover hover:text-foreground hover:border-foreground active:scale-[0.98]',
        ghost:
          'text-foreground hover:bg-hover active:scale-[0.98]',
        destructive:
          'bg-error-bg text-error hover:bg-[#fdd9d9] active:scale-[0.98]',
        link:
          'text-primary underline-offset-4 hover:underline active:opacity-70',
      },
      size: {
        default: 'h-[38px] px-[18px] text-[0.8125rem] rounded-xl',
        sm:      'h-[34px] px-[14px] text-[0.75rem] rounded-xl',
        lg:      'h-12 px-8 text-sm rounded-xl',
        icon:    'h-[38px] w-[38px] rounded-xl',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
