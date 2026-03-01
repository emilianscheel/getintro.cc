import { useMemo } from "react";
import { LoaderCircle } from "lucide-react";
import type { OutreachRecord } from "../../lib/types";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";

type PastOutreachesViewProps = {
  items: OutreachRecord[];
  loading: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onBack: () => void;
  onRefresh: () => Promise<void>;
};

const matchesQuery = (item: OutreachRecord, query: string): boolean => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    item.status,
    item.hostname,
    item.toEmail,
    item.bccEmails.join(" "),
    item.recipientEmail,
    item.senderEmail,
    item.subject,
    item.body,
    item.gmailUrl
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
};

export const PastOutreachesView = ({
  items,
  loading,
  searchQuery,
  onSearchQueryChange,
  onBack,
  onRefresh
}: PastOutreachesViewProps) => {
  const filtered = useMemo(
    () => items.filter((item) => matchesQuery(item, searchQuery)),
    [items, searchQuery]
  );

  return (
    <div className="popup-view-enter-top flex h-full w-full min-h-0 flex-col py-2 text-white">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="block text-sm font-medium text-white/80 underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none hover:text-white"
          onClick={onBack}
        >
          Back
        </button>
        <button
          type="button"
          disabled={loading}
          className="block text-sm font-medium text-white/80 underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void onRefresh()}
        >
          Refresh
        </button>
      </div>

      <Input
        aria-label="Search past outreaches"
        placeholder="Search past outreaches"
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
      />

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="mt-4 flex items-center justify-center text-xs text-white/80">
            <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
            Loading...
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="mt-5 text-center text-xs text-white/80">No past outreaches yet.</p>
        ) : null}

        {!loading && items.length > 0 && filtered.length === 0 ? (
          <p className="mt-5 text-center text-xs text-white/80">
            No outreaches match your search.
          </p>
        ) : null}

        {!loading
          ? filtered.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "mb-2 rounded-2xl border border-white/[0.45] bg-white/[0.12] p-3 text-white shadow-button backdrop-blur-2xl ring-1 ring-white/[0.35]",
                  "last:mb-0"
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{item.subject || "(no subject)"}</p>
                  <span className="text-[10px] uppercase text-white/80">{item.status}</span>
                </div>
                <p className="truncate text-xs text-white/80">To: {item.toEmail}</p>
                {item.bccEmails.length > 0 ? (
                  <p className="truncate text-[11px] text-white/75">
                    Bcc: {item.bccEmails.join(", ")}
                  </p>
                ) : null}
                <p className="truncate text-[11px] text-white/70">{item.hostname}</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-white/80">{item.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-white/70">
                    {new Date(item.createdAtMs).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="block text-sm font-medium text-white/80 underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none hover:text-white"
                    onClick={() => window.open(item.gmailUrl, "_blank", "noopener,noreferrer")}
                  >
                    open in gmail
                  </button>
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
};
