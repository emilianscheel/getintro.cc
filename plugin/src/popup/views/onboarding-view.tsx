import { useEffect, useMemo, useRef, useState } from "react";
import type { OnboardingState, OnboardingStep } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../../lib/integrations/email-enrichment/config";
import {
  isMistralAvailable
} from "../../lib/integrations/mistral-config";

type OnboardingViewProps = {
  state: OnboardingState;
  activeStep: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
  onConnectGoogle: () => Promise<void>;
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
    <div className="flex h-full flex-col overflow-y-auto pr-1">
      <div className="flex-1" />

      <div className="mt-auto space-y-3 pb-1">
        {activeStep === "mistral" ? (
          <Input
            id="mistral-key"
            type="password"
            placeholder="mistral-..."
            value={mistralKey}
            onChange={(event) => setMistralKey(event.target.value)}
            autoComplete="off"
          />
        ) : null}

        {activeStep === "rocketreach" ? (
          <Input
            id="rocketreach-key"
            type="password"
            placeholder="rr-..."
            value={rocketreachKey}
            onChange={(event) => setRocketreachKey(event.target.value)}
            autoComplete="off"
          />
        ) : null}

        {activeStep === "google" ? (
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
            {state.googleConnected ? "Next" : "Connect Google"}
          </Button>
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
