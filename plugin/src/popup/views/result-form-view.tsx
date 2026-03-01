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

const isUnknownRole = (role: string): boolean => role.trim().toLowerCase() === "unknown";

const hasDisplayRole = (candidate: Candidate): boolean => {
    const role = candidate.role.trim();
    return role.length > 0 && !isUnknownRole(role);
};

const resolveDraftForSelection = (
    selectedCandidates: Candidate[],
    multiRecipientDraft?: string,
): string => {
    const normalizedMultiDraft = multiRecipientDraft?.trim() || "";

    if (selectedCandidates.length > 1) {
        return normalizedMultiDraft || DEFAULT_MESSAGE;
    }

    if (selectedCandidates.length === 1) {
        const candidateDraft = selectedCandidates[0].draft?.trim() || "";
        return candidateDraft || normalizedMultiDraft || DEFAULT_MESSAGE;
    }

    return normalizedMultiDraft || DEFAULT_MESSAGE;
};

export const ResultFormView = ({
    fromEmail,
    result,
    submitting,
    onSubmit,
    onRunAgain,
}: ResultFormViewProps) => {
    const firstCandidate = result.candidates[0];
    const [recipientOpen, setRecipientOpen] = useState(false);
    const [recipientQuery, setRecipientQuery] = useState("");
    const [selectedCandidates, setSelectedCandidates] = useState<Candidate[]>(() => {
        return firstCandidate ? [firstCandidate] : [];
    });
    const [message, setMessage] = useState(() =>
        resolveDraftForSelection(firstCandidate ? [firstCandidate] : [], result.multiRecipientDraft),
    );
    const recipientContainerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedRecipientEmails = useMemo(() => {
        const seen = new Set<string>();
        const emails: string[] = [];

        for (const candidate of selectedCandidates) {
            const email = candidate.email?.trim();

            if (!email) {
                continue;
            }

            const normalized = email.toLowerCase();

            if (seen.has(normalized)) {
                continue;
            }

            seen.add(normalized);
            emails.push(email);
        }

        return emails;
    }, [selectedCandidates]);

    const canSubmit = selectedRecipientEmails.length > 0 && message.trim().length > 0;

    const selectedDraft = useMemo(
        () => resolveDraftForSelection(selectedCandidates, result.multiRecipientDraft),
        [selectedCandidates, result.multiRecipientDraft],
    );

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
        setMessage(selectedDraft);
    }, [selectedDraft]);

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

    const selectedEmailsLabel = useMemo(() => {
        if (selectedRecipientEmails.length === 0) {
            return "Select recipients";
        }

        if (selectedRecipientEmails.length <= 3) {
            return selectedRecipientEmails.join(", ");
        }

        const shown = selectedRecipientEmails.slice(0, 3).join(", ");
        const hiddenCount = selectedRecipientEmails.length - 3;

        return `${shown} +${hiddenCount} more`;
    }, [selectedRecipientEmails]);

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
                                aria-label="Select recipients"
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
                                <span
                                    className={cn(
                                        "line-clamp-1",
                                        selectedRecipientEmails.length > 1 ? "text-[10px]" : "",
                                    )}
                                >
                                    {selectedEmailsLabel}
                                </span>
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
                                            const isSelected = selectedCandidates.includes(candidate);

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
                                                        setSelectedCandidates((current) => {
                                                            if (current.includes(candidate)) {
                                                                return current.filter(
                                                                    (currentCandidate) =>
                                                                        currentCandidate !== candidate,
                                                                );
                                                            }

                                                            return [...current, candidate];
                                                        });
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="flex min-w-0 items-center gap-1.5">
                                                                <span className="truncate text-sm font-medium text-zinc-900">
                                                                    {candidate.name}
                                                                </span>
                                                                {hasDisplayRole(candidate) ? (
                                                                    <span className="truncate text-[10px] text-zinc-500">
                                                                        {candidate.role.trim()}
                                                                    </span>
                                                                ) : null}
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
                            if (selectedRecipientEmails.length === 0) {
                                return;
                            }

                            void onSubmit({
                                fromEmail,
                                toEmail: selectedRecipientEmails.join(", "),
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

                {selectedRecipientEmails.length === 0 ? (
                    <p className="text-xs text-white/70">
                        Select at least one candidate with an email address to submit.
                    </p>
                ) : null}
            </div>
        </div>
    );
};
