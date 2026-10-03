import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// "Clay" buttons (DESIGN.md → Clay depth): filled variants sit on a 2px darker
// edge that disappears on press while the button moves down 2px.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-[transform,box-shadow,background-color,color] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_2px_0_var(--color-primary-depth)] hover:bg-primary-hover active:translate-y-[2px] active:shadow-none',
        secondary:
          'bg-secondary text-secondary-foreground shadow-[0_2px_0_var(--color-sage)] hover:bg-sage/60 active:translate-y-[2px] active:shadow-none',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-hover active:translate-y-px',
        ghost:
          'text-foreground hover:bg-hover active:translate-y-px',
        destructive:
          'border border-error/35 bg-transparent text-error hover:bg-error-bg active:translate-y-px',
        link:
          'text-primary underline-offset-4 hover:underline active:opacity-70',
      },
      size: {
        default: 'h-10 px-[18px] text-sm rounded-lg',
        sm:      'h-[34px] px-3.5 text-[0.8125rem] rounded-md',
        lg:      'h-12 px-7 text-[0.9375rem] rounded-lg',
        icon:    'size-10 rounded-lg',
        'icon-sm': 'size-8 rounded-md',
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
