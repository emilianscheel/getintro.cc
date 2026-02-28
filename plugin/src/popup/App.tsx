import { useEffect, useMemo, useState } from "react";
import type { OnboardingState, OnboardingStep, PipelineResult } from "../lib/types";
import { MESSAGE_TYPE } from "../lib/messages";
import { sendRuntimeMessage } from "../lib/runtime";
import { PRELOADED_MISTRAL_API_KEY } from "../lib/integrations/mistral-config";
import { PopupShell } from "../components/popup-shell";
import { HelloView } from "./views/hello-view";
import { OnboardingView } from "./views/onboarding-view";
import { RunView } from "./views/run-view";
import { ResultFormView } from "./views/result-form-view";

type Screen = "hello" | "onboarding" | "run" | "running" | "results";

const initialState: OnboardingState = {
  started: false,
  googleConnected: false,
  googleEmail: undefined,
  mistralKeySet: false,
  rocketreachKeySet: false,
  completed: false
};

export const App = () => {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [screen, setScreen] = useState<Screen>("hello");
  const [activeStep, setActiveStep] = useState<OnboardingStep>("google");
  const [countdown, setCountdown] = useState(5);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<PipelineResult | null>(null);
  const [onboardingPrefill, setOnboardingPrefill] = useState<{
    mistral: string;
    rocketreach: string;
  }>({
    mistral: PRELOADED_MISTRAL_API_KEY ?? "",
    rocketreach: ""
  });

  const resolveInitialScreen = (onboardingState: OnboardingState): Screen => {
    if (!onboardingState.started) {
      return "hello";
    }

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
      setScreen(resolveInitialScreen(response.state));
    })();
  }, []);

  const updateAuthState = (next: OnboardingState) => {
    setState(next);

    if (!next.started) {
      setScreen("hello");
      return;
    }

    if (!next.completed && (screen === "run" || screen === "results")) {
      setScreen("onboarding");
      return;
    }

    if (next.completed && screen === "onboarding") {
      setScreen("run");
    }
  };

  const runAuthAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);

    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unexpected action error"
      );
    } finally {
      setBusy(false);
    }
  };

  const onGetStarted = () => {
    void runAuthAction(async () => {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPE.MARK_STARTED });

      if (!response.ok || response.type !== MESSAGE_TYPE.AUTH_STATUS_CHANGED) {
        throw new Error(response.ok ? "Failed to start onboarding." : response.error);
      }

      updateAuthState(response.state);
      setScreen("onboarding");
      setActiveStep("google");
    });
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

  const saveApiKey = async (provider: "mistral" | "rocketreach", value: string) => {
    await runAuthAction(async () => {
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

  const runPipeline = async () => {
    setError(null);
    setBusy(true);
    setScreen("running");
    setCountdown(5);

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 0) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.START_PIPELINE,
        countdownSeconds: 5
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
      window.clearInterval(timer);
      setCountdown(0);
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
        <div className="mb-3 rounded-md border border-white/40 bg-black/20 px-3 py-2 text-xs text-white">
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
      <div className="flex h-full flex-col">
        {banner}

        {screen === "hello" ? <HelloView onGetStarted={onGetStarted} /> : null}

        {screen === "onboarding" ? (
          <OnboardingView
            state={state}
            activeStep={activeStep}
            busy={busy}
            onStepChange={setActiveStep}
            onConnectGoogle={onConnectGoogle}
            onSaveMistralKey={(value) => saveApiKey("mistral", value)}
            onSaveRocketReachKey={(value) => saveApiKey("rocketreach", value)}
            onComplete={() => setScreen("run")}
            initialMistralKey={onboardingPrefill.mistral}
            initialRocketReachKey={onboardingPrefill.rocketreach}
          />
        ) : null}

        {screen === "run" || screen === "running" ? (
          <RunView
            countdown={countdown}
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
            onRestartOnboarding={restartOnboarding}
          />
        ) : null}
      </div>
    </PopupShell>
  );
};
