import { useState } from "react";
import type { OnboardingState } from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

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
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Settings
        </p>
        <h2 className="text-xl font-semibold text-zinc-900">Connection and keys</h2>
      </div>

      <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
        <p className="text-sm font-medium text-zinc-800">Google account</p>
        {state.googleConnected ? (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Connected as {state.googleEmail}
          </Badge>
        ) : (
          <Badge>Not connected</Badge>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => void onReconnectGoogle()}>
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

      <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
        <p className="text-sm font-medium text-zinc-800">Mistral API key</p>
        {state.mistralKeySet ? <Badge>Encrypted key saved</Badge> : <Badge>Missing</Badge>}
        <Label htmlFor="settings-mistral">Update key</Label>
        <Input
          id="settings-mistral"
          type="password"
          value={mistralKey}
          placeholder="mistral-..."
          onChange={(event) => setMistralKey(event.target.value)}
        />
        <Button
          variant="secondary"
          disabled={busy || !mistralKey.trim()}
          onClick={async () => {
            await onSaveMistral(mistralKey);
            setMistralKey("");
          }}
        >
          Save key
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
        <p className="text-sm font-medium text-zinc-800">RocketReach API key</p>
        {state.rocketreachKeySet ? <Badge>Encrypted key saved</Badge> : <Badge>Missing</Badge>}
        <Label htmlFor="settings-rocketreach">Update key</Label>
        <Input
          id="settings-rocketreach"
          type="password"
          value={rocketreachKey}
          placeholder="rr-..."
          onChange={(event) => setRocketreachKey(event.target.value)}
        />
        <Button
          variant="secondary"
          disabled={busy || !rocketreachKey.trim()}
          onClick={async () => {
            await onSaveRocketReach(rocketreachKey);
            setRocketreachKey("");
          }}
        >
          Save key
        </Button>
      </div>

      <Button variant="outline" className="mt-auto" onClick={onBack}>
        Back
      </Button>
    </div>
  );
};
