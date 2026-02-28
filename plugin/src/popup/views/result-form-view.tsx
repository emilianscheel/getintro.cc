import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Send } from "lucide-react";
import type {
  Candidate,
  DraftAndSendRequest,
  PipelineResult
} from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";

type ResultFormViewProps = {
  fromEmail: string;
  result: PipelineResult;
  submitting: boolean;
  onSubmit: (payload: DraftAndSendRequest) => Promise<void>;
  onRunAgain: () => Promise<void>;
  onRestartOnboarding: () => void;
};

const DEFAULT_MESSAGE =
  "hi, would you like to meet for a coffee? Daniel from Creandum";

const formatCandidateLabel = (candidate: Candidate): string => {
  const email = candidate.email ?? "no email found";
  return `${candidate.name} (${email}) · ${candidate.role}`;
};

export const ResultFormView = ({
  fromEmail,
  result,
  submitting,
  onSubmit,
  onRunAgain,
  onRestartOnboarding
}: ResultFormViewProps) => {
  const [toOpen, setToOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    result.candidates[0] ?? null
  );
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  const canSubmit = Boolean(selectedCandidate?.email) && message.trim().length > 0;

  const selectedLabel = useMemo(() => {
    if (!selectedCandidate) {
      return "Select candidate";
    }

    return formatCandidateLabel(selectedCandidate);
  }, [selectedCandidate]);

  return (
    <div className="flex h-full flex-col justify-center gap-4 overflow-y-auto py-2 pr-1">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
          Results
        </p>
        <h2 className="text-xl font-semibold text-white">Draft outreach</h2>
        <div className="flex items-center gap-2 text-xs text-white/80">
          <Badge>{result.partial ? "Partial" : "Complete"}</Badge>
          <span>
            {result.visitedUrls.length} pages crawled · {result.candidates.length} candidates
          </span>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-white/40 bg-black/20 p-3 text-white">
        <p className="text-sm">
          <span className="font-medium text-white/80">From:</span> {fromEmail}
        </p>

        <div className="space-y-2">
          <Label className="text-white">To</Label>
          <div className="relative">
            <button
              type="button"
              className="flex h-9 w-full items-center justify-between rounded-full border border-white/50 bg-white/20 px-4 py-2 text-left text-sm font-medium text-white backdrop-blur-sm shadow-button transition-colors-and-shadows duration-300 ease-out ring-1 ring-white/10 ring-offset-2 ring-offset-white/10 hover:border-white/15 hover:bg-white/30 hover:ring-white/15 hover:ring-offset-4 hover:ring-offset-black/20 hover:shadow-button-hover focus-visible:border-white/15 focus-visible:bg-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black/20 focus-visible:shadow-button-hover"
              onClick={() => setToOpen((current) => !current)}
            >
              <span className="line-clamp-1">{selectedLabel}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-white/70" />
            </button>

            {toOpen ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-white/30 bg-zinc-900 shadow-soft">
                {result.candidates.map((candidate, index) => (
                  <button
                    key={`${candidate.name}-${candidate.email ?? "none"}-${index}`}
                    type="button"
                    className="w-full border-b border-white/10 px-3 py-2 text-left last:border-b-0 hover:bg-white/10"
                    onClick={() => {
                      setSelectedCandidate(candidate);
                      setToOpen(false);
                    }}
                  >
                    <p className="text-sm font-medium text-white">{candidate.name}</p>
                    <p className="text-xs text-white/60">
                      {candidate.email ?? "no email found"} · {candidate.role}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-white">
            Message
          </Label>
          <Textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <Button
          className="w-full"
          disabled={!canSubmit || submitting}
          onClick={() => {
            if (!selectedCandidate?.email) {
              return;
            }

            void onSubmit({
              fromEmail,
              toEmail: selectedCandidate.email,
              subject: `Intro from ${fromEmail}`,
              message
            });
          }}
        >
          <Send className="mr-2 size-4" />
          Submit
        </Button>

        {!selectedCandidate?.email ? (
          <p className="text-xs text-white/70">
            Selected candidate has no email. Choose one with an email address to submit.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void onRunAgain()}>
          <RotateCcw className="mr-2 size-4" />
          Run again
        </Button>
        <Button className="flex-1" onClick={onRestartOnboarding}>
          Restart setup
        </Button>
      </div>
    </div>
  );
};
