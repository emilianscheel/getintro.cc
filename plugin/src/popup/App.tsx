import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { OnboardingState, OnboardingStep, PipelineResult } from "../lib/types";
import { MESSAGE_TYPE } from "../lib/messages";
import { sendRuntimeMessage } from "../lib/runtime";
import { PopupShell } from "../components/popup-shell";
import { HelloView } from "./views/hello-view";
import { OnboardingView } from "./views/onboarding-view";
import { RunView } from "./views/run-view";
import { ResultFormView } from "./views/result-form-view";
import { SettingsView } from "./views/settings-view";

type Screen = "hello" | "onboarding" | "run" | "running" | "results" | "settings";

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
  const [success, setSuccess] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<PipelineResult | null>(null);

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
    setSuccess(null);

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
      if (response.state.googleConnected) {
        setSuccess(`Google connected as ${response.state.googleEmail}`);
      }
    });
  };

  const onDisconnectGoogle = async () => {
    await runAuthAction(async () => {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPE.DISCONNECT_GOOGLE });

      if (!response.ok || response.type !== MESSAGE_TYPE.AUTH_STATUS_CHANGED) {
        throw new Error(response.ok ? "Google disconnect failed." : response.error);
      }

      updateAuthState(response.state);
      setSuccess("Google account disconnected.");
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
      setSuccess(`${provider} key saved in encrypted storage.`);
    });
  };

  const runPipeline = async () => {
    setError(null);
    setSuccess(null);
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
      setSuccess(
        response.result.partial
          ? "Returned partial result at countdown deadline."
          : "Pipeline completed successfully."
      );
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
    setSuccess(null);
    setSubmitting(true);

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.SUBMIT_EMAIL,
        payload
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.EMAIL_SENT) {
        throw new Error(response.ok ? "Failed to send email." : response.error);
      }

      setSuccess(`Email sent. Draft ${response.draftId}, message ${response.messageId}.`);
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
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      );
    }

    if (success) {
      return (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
          <span>{success}</span>
        </div>
      );
    }

    return null;
  }, [error, success]);

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
            onDisconnectGoogle={onDisconnectGoogle}
            onSaveMistralKey={(value) => saveApiKey("mistral", value)}
            onSaveRocketReachKey={(value) => saveApiKey("rocketreach", value)}
            onComplete={() => setScreen("run")}
          />
        ) : null}

        {screen === "run" || screen === "running" ? (
          <RunView
            state={state}
            countdown={countdown}
            running={screen === "running"}
            latestResult={latestResult}
            onRun={runPipeline}
            onOpenSettings={() => setScreen("settings")}
          />
        ) : null}

        {screen === "results" && latestResult ? (
          <ResultFormView
            fromEmail={state.googleEmail ?? "unknown@google.com"}
            result={latestResult}
            submitting={submitting}
            onSubmit={submitEmail}
            onRunAgain={runPipeline}
            onOpenSettings={() => setScreen("settings")}
          />
        ) : null}

        {screen === "settings" ? (
          <SettingsView
            state={state}
            busy={busy}
            onBack={() => setScreen(state.completed ? "run" : "onboarding")}
            onReconnectGoogle={onConnectGoogle}
            onDisconnectGoogle={onDisconnectGoogle}
            onSaveMistral={(value) => saveApiKey("mistral", value)}
            onSaveRocketReach={(value) => saveApiKey("rocketreach", value)}
          />
        ) : null}
      </div>
    </PopupShell>
  );
};
