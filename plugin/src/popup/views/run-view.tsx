import { LoaderCircle, Settings2 } from "lucide-react";
import { Button } from "../../components/ui/button";

type RunViewProps = {
  countdown: number;
  running: boolean;
  onRun: () => Promise<void>;
  onRestartOnboarding: () => void;
};

export const RunView = ({
  countdown,
  running,
  onRun,
  onRestartOnboarding
}: RunViewProps) => {
  return (
    <div className="flex h-full flex-col overflow-y-auto pr-1">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRestartOnboarding}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center">
        {running ? (
          <div className="text-center">
            <p className="text-5xl font-semibold tabular-nums text-white">{countdown}</p>
            <div className="mt-3 flex items-center justify-center text-xs text-white/80">
              <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
              Running...
            </div>
          </div>
        ) : (
          <Button
            className="min-w-[180px] border-white/70 bg-white/25 text-white hover:bg-white/35"
            onClick={() => void onRun()}
          >
            Get intro
          </Button>
        )}
      </div>

      {running ? (
        <div className="flex items-center justify-center text-xs text-white/80">
          <span>Please keep this popup open.</span>
        </div>
      ) : null}
    </div>
  );
};
