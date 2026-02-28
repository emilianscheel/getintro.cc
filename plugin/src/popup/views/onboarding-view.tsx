import { useEffect, useMemo, useRef, useState } from "react";
import type { OnboardingState, OnboardingStep } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../../lib/integrations/email-enrichment/config";
import {
  isMistralAvailable
} from "../../lib/integrations/mistral-config";

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
  initialMistralKey: string;
  initialRocketReachKey: string;
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
  busy,
  initialMistralKey,
  initialRocketReachKey
}: OnboardingViewProps) => {
  const [mistralKey, setMistralKey] = useState(initialMistralKey);
  const [rocketreachKey, setRocketreachKey] = useState(initialRocketReachKey);

  useEffect(() => {
    setMistralKey(initialMistralKey);
  }, [initialMistralKey]);

  useEffect(() => {
    setRocketreachKey(initialRocketReachKey);
  }, [initialRocketReachKey]);

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

  const previousCompletionRef = useRef(stepCompletion);
  const activeStepIndex = STEP_ORDER.indexOf(activeStep);

  const goForward = () => {
    const nextStep = STEP_ORDER[activeStepIndex + 1];

    if (!nextStep) {
      onComplete();
      return;
    }

    onStepChange(nextStep);
  };

  useEffect(() => {
    const previousCompletion = previousCompletionRef.current;
    const activeJustCompleted =
      !previousCompletion[activeStep] && stepCompletion[activeStep];

    if (activeJustCompleted) {
      const nextIncompleteStep = STEP_ORDER.find((step) => !stepCompletion[step]);

      if (!nextIncompleteStep) {
        onComplete();
      } else {
        onStepChange(nextIncompleteStep);
      }
    }

    previousCompletionRef.current = stepCompletion;
  }, [activeStep, onComplete, onStepChange, stepCompletion]);

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

              const wasComplete = stepCompletion.mistral;
              await onSaveMistralKey(mistralKey);
              setMistralKey(mistralKey.trim());

              if (wasComplete) {
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

              const wasComplete = stepCompletion.rocketreach;
              await onSaveRocketReachKey(rocketreachKey);
              setRocketreachKey(rocketreachKey.trim());

              if (wasComplete) {
                goForward();
              }
            }}
          >
            Next
          </Button>
        ) : null}
      </div>
    </div>
  );
};
