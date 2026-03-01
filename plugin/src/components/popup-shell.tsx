import type { ReactNode } from "react";
import { ShaderBackground } from "./shader-background";

export const PopupShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative h-[560px] w-[380px] overflow-hidden">
      <ShaderBackground />
      <div className="relative flex h-full w-full items-center justify-center px-4 py-6">
        <div className="flex h-full w-full max-w-[320px] flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
};
