import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
  icon: 'h-10 w-10'
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

/**
 * Design-system ready button inspired by shadcn/ui with Tailwind classes.
 * Use the `variant` and `size` props to align the component with product guidelines.
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLElement, ButtonProps>(
  (
    { className, variant = 'default', size = 'md', isLoading, leftIcon, rightIcon, children, asChild = false, ...props },
    ref
  ) => {
    const classes = cn(
      'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60',
      variantClasses[variant],
      sizeClasses[size],
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string; ref?: React.Ref<HTMLElement> }>, {
        className: cn(classes, children.props.className),
        ref
      });
    }

    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} className={classes} aria-busy={isLoading} {...props}>
        {leftIcon}
        <span>{isLoading ? 'Loading…' : children}</span>
        {rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
