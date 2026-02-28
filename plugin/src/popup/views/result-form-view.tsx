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
  onOpenSettings: () => void;
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
  onOpenSettings
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Results
        </p>
        <h2 className="text-xl font-semibold text-zinc-900">Draft outreach</h2>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Badge>{result.partial ? "Partial" : "Complete"}</Badge>
          <span>
            {result.visitedUrls.length} pages crawled · {result.candidates.length} candidates
          </span>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3">
        <p className="text-sm">
          <span className="font-medium text-zinc-700">From:</span> {fromEmail}
        </p>

        <div className="space-y-2">
          <Label>To</Label>
          <div className="relative">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-left text-sm"
              onClick={() => setToOpen((current) => !current)}
            >
              <span className="line-clamp-1">{selectedLabel}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-zinc-500" />
            </button>

            {toOpen ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-soft">
                {result.candidates.map((candidate, index) => (
                  <button
                    key={`${candidate.name}-${candidate.email ?? "none"}-${index}`}
                    type="button"
                    className="w-full border-b border-zinc-100 px-3 py-2 text-left last:border-b-0 hover:bg-zinc-50"
                    onClick={() => {
                      setSelectedCandidate(candidate);
                      setToOpen(false);
                    }}
                  >
                    <p className="text-sm font-medium text-zinc-800">{candidate.name}</p>
                    <p className="text-xs text-zinc-400">
                      {candidate.email ?? "no email found"} · {candidate.role}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
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
          <Send className="mr-2 h-4 w-4" />
          Submit
        </Button>

        {!selectedCandidate?.email ? (
          <p className="text-xs text-amber-700">
            Selected candidate has no email. Choose one with an email address to submit.
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => void onRunAgain()}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Run again
        </Button>
        <Button variant="outline" className="flex-1" onClick={onOpenSettings}>
          Settings
        </Button>
      </div>
    </div>
  );
};
