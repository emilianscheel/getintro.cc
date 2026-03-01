import { useEffect, useMemo, useRef, useState } from "react";
import type { OnboardingState, OnboardingStep } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../../lib/integrations/email-enrichment/config";
import { isMistralAvailable } from "../../lib/integrations/mistral-config";
import { cn } from "../../lib/utils";

type OnboardingViewProps = {
  state: OnboardingState;
  activeStep: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onSaveMistralKey: (value: string) => Promise<boolean>;
  onSaveRocketReachKey: (value: string) => Promise<boolean>;
  onSaveCustomDraftPrompt: (value: string) => Promise<boolean>;
  onComplete: () => void;
  busy: boolean;
  initialMistralKey: string;
  initialRocketReachKey: string;
  initialCustomDraftPrompt: string;
};

const STEP_ORDER: OnboardingStep[] = ["google", "mistral", "rocketreach", "customPrompt"];
const STEP_TRANSITION_MS = 240;

type TransitionDirection = "forward" | "backward";

const getStepDirection = (
  fromStep: OnboardingStep,
  toStep: OnboardingStep
): TransitionDirection => {
  return STEP_ORDER.indexOf(toStep) >= STEP_ORDER.indexOf(fromStep) ? "forward" : "backward";
};

export const OnboardingView = ({
  state,
  activeStep,
  onStepChange,
  onConnectGoogle,
  onDisconnectGoogle,
  onSaveMistralKey,
  onSaveRocketReachKey,
  onSaveCustomDraftPrompt,
  onComplete,
  busy,
  initialMistralKey,
  initialRocketReachKey,
  initialCustomDraftPrompt
}: OnboardingViewProps) => {
  const [mistralKey, setMistralKey] = useState(initialMistralKey);
  const [rocketreachKey, setRocketreachKey] = useState(initialRocketReachKey);
  const [customDraftPrompt, setCustomDraftPrompt] = useState(initialCustomDraftPrompt);
  const [displayStep, setDisplayStep] = useState<OnboardingStep>(activeStep);
  const [incomingStep, setIncomingStep] = useState<OnboardingStep | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>("forward");
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setMistralKey(initialMistralKey);
  }, [initialMistralKey]);

  useEffect(() => {
    setRocketreachKey(initialRocketReachKey);
  }, [initialRocketReachKey]);

  useEffect(() => {
    setCustomDraftPrompt(initialCustomDraftPrompt);
  }, [initialCustomDraftPrompt]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeStep === displayStep) {
      return;
    }

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    setTransitionDirection(getStepDirection(displayStep, activeStep));
    setIncomingStep(activeStep);
    transitionTimeoutRef.current = window.setTimeout(() => {
      setDisplayStep(activeStep);
      setIncomingStep(null);
      transitionTimeoutRef.current = null;
    }, STEP_TRANSITION_MS);
  }, [activeStep, displayStep]);

  const stepCompletion = useMemo(
    () => ({
      google: state.googleConnected,
      mistral: isMistralAvailable(state.mistralKeySet),
      rocketreach: ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING
        ? state.rocketreachKeySet
        : true
    }),
    [state.googleConnected, state.mistralKeySet, state.rocketreachKeySet]
  );

  const goForwardFrom = (step: OnboardingStep) => {
    const stepIndex = STEP_ORDER.indexOf(step);
    const nextStep = STEP_ORDER[stepIndex + 1];

    if (!nextStep) {
      onComplete();
      return;
    }

    onStepChange(nextStep);
  };

  const renderStep = (step: OnboardingStep) => {
    if (step === "mistral") {
      return (
        <div className="w-full space-y-3">
          <div className="space-y-2">
            <Label
              htmlFor="mistral-key"
              className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Mistral API Key
            </Label>
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
            disabled={busy || (!mistralKey.trim() && !stepCompletion.mistral)}
            onClick={async () => {
              if (!mistralKey.trim()) {
                goForwardFrom(step);
                return;
              }

              const saved = await onSaveMistralKey(mistralKey);

              if (saved) {
                setMistralKey(mistralKey.trim());
                goForwardFrom(step);
              }
            }}
          >
            Next
          </Button>
        </div>
      );
    }

    if (step === "rocketreach") {
      return (
        <div className="w-full space-y-3">
          <div className="space-y-2">
            <Label
              htmlFor="rocketreach-key"
              className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              RocketReach API Key
            </Label>
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
            disabled={
              busy ||
              (!rocketreachKey.trim() &&
                ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING &&
                !stepCompletion.rocketreach)
            }
            onClick={async () => {
              if (!rocketreachKey.trim()) {
                goForwardFrom(step);
                return;
              }

              const saved = await onSaveRocketReachKey(rocketreachKey);

              if (saved) {
                setRocketreachKey(rocketreachKey.trim());
                goForwardFrom(step);
              }
            }}
          >
            Next
          </Button>
        </div>
      );
    }

    if (step === "customPrompt") {
      return (
        <div className="w-full space-y-3">
          <div className="space-y-2">
            <Label
              htmlFor="custom-draft-prompt"
              className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Additional message prompt
            </Label>
            <Textarea
              id="custom-draft-prompt"
              placeholder="Customize the draft message generated by the plugin. Suggest language (e.g. English), length (e.g. 2-3 short sentences), and tone (e.g. friendly/professional). Include possible call-to-actions such as: quick intro call, share deck, reply with availability, or connect to the right person."
              value={customDraftPrompt}
              onChange={(event) => setCustomDraftPrompt(event.target.value)}
              className="h-32 placeholder:text-[#e5e7eb]"
            />
          </div>
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              const saved = await onSaveCustomDraftPrompt(customDraftPrompt);

              if (saved) {
                onComplete();
              }
            }}
          >
            Finish
          </Button>
        </div>
      );
    }

    return (
      <div className="w-full space-y-6">
        <h1 className="text-center font-instrument text-5xl italic text-white">getintro.cc</h1>
        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (state.googleConnected) {
                goForwardFrom(step);
                return;
              }

              void onConnectGoogle();
            }}
          >
            {state.googleConnected ? "Continue" : "Sign in with Google"}
          </Button>
          {state.googleConnected ? (
            <button
              type="button"
              className="mx-auto block text-sm font-medium text-white/80 underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none hover:text-white"
              disabled={busy}
              onClick={() => void onDisconnectGoogle()}
            >
              sign out
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="popup-view-enter-top flex h-full w-full items-center justify-center">
      <div className="h-full w-full px-3 py-2">
        <div className="relative h-full w-full overflow-hidden">
          <div
            className={cn(
              "onboarding-step-layer absolute inset-0",
              incomingStep
                ? transitionDirection === "forward"
                  ? "onboarding-step-exit-left pointer-events-none"
                  : "onboarding-step-exit-right pointer-events-none"
                : ""
            )}
          >
            {renderStep(displayStep)}
          </div>

          {incomingStep ? (
            <div
              className={cn(
                "onboarding-step-layer pointer-events-none absolute inset-0",
                transitionDirection === "forward"
                  ? "onboarding-step-enter-right"
                  : "onboarding-step-enter-left"
              )}
            >
              {renderStep(incomingStep)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
