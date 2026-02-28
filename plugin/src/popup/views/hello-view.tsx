import { ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";

type HelloViewProps = {
  onGetStarted: () => void;
};

export const HelloView = ({ onGetStarted }: HelloViewProps) => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full space-y-6 text-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
            Welcome
          </p>
          <h1 className="text-4xl font-semibold text-white">getintro.cc</h1>
          <p className="text-sm leading-6 text-white/85">
            Sign in once, add your API keys, then discover likely co-founder contacts
            and send Gmail outreach from your toolbar.
          </p>
        </div>

        <Button className="w-full" size="lg" onClick={onGetStarted}>
          Get started
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </div>
  );
};
