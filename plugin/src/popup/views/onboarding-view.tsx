import { useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import type { OnboardingState, OnboardingStep } from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle
} from "../../components/ui/card";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../../lib/integrations/email-enrichment/config";

type OnboardingViewProps = {
  state: OnboardingState;
  activeStep: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onSaveMistralKey: (value: string) => Promise<void>;
  onSaveRocketReachKey: (value: string) => Promise<void>;
  onComplete: () => void;
  busy: boolean;
};

const STEP_ORDER: OnboardingStep[] = ["google", "mistral", "rocketreach"];

export const OnboardingView = ({
  state,
  activeStep,
  onStepChange,
  onConnectGoogle,
  onDisconnectGoogle,
  onSaveMistralKey,
  onSaveRocketReachKey,
  onComplete,
  busy
}: OnboardingViewProps) => {
  const [mistralKey, setMistralKey] = useState("");
  const [rocketreachKey, setRocketreachKey] = useState("");

  const stepCompletion = useMemo(
    () => ({
      google: state.googleConnected,
      mistral: state.mistralKeySet,
      rocketreach: ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING
        ? state.rocketreachKeySet
        : true
    }),
    [state.googleConnected, state.mistralKeySet, state.rocketreachKeySet]
  );

  const activeIndex = STEP_ORDER.indexOf(activeStep);

  const goNext = () => {
    const next = STEP_ORDER[Math.min(activeIndex + 1, STEP_ORDER.length - 1)];
    onStepChange(next);
  };

  const goPrevious = () => {
    const previous = STEP_ORDER[Math.max(activeIndex - 1, 0)];
    onStepChange(previous);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Onboarding
        </p>
        <h2 className="text-xl font-semibold text-zinc-900">Setup your extension</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STEP_ORDER.map((step, index) => {
          const isDone = stepCompletion[step];
          const isActive = step === activeStep;

          return (
            <button
              key={step}
              type="button"
              onClick={() => onStepChange(step)}
              className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Step {index + 1}</span>
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              </div>
              <p className="mt-1 text-xs capitalize">{step}</p>
            </button>
          );
        })}
      </div>

      {activeStep === "google" ? (
        <Card>
          <CardContent className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Google Sign-In
            </CardTitle>
            <CardDescription>
              Connect your Google account to draft and send Gmail messages.
            </CardDescription>

            {state.googleConnected ? (
              <div className="space-y-3">
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Connected as {state.googleEmail}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => void onConnectGoogle()}
                  >
                    Reconnect
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => void onDisconnectGoogle()}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <Button className="w-full" disabled={busy} onClick={() => void onConnectGoogle()}>
                Sign in with Google
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeStep === "mistral" ? (
        <Card>
          <CardContent className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Mistral API Key
            </CardTitle>
            <CardDescription>
              Stored locally in encrypted form and only decrypted in background runtime.
            </CardDescription>

            {state.mistralKeySet ? (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                Key already saved
              </Badge>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="mistral-key">Mistral key</Label>
              <Input
                id="mistral-key"
                type="password"
                placeholder="mistral-..."
                value={mistralKey}
                onChange={(event) => setMistralKey(event.target.value)}
                autoComplete="off"
              />
            </div>

            <Button
              className="w-full"
              disabled={busy || !mistralKey.trim()}
              onClick={async () => {
                await onSaveMistralKey(mistralKey);
                setMistralKey("");
              }}
            >
              Save encrypted key
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {activeStep === "rocketreach" ? (
        <Card>
          <CardContent className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              RocketReach API Key
            </CardTitle>
            <CardDescription>
              {ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING
                ? "Required for candidate email enrichment in the background pipeline."
                : "Optional in development. The mock provider runs first, so RocketReach calls are skipped by default."}
            </CardDescription>

            {state.rocketreachKeySet ? (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                Key already saved
              </Badge>
            ) : !ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING ? (
              <Badge className="border-zinc-200 bg-zinc-50 text-zinc-600">
                Optional right now
              </Badge>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="rocketreach-key">RocketReach key</Label>
              <Input
                id="rocketreach-key"
                type="password"
                placeholder="rr-..."
                value={rocketreachKey}
                onChange={(event) => setRocketreachKey(event.target.value)}
                autoComplete="off"
              />
            </div>

            <Button
              className="w-full"
              disabled={busy || !rocketreachKey.trim()}
              onClick={async () => {
                await onSaveRocketReachKey(rocketreachKey);
                setRocketreachKey("");
              }}
            >
              Save encrypted key
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2">
        <Button variant="outline" disabled={activeIndex === 0} onClick={goPrevious}>
          Previous
        </Button>

        {state.completed ? (
          <Button onClick={onComplete}>Continue</Button>
        ) : (
          <Button variant="secondary" onClick={goNext}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
};
