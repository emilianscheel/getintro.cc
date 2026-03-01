import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CachedDomainPipelinePool,
  OnboardingState,
  OnboardingStep,
  PipelineResult,
  PipelineRunMode
} from "../lib/types";
import { MESSAGE_TYPE } from "../lib/messages";
import { sendRuntimeMessage } from "../lib/runtime";
import { PRELOADED_MISTRAL_API_KEY } from "../lib/integrations/mistral-config";
import { PIPELINE_POOLS_STORAGE_KEY } from "../lib/state/storage";
import { PopupShell } from "../components/popup-shell";
import { Toaster } from "../components/ui/toaster";
import { toast } from "../lib/use-toast";
import { OnboardingView } from "./views/onboarding-view";
import { RunView } from "./views/run-view";
import { ResultFormView } from "./views/result-form-view";
import { EmailSentView } from "./views/email-sent-view";
import { appendUnseenCandidates } from "./pipelineResults";

type Screen = "onboarding" | "run" | "running" | "results" | "email_sent";

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

const resolveInitialScreen = (onboardingState: OnboardingState): Screen => {
  if (!onboardingState.completed) {
    return "onboarding";
  }

  return "run";
};

export const App = () => {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [activeStep, setActiveStep] = useState<OnboardingStep>("google");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [latestResult, setLatestResult] = useState<PipelineResult | null>(null);
  const [sentGmailUrl, setSentGmailUrl] = useState<string | null>(null);
  const [pendingRefreshDomain, setPendingRefreshDomain] = useState<string | null>(null);
  const [activeHostname, setActiveHostname] = useState<string | undefined>(undefined);
  const [hasActiveHostnameCache, setHasActiveHostnameCache] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const latestResultRef = useRef<PipelineResult | null>(null);
  const [onboardingPrefill, setOnboardingPrefill] = useState<{
    mistral: string;
    rocketreach: string;
    customDraftPrompt: string;
  }>({
    mistral: PRELOADED_MISTRAL_API_KEY ?? "",
    rocketreach: "",
    customDraftPrompt: ""
  });

  const showErrorToast = useCallback((message: string) => {
    toast({
      description: message
    });
  }, []);

  const syncActiveTabCacheStatus = useCallback(async () => {
    const response = await sendRuntimeMessage({
      type: MESSAGE_TYPE.GET_ACTIVE_TAB_CACHE_STATUS
    });

    if (!response.ok || response.type !== MESSAGE_TYPE.ACTIVE_TAB_CACHE_STATUS) {
      setActiveHostname(undefined);
      setHasActiveHostnameCache(false);
      return;
    }

    setActiveHostname(response.hostname);
    setHasActiveHostnameCache(response.hasCache);
  }, []);

  useEffect(() => {
    latestResultRef.current = latestResult;
  }, [latestResult]);

  useEffect(() => {
    void (async () => {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPE.GET_STATE });

      if (!response.ok || response.type !== "STATE") {
        showErrorToast(response.ok ? "Failed to load state." : response.error);
        return;
      }

      setState(response.state);
      setOnboardingPrefill((current) => ({
        ...current,
        customDraftPrompt: response.state.customDraftPrompt ?? ""
      }));
      setScreen(resolveInitialScreen(response.state));
      await syncActiveTabCacheStatus();
    })();
  }, [showErrorToast, syncActiveTabCacheStatus]);

  useEffect(() => {
    let handledRefresh = false;

    const onStorageChanged: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName
    ) => {
      if (areaName !== "local") {
        return;
      }

      const poolsChange = changes[PIPELINE_POOLS_STORAGE_KEY];

      if (!poolsChange) {
        return;
      }

      void syncActiveTabCacheStatus();

      if (!pendingRefreshDomain || handledRefresh) {
        return;
      }

      const currentResult = latestResultRef.current;

      if (!currentResult || currentResult.domain !== pendingRefreshDomain) {
        return;
      }

      const nextPools = poolsChange.newValue as Record<string, CachedDomainPipelinePool> | undefined;
      const domainPool = nextPools?.[pendingRefreshDomain];

      if (!domainPool) {
        return;
      }

      const { candidates, addedCount } = appendUnseenCandidates(
        currentResult.candidates,
        domainPool.candidates
      );

      if (addedCount > 0) {
        setLatestResult({
          ...currentResult,
          candidates,
          servedFromCache: false,
          backgroundRefreshStarted: false
        });
      }

      handledRefresh = true;
      setPendingRefreshDomain(null);
      toast({
        description: `Background refresh finished. Added ${addedCount} new candidate${
          addedCount === 1 ? "" : "s"
        }.`
      });
    };

    chrome.storage.onChanged.addListener(onStorageChanged);

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, [pendingRefreshDomain, syncActiveTabCacheStatus]);

  const updateAuthState = (next: OnboardingState) => {
    setState(next);
    setOnboardingPrefill((current) => ({
      ...current,
      customDraftPrompt: next.customDraftPrompt ?? current.customDraftPrompt
    }));

    if (!next.completed && (screen === "run" || screen === "results" || screen === "email_sent")) {
      setScreen("onboarding");
    }
  };

  const runAuthAction = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);

    try {
      await action();
      return true;
    } catch (actionError) {
      showErrorToast(
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

  const runPipeline = async (mode: PipelineRunMode) => {
    setBusy(true);
    setScreen("running");
    setSentGmailUrl(null);
    setPendingRefreshDomain(null);

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.START_PIPELINE,
        mode
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.PIPELINE_RESULT) {
        throw new Error(response.ok ? "Pipeline failed." : response.error);
      }

      setLatestResult(response.result);
      setPendingRefreshDomain(
        response.result.backgroundRefreshStarted ? response.result.domain : null
      );
      setScreen("results");
      await syncActiveTabCacheStatus();
    } catch (pipelineError) {
      showErrorToast(
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
    setSubmitting(true);

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.SUBMIT_EMAIL,
        payload
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.EMAIL_SENT) {
        throw new Error(response.ok ? "Failed to send email." : response.error);
      }

      setSentGmailUrl(response.gmailUrl);
      setScreen("email_sent");
    } catch (submitError) {
      showErrorToast(
        submitError instanceof Error ? submitError.message : "Failed to submit email."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const clearActiveHostnameCache = async () => {
    if (!activeHostname) {
      return;
    }

    setClearingCache(true);

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.CLEAR_PIPELINE_CACHE,
        scope: "domain",
        domain: activeHostname
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.PIPELINE_CACHE_CLEARED) {
        throw new Error(response.ok ? "Failed to clear cache." : response.error);
      }

      await syncActiveTabCacheStatus();
    } catch (clearError) {
      showErrorToast(clearError instanceof Error ? clearError.message : "Failed to clear cache.");
    } finally {
      setClearingCache(false);
    }
  };

  const restartOnboarding = async () => {
    let clearAllError: string | undefined;

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPE.CLEAR_PIPELINE_CACHE,
        scope: "all"
      });

      if (!response.ok || response.type !== MESSAGE_TYPE.PIPELINE_CACHE_CLEARED) {
        throw new Error(response.ok ? "Failed to clear cache." : response.error);
      }
    } catch (clearError) {
      clearAllError = clearError instanceof Error ? clearError.message : "Failed to clear cache.";
    }

    setActiveStep("google");
    setPendingRefreshDomain(null);
    setLatestResult(null);
    setSentGmailUrl(null);
    setActiveHostname(undefined);
    setHasActiveHostnameCache(false);
    setScreen("onboarding");

    if (clearAllError) {
      showErrorToast(clearAllError);
    }
  };

  return (
    <PopupShell>
      <div className="relative flex h-full w-full items-center justify-center py-2">
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
            onRun={() => runPipeline("cache_then_refresh")}
            onRestartOnboarding={restartOnboarding}
            showClearCache={hasActiveHostnameCache && Boolean(activeHostname)}
            clearingCache={clearingCache}
            onClearCache={clearActiveHostnameCache}
          />
        ) : null}

        {screen === "results" && latestResult ? (
          <ResultFormView
            fromEmail={state.googleEmail ?? "unknown@google.com"}
            result={latestResult}
            submitting={submitting}
            onSubmit={submitEmail}
            onRunAgain={() => runPipeline("fresh_only")}
          />
        ) : null}

        {screen === "email_sent" && sentGmailUrl ? <EmailSentView gmailUrl={sentGmailUrl} /> : null}

        <Toaster />
      </div>
    </PopupShell>
  );
};
