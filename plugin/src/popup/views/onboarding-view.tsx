import { useEffect, useMemo, useState } from "react";
import type { OnboardingState, OnboardingStep } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../../lib/integrations/email-enrichment/config";
import { isMistralAvailable } from "../../lib/integrations/mistral-config";

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

  useEffect(() => {
    setMistralKey(initialMistralKey);
  }, [initialMistralKey]);

  useEffect(() => {
    setRocketreachKey(initialRocketReachKey);
  }, [initialRocketReachKey]);

  useEffect(() => {
    setCustomDraftPrompt(initialCustomDraftPrompt);
  }, [initialCustomDraftPrompt]);

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

  const activeStepIndex = STEP_ORDER.indexOf(activeStep);

  const goForward = () => {
    const nextStep = STEP_ORDER[activeStepIndex + 1];

    if (!nextStep) {
      onComplete();
      return;
    }

    onStepChange(nextStep);
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full space-y-3">
        {activeStep === "mistral" ? (
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
        ) : null}

        {activeStep === "rocketreach" ? (
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
        ) : null}

        {activeStep === "customPrompt" ? (
          <div className="space-y-2">
            <Label
              htmlFor="custom-draft-prompt"
              className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Additional message prompt
            </Label>
            <Textarea
              id="custom-draft-prompt"
              value={customDraftPrompt}
              onChange={(event) => setCustomDraftPrompt(event.target.value)}
              className="h-32"
            />
          </div>
        ) : null}

        {activeStep === "google" ? (
          <div className="space-y-6">
            <h1 className="text-center font-instrument text-5xl italic text-white">
              getintro.cc
            </h1>
            <div className="space-y-3">
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => {
                  if (state.googleConnected) {
                    goForward();
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
        ) : null}

        {activeStep === "mistral" ? (
          <Button
            className="w-full"
            disabled={busy || (!mistralKey.trim() && !stepCompletion.mistral)}
            onClick={async () => {
              if (!mistralKey.trim()) {
                goForward();
                return;
              }

              const saved = await onSaveMistralKey(mistralKey);

              if (saved) {
                setMistralKey(mistralKey.trim());
                goForward();
              }
            }}
          >
            Next
          </Button>
        ) : null}

        {activeStep === "rocketreach" ? (
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
                goForward();
                return;
              }

              const saved = await onSaveRocketReachKey(rocketreachKey);

              if (saved) {
                setRocketreachKey(rocketreachKey.trim());
                goForward();
              }
            }}
          >
            Next
          </Button>
        ) : null}

        {activeStep === "customPrompt" ? (
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
        ) : null}
      </div>
    </div>
  );
};
