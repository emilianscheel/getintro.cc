import { ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";

type HelloViewProps = {
  onGetStarted: () => void;
};

export const HelloView = ({ onGetStarted }: HelloViewProps) => {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Welcome
        </p>
        <h1 className="text-4xl font-semibold text-zinc-900">getintro.cc</h1>
        <p className="text-sm leading-6 text-zinc-600">
          Sign in once, add your API keys, then discover likely co-founder contacts
          and send Gmail outreach from your toolbar.
        </p>
      </div>

      <Button className="mt-8 w-full" size="lg" onClick={onGetStarted}>
        Get started
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};
