import { useState } from "react";
import type { OnboardingState } from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../../lib/integrations/email-enrichment/config";
import {
  hasPreloadedMistralApiKey,
  isMistralAvailable
} from "../../lib/integrations/mistral-config";

type SettingsViewProps = {
  state: OnboardingState;
  busy: boolean;
  onBack: () => void;
  onReconnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onSaveMistral: (value: string) => Promise<void>;
  onSaveRocketReach: (value: string) => Promise<void>;
};

export const SettingsView = ({
  state,
  busy,
  onBack,
  onReconnectGoogle,
  onDisconnectGoogle,
  onSaveMistral,
  onSaveRocketReach
}: SettingsViewProps) => {
  const [mistralKey, setMistralKey] = useState("");
  const [rocketreachKey, setRocketreachKey] = useState("");

  return (
    <div className="flex h-full flex-col justify-center gap-4 overflow-y-auto py-2 pr-1">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
          Settings
        </p>
        <h2 className="text-xl font-semibold text-white">Connection and keys</h2>
      </div>

      <div className="space-y-2 rounded-xl border border-white/40 bg-black/20 p-3 text-white">
        <p className="text-sm font-medium text-white">Google account</p>
        {state.googleConnected ? (
          <Badge>Connected as {state.googleEmail}</Badge>
        ) : (
          <Badge>Not connected</Badge>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => void onReconnectGoogle()}>
            Reconnect
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => void onDisconnectGoogle()}>
            Disconnect
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-white/40 bg-black/20 p-3 text-white">
        <p className="text-sm font-medium text-white">Mistral API key</p>
        {state.mistralKeySet ? (
          <Badge>Encrypted key saved</Badge>
        ) : hasPreloadedMistralApiKey ? (
          <Badge>Using .env.local key</Badge>
        ) : (
          <Badge>Missing</Badge>
        )}
        {isMistralAvailable(state.mistralKeySet) ? (
          <p className="text-xs text-white/70">
            {hasPreloadedMistralApiKey && !state.mistralKeySet
              ? "Development key loaded from .env.local."
              : "Saved key is encrypted in local storage."}
          </p>
        ) : null}
        <Label htmlFor="settings-mistral" className="text-white">
          {hasPreloadedMistralApiKey ? "Override key (optional)" : "Update key"}
        </Label>
        <Input
          id="settings-mistral"
          type="password"
          value={mistralKey}
          placeholder="mistral-..."
          onChange={(event) => setMistralKey(event.target.value)}
        />
        <Button
          disabled={busy || !mistralKey.trim()}
          onClick={async () => {
            await onSaveMistral(mistralKey);
            setMistralKey("");
          }}
        >
          Save key
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-white/40 bg-black/20 p-3 text-white">
        <p className="text-sm font-medium text-white">RocketReach API key</p>
        {state.rocketreachKeySet ? (
          <Badge>Encrypted key saved</Badge>
        ) : ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING ? (
          <Badge>Missing</Badge>
        ) : (
          <Badge>Optional</Badge>
        )}
        {!ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING ? (
          <p className="text-xs text-white/70">
            Mock provider is first in the lookup chain during development.
          </p>
        ) : null}
        <Label htmlFor="settings-rocketreach" className="text-white">
          Update key
        </Label>
        <Input
          id="settings-rocketreach"
          type="password"
          value={rocketreachKey}
          placeholder="rr-..."
          onChange={(event) => setRocketreachKey(event.target.value)}
        />
        <Button
          disabled={busy || !rocketreachKey.trim()}
          onClick={async () => {
            await onSaveRocketReach(rocketreachKey);
            setRocketreachKey("");
          }}
        >
          Save key
        </Button>
      </div>

      <Button onClick={onBack}>
        Back
      </Button>
    </div>
  );
};
