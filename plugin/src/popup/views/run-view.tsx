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
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 py-2">
      <div className="w-full space-y-4 text-center">
        {running ? (
          <div className="text-center">
            <p className="text-5xl font-semibold tabular-nums text-white">{countdown}</p>
            <div className="mt-3 flex items-center justify-center text-xs text-white/80">
              <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
              Running...
            </div>
          </div>
        ) : (
          <Button className="min-w-[180px]" onClick={() => void onRun()}>
            Get intro
          </Button>
        )}
      </div>

      {running ? (
        <div className="text-xs text-white/80">
          <span>Please keep this popup open.</span>
        </div>
      ) : null}

      <Button size="sm" className="mx-auto" onClick={onRestartOnboarding}>
        <Settings2 className="size-4" />
        Restart setup
      </Button>
    </div>
  );
};
