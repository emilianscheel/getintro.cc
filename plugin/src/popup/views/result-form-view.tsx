import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Candidate, DraftAndSendRequest, PipelineResult } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

type ResultFormViewProps = {
    fromEmail: string;
    result: PipelineResult;
    submitting: boolean;
    onSubmit: (payload: DraftAndSendRequest) => Promise<void>;
    onRunAgain: () => Promise<void>;
};

const DEFAULT_MESSAGE = "hi, would you like to meet for a coffee? Daniel from Creandum";

const formatCandidateLabel = (candidate: Candidate): string => {
    if (!candidate.role.trim()) {
        return candidate.name;
    }

    return `${candidate.name} · ${candidate.role}`;
};

export const ResultFormView = ({
    fromEmail,
    result,
    submitting,
    onSubmit,
    onRunAgain,
}: ResultFormViewProps) => {
    const [recipientOpen, setRecipientOpen] = useState(false);
    const [recipientQuery, setRecipientQuery] = useState("");
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
        result.candidates[0] ?? null,
    );
    const [message, setMessage] = useState(DEFAULT_MESSAGE);
    const recipientContainerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const canSubmit = Boolean(selectedCandidate?.email) && message.trim().length > 0;

    useEffect(() => {
        if (!recipientOpen) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [recipientOpen]);

    useEffect(() => {
        if (!recipientOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (!recipientContainerRef.current?.contains(event.target as Node)) {
                setRecipientOpen(false);
                setRecipientQuery("");
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setRecipientOpen(false);
                setRecipientQuery("");
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [recipientOpen]);

    const selectedLabel = useMemo(() => {
        if (!selectedCandidate) {
            return "Select recipient";
        }

        return formatCandidateLabel(selectedCandidate);
    }, [selectedCandidate]);

    const filteredCandidates = useMemo(() => {
        const query = recipientQuery.trim().toLowerCase();

        if (!query) {
            return result.candidates;
        }

        return result.candidates.filter((candidate) =>
            [candidate.name, candidate.role, candidate.email ?? ""]
                .join(" ")
                .toLowerCase()
                .includes(query),
        );
    }, [recipientQuery, result.candidates]);

    return (
        <div className="flex h-full w-full min-h-0 flex-col overflow-visible py-2">
            <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-visible text-white">
                <div className="flex w-full flex-col gap-6">
                    <div className="w-full space-y-2">
                        <div className="relative w-full" ref={recipientContainerRef}>
                            <button
                                type="button"
                                aria-label="Select recipient"
                                aria-expanded={recipientOpen}
                                className="flex h-9 w-full items-center justify-between rounded-full border border-white/50 bg-white/20 px-4 py-2 text-left text-sm font-medium text-white backdrop-blur-sm shadow-button transition-colors-and-shadows duration-300 ease-out ring-1 ring-white/10 ring-offset-2 ring-offset-white/10 hover:border-white/15 hover:bg-white/30 hover:ring-white/15 hover:ring-offset-4 hover:ring-offset-black/20 hover:shadow-button-hover focus-visible:border-white/15 focus-visible:bg-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black/20 focus-visible:shadow-button-hover"
                                onClick={() => {
                                    setRecipientOpen((current) => {
                                        if (current) {
                                            setRecipientQuery("");
                                        }

                                        return !current;
                                    });
                                }}
                            >
                                <span className="line-clamp-1">{selectedLabel}</span>
                                <ChevronDown
                                    className={cn(
                                        "ml-2 h-4 w-4 shrink-0 text-white/70 transition-transform duration-200",
                                        recipientOpen ? "rotate-180 text-white" : "",
                                    )}
                                />
                            </button>

                            {recipientOpen ? (
                                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-2 text-zinc-900 shadow-button backdrop-blur-xl ring-1 ring-black/5">
                                    <Input
                                        ref={searchInputRef}
                                        aria-label="Search recipients"
                                        placeholder="Search by name, role, or email"
                                        value={recipientQuery}
                                        onChange={(event) => setRecipientQuery(event.target.value)}
                                        className="h-9 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm text-zinc-900 shadow-none ring-1 ring-black/5 ring-offset-0 placeholder:text-zinc-500 hover:border-zinc-300 hover:bg-white hover:ring-black/10 focus-visible:border-zinc-300 focus-visible:bg-white focus-visible:ring-black/20 focus-visible:ring-offset-0"
                                    />

                                    <div className="mt-2 max-h-52 overflow-y-auto pr-1">
                                        {filteredCandidates.length === 0 ? (
                                            <p className="px-3 py-5 text-center text-xs text-zinc-500">
                                                No recipients match your search.
                                            </p>
                                        ) : null}

                                        {filteredCandidates.map((candidate, index) => {
                                            const isSelected = candidate === selectedCandidate;

                                            return (
                                                <button
                                                    key={`${candidate.name}-${candidate.email ?? "none"}-${index}`}
                                                    type="button"
                                                    className={cn(
                                                        "mb-1 w-full rounded-xl border border-transparent bg-white/60 px-3 py-2 text-left transition-colors-and-shadows duration-200 last:mb-0 hover:border-zinc-200 hover:bg-white hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300/60",
                                                        isSelected
                                                            ? "border-zinc-200 bg-white shadow-soft"
                                                            : "",
                                                    )}
                                                    onClick={() => {
                                                        setSelectedCandidate(candidate);
                                                        setRecipientOpen(false);
                                                        setRecipientQuery("");
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="flex min-w-0 items-center gap-1.5">
                                                                <span className="truncate text-sm font-medium text-zinc-900">
                                                                    {candidate.name}
                                                                </span>
                                                                <span className="truncate text-[10px] text-zinc-500">
                                                                    {candidate.role}
                                                                </span>
                                                            </p>
                                                            <p className="truncate text-xs text-zinc-500">
                                                                {candidate.email ??
                                                                    "no email found"}
                                                            </p>
                                                        </div>
                                                        <Check
                                                            className={cn(
                                                                "h-4 w-4 shrink-0 text-zinc-600 transition-opacity",
                                                                isSelected
                                                                    ? "opacity-100"
                                                                    : "opacity-0",
                                                            )}
                                                        />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="w-full">
                        <Textarea
                            id="message"
                            aria-label="Message"
                            className="h-44 w-full resize-none"
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
                                message,
                            });
                        }}
                    >
                        Submit
                    </Button>
                </div>

                <button
                    type="button"
                    className="mx-auto block text-sm font-medium text-white/80 underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none hover:text-white"
                    onClick={() => void onRunAgain()}
                >
                    Run again
                </button>

                {!selectedCandidate?.email ? (
                    <p className="text-xs text-white/70">
                        Selected candidate has no email. Choose one with an email address to submit.
                    </p>
                ) : null}
            </div>
        </div>
    );
};
