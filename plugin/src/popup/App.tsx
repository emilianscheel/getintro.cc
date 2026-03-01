import { useEffect, useMemo, useState } from "react";
import type { OnboardingState, OnboardingStep, PipelineResult } from "../lib/types";
import { MESSAGE_TYPE } from "../lib/messages";
import { sendRuntimeMessage } from "../lib/runtime";
import { PRELOADED_MISTRAL_API_KEY } from "../lib/integrations/mistral-config";
import { PopupShell } from "../components/popup-shell";
import { OnboardingView } from "./views/onboarding-view";
import { RunView } from "./views/run-view";
import { ResultFormView } from "./views/result-form-view";

type Screen = "onboarding" | "run" | "running" | "results";

const initialState: OnboardingState = {
  started: false,
  googleConnected: false,
  googleName: undefined,
  googleEmail: undefined,
  mistralKeySet: false,
  rocketreachKeySet: false,
  customDraftPrompt: undefined,
  completed: false
};

export const App = () => {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [activeStep, setActiveStep] = useState<OnboardingStep>("google");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<PipelineResult | null>(null);
  const [onboardingPrefill, setOnboardingPrefill] = useState<{
    mistral: string;
    rocketreach: string;
    customDraftPrompt: string;
  }>({
    mistral: PRELOADED_MISTRAL_API_KEY ?? "",
    rocketreach: "",
    customDraftPrompt: ""
  });

  const resolveInitialScreen = (onboardingState: OnboardingState): Screen => {
    if (!onboardingState.completed) {
      return "onboarding";
    }

    return "run";
  };

  useEffect(() => {
    void (async () => {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPE.GET_STATE });

      if (!response.ok || response.type !== "STATE") {
        setError(response.ok ? "Failed to load state." : response.error);
        return;
      }

      setState(response.state);
      setOnboardingPrefill((current) => ({
        ...current,
        customDraftPrompt: response.state.customDraftPrompt ?? ""
      }));
      setScreen(resolveInitialScreen(response.state));
    })();
  }, []);

  const updateAuthState = (next: OnboardingState) => {
    setState(next);
    setOnboardingPrefill((current) => ({
      ...current,
      customDraftPrompt: next.customDraftPrompt ?? current.customDraftPrompt
    }));

    if (!next.completed && (screen === "run" || screen === "results")) {
      setScreen("onboarding");
      return;
    }

    if (next.completed && screen === "onboarding") {
      setScreen("run");
    }
  };

  const runAuthAction = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);

    try {
      await action();
      return true;
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unexpected action error"
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onConnectGoogle = async () => {
    await runAuthAction(async () => {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPE.START_GOOGLE_AUTH });

      if (!response.ok || response.type !== MESSAGE_TYPE.AUTH_STATUS_CHANGED) {
        throw new Error(response.ok ? "Google sign-in failed." : response.error);
      }

      updateAuthState(response.state);
    });
  };

  const onDisconnectGoogle = async () => {
    await runAuthAction(async () => {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPE.DISCONNECT_GOOGLE });

      if (!response.ok || response.type !== MESSAGE_TYPE.AUTH_STATUS_CHANGED) {
        throw new Error(response.ok ? "Google sign-out failed." : response.error);
      }

      updateAuthState(response.state);
      setActiveStep("google");
    });
  };

  const saveApiKey = async (
    provider: "mistral" | "rocketreach",
    value: string
  ): Promise<boolean> => {
    return runAuthAction(async () => {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.SAVE_API_KEY,
        provider,
        value
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.AUTH_STATUS_CHANGED) {
        throw new Error(response.ok ? "Failed to save API key." : response.error);
      }

      updateAuthState(response.state);
      setOnboardingPrefill((current) => ({
        ...current,
        [provider]: value.trim()
      }));
    });
  };

  const saveCustomDraftPrompt = async (value: string): Promise<boolean> => {
    return runAuthAction(async () => {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.SAVE_CUSTOM_DRAFT_PROMPT,
        value
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.AUTH_STATUS_CHANGED) {
        throw new Error(response.ok ? "Failed to save custom draft prompt." : response.error);
      }

      updateAuthState(response.state);
      setOnboardingPrefill((current) => ({
        ...current,
        customDraftPrompt: value
      }));
    });
  };

  const runPipeline = async () => {
    setError(null);
    setBusy(true);
    setScreen("running");

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.START_PIPELINE
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.PIPELINE_RESULT) {
        throw new Error(response.ok ? "Pipeline failed." : response.error);
      }

      setLatestResult(response.result);
      setScreen("results");
    } catch (pipelineError) {
      setError(
        pipelineError instanceof Error
          ? pipelineError.message
          : "Pipeline failed unexpectedly."
      );
      setScreen("run");
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (payload: {
    fromEmail: string;
    toEmail: string;
    subject: string;
    message: string;
  }) => {
    setError(null);
    setSubmitting(true);

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.SUBMIT_EMAIL,
        payload
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.EMAIL_SENT) {
        throw new Error(response.ok ? "Failed to send email." : response.error);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit email."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const banner = useMemo(() => {
    if (error) {
      return (
        <div className="absolute inset-x-0 top-0 z-20 rounded-md border border-white/40 bg-black/20 px-3 py-2 text-xs text-white backdrop-blur-sm">
          <span>{error}</span>
        </div>
      );
    }

    return null;
  }, [error]);

  const restartOnboarding = () => {
    setError(null);
    setActiveStep("google");
    setScreen("onboarding");
  };

  return (
    <PopupShell>
      <div className="relative flex h-full w-full items-center justify-center py-2">
        {banner}

        {screen === "onboarding" ? (
          <OnboardingView
            state={state}
            activeStep={activeStep}
            busy={busy}
            onStepChange={setActiveStep}
            onConnectGoogle={onConnectGoogle}
            onDisconnectGoogle={onDisconnectGoogle}
            onSaveMistralKey={(value) => saveApiKey("mistral", value)}
            onSaveRocketReachKey={(value) => saveApiKey("rocketreach", value)}
            onSaveCustomDraftPrompt={saveCustomDraftPrompt}
            onComplete={() => setScreen("run")}
            initialMistralKey={onboardingPrefill.mistral}
            initialRocketReachKey={onboardingPrefill.rocketreach}
            initialCustomDraftPrompt={onboardingPrefill.customDraftPrompt}
          />
        ) : null}

        {screen === "run" || screen === "running" ? (
          <RunView
            running={screen === "running"}
            onRun={runPipeline}
            onRestartOnboarding={restartOnboarding}
          />
        ) : null}

        {screen === "results" && latestResult ? (
          <ResultFormView
            fromEmail={state.googleEmail ?? "unknown@google.com"}
            result={latestResult}
            submitting={submitting}
            onSubmit={submitEmail}
            onRunAgain={runPipeline}
          />
        ) : null}
      </div>
    </PopupShell>
  );
};
