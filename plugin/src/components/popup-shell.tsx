import type { ReactNode } from "react";
import { ShaderBackground } from "./shader-background";

export const PopupShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative min-h-[560px] w-[380px] overflow-hidden">
      <ShaderBackground />
      <div className="relative z-10 p-3">
        <div className="h-[534px] overflow-hidden rounded-2xl bg-white/20 p-4 shadow-card backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
};
