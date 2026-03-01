import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type ToastViewportProps = {
  className?: string;
  children: ReactNode;
};

type ToastProps = {
  className?: string;
  open?: boolean;
  children: ReactNode;
};

type ToastDescriptionProps = {
  className?: string;
  children: ReactNode;
};

export const ToastViewport = ({ className, children }: ToastViewportProps) => {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex w-full flex-col items-center gap-2 px-4 pb-4",
        className
      )}
    >
      {children}
    </div>
  );
};

export const Toast = ({ className, open = true, children }: ToastProps) => {
  return (
    <div
      className={cn(
        "group pointer-events-auto relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/45 bg-white/15 p-4 text-white shadow-button backdrop-blur-2xl ring-1 ring-white/35 transition-all duration-200",
        open ? "toast-enter" : "toast-exit",
        className
      )}
    >
      {children}
    </div>
  );
};

export const ToastDescription = ({ className, children }: ToastDescriptionProps) => {
  return <div className={cn("text-xs text-white/90", className)}>{children}</div>;
};
