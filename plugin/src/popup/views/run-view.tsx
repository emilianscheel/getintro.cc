import { LoaderCircle, Play, Settings2 } from "lucide-react";
import type { OnboardingState, PipelineResult } from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle
} from "../../components/ui/card";

type RunViewProps = {
  state: OnboardingState;
  countdown: number;
  running: boolean;
  latestResult: PipelineResult | null;
  onRun: () => Promise<void>;
  onOpenSettings: () => void;
};

export const RunView = ({
  state,
  countdown,
  running,
  latestResult,
  onRun,
  onOpenSettings
}: RunViewProps) => {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Finder
          </p>
          <h2 className="text-xl font-semibold text-zinc-900">Co-founder pipeline</h2>
          <p className="text-xs text-zinc-600">Signed in as {state.googleEmail}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenSettings}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <CardTitle>Run on current website</CardTitle>
          <CardDescription>
            Crawls the current page plus same-host links (depth 2, deduplicated, max 25
            pages) in extension background only.
          </CardDescription>

          {running ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center">
              <p className="text-sm text-zinc-600">Pipeline running in background</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-zinc-900">
                {countdown}
              </p>
              <p className="mt-1 text-xs text-zinc-500">seconds left</p>
            </div>
          ) : (
            <Button className="w-full" onClick={() => void onRun()}>
              <Play className="mr-2 h-4 w-4" />
              Find co-founder information
            </Button>
          )}

          {running ? (
            <div className="flex items-center justify-center text-xs text-zinc-500">
              <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
              scraping, extracting, enriching
            </div>
          ) : null}
        </CardContent>
      </Card>

      {latestResult ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <Badge>{latestResult.partial ? "Partial" : "Complete"}</Badge>
            <span>{latestResult.candidates.length} candidates in latest run</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
