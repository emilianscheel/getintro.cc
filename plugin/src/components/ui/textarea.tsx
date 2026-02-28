import * as React from "react";
import { cn } from "../../lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-2xl border border-white/50 bg-white/20 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm shadow-button transition-colors-and-shadows duration-300 ease-out placeholder:text-white/70 ring-1 ring-white/10 ring-offset-2 ring-offset-white/10 hover:border-white/15 hover:bg-white/30 hover:ring-white/15 hover:ring-offset-4 hover:ring-offset-black/20 hover:shadow-button-hover focus-visible:border-white/15 focus-visible:bg-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black/20 focus-visible:shadow-button-hover disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
