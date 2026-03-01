import { Button } from "../../components/ui/button";

type EmailSentViewProps = {
    gmailUrl: string;
};

export const EmailSentView = ({ gmailUrl }: EmailSentViewProps) => {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 py-2">
            <div className="mt-3 text-xs text-white/80">Sent successfully.</div>
            <Button
                className="min-w-[180px]"
                onClick={() => window.open(gmailUrl, "_blank", "noopener,noreferrer")}
            >
                open in gmail
            </Button>
        </div>
    );
};
