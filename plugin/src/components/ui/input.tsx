import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-full border-2 border-white/50 bg-white/20 px-4 py-2 text-sm text-zinc-900 backdrop-blur-sm transition-[background-color,box-shadow,border-color] duration-200 ease-out placeholder:text-zinc-600/80 focus-visible:border-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900/25 focus-visible:ring-offset-4 focus-visible:ring-offset-black/10 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
