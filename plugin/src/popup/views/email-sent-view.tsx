import type { OutreachStatus } from "../../lib/types";
import { Button } from "../../components/ui/button";

type EmailSentViewProps = {
    gmailUrl: string;
    status: OutreachStatus;
};

export const EmailSentView = ({ gmailUrl, status }: EmailSentViewProps) => {
    return (
        <div className="popup-view-enter-top flex h-full w-full flex-col items-center justify-center gap-4 py-2">
            <div className="mt-3 text-xs text-white/80">
                {status === "sent" ? "Sent successfully." : "Saved as draft."}
            </div>
            <Button
                className="min-w-[180px]"
                onClick={() => window.open(gmailUrl, "_blank", "noopener,noreferrer")}
            >
                open in gmail
            </Button>
        </div>
    );
};
