import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors-and-shadows duration-300 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-800/60 focus-visible:ring-offset-4 focus-visible:ring-offset-black/10 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-white/35 bg-zinc-900/70 text-primary-foreground ring-1 ring-transparent shadow-button backdrop-blur-sm hover:border-white/55 hover:bg-zinc-900/85 hover:shadow-button-hover",
        secondary:
          "border border-white/45 bg-white/20 text-white backdrop-blur-sm hover:border-white/60 hover:bg-white/35",
        ghost:
          "border border-transparent bg-transparent text-white hover:bg-white/20",
        outline:
          "border border-white/55 bg-transparent text-white hover:bg-white/20"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
