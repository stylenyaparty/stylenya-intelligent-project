import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getKeywordProviderSettings,
  updateKeywordProviderSettings,
  type KeywordProviderSettings,
} from "@/lib/api";
import { PageHeader, LoadingState } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";

const emptySettings: KeywordProviderSettings = {
  trends: { enabled: true },
  googleAds: { enabled: false, configured: false },
  auto: { prefers: "GOOGLE_ADS_WHEN_CONFIGURED" },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<KeywordProviderSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState({
    enabled: false,
    customerId: "",
    developerToken: "",
    clientId: "",
    clientSecret: "",
    refreshToken: "",
  });

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      try {
        const data = await getKeywordProviderSettings();
        if (!active) return;
        setSettings(data);
        setFormState((prev) => ({
          ...prev,
          enabled: data.googleAds.enabled,
          customerId: data.googleAds.customerId ?? "",
        }));
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof ApiError
            ? error.message
            : "Failed to load keyword provider settings.";
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const missingFields = useMemo(() => {
    if (!formState.enabled) return [];
    return [
      { key: "customerId", value: formState.customerId },
      { key: "developerToken", value: formState.developerToken },
      { key: "clientId", value: formState.clientId },
      { key: "clientSecret", value: formState.clientSecret },
      { key: "refreshToken", value: formState.refreshToken },
    ].filter(({ value }) => value.trim().length === 0);
  }, [formState]);

  const isSaveDisabled = saving || (formState.enabled && missingFields.length > 0);

  const googleAdsConfigured = settings.googleAds.configured;

  async function handleSave() {
    setSaving(true);
    try {
      const response = await updateKeywordProviderSettings({
        enabled: formState.enabled,
        customerId: formState.customerId.trim() || undefined,
        developerToken: formState.developerToken.trim() || undefined,
        clientId: formState.clientId.trim() || undefined,
        clientSecret: formState.clientSecret.trim() || undefined,
        refreshToken: formState.refreshToken.trim() || undefined,
      });

      setSettings((prev) => ({
        ...prev,
        googleAds: response.googleAds,
      }));

      setFormState((prev) => ({
        ...prev,
        enabled: response.googleAds.enabled,
        customerId: response.googleAds.customerId ?? prev.customerId,
        developerToken: response.googleAds.enabled ? prev.developerToken : "",
        clientId: response.googleAds.enabled ? prev.clientId : "",
        clientSecret: response.googleAds.enabled ? prev.clientSecret : "",
        refreshToken: response.googleAds.enabled ? prev.refreshToken : "",
      }));

      toast.success("Google Ads settings saved.");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to save settings.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="Fetching keyword provider settings." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage keyword provider preferences and integrations."
      />

      <Card>
        <CardHeader>
          <CardTitle>Keyword Providers</CardTitle>
          <CardDescription>Choose how keyword research providers are configured.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Google Trends (Legacy)</h3>
                  <Badge variant="outline">Legacy</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Legacy keyword provider for historical keyword jobs (no setup required).
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                Enabled
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Google Ads</h3>
                  <Badge variant={googleAdsConfigured ? "default" : "outline"}>
                    Configured: {googleAdsConfigured ? "Yes" : "No"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  If Google Ads is disabled or not configured, AUTO mode will use Google Trends (legacy).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Enable Google Ads</span>
                <Switch
                  checked={formState.enabled}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, enabled: checked }))
                  }
                  aria-label="Enable Google Ads"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer ID</Label>
                <Input
                  id="customerId"
                  placeholder="123-456-7890"
                  value={formState.customerId}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, customerId: event.target.value }))
                  }
                  disabled={!formState.enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="developerToken">Developer Token</Label>
                <Input
                  id="developerToken"
                  placeholder="Stored securely in Google Ads"
                  value={formState.developerToken}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, developerToken: event.target.value }))
                  }
                  disabled={!formState.enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="Google OAuth client ID"
                  value={formState.clientId}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, clientId: event.target.value }))
                  }
                  disabled={!formState.enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder="Google OAuth client secret"
                  value={formState.clientSecret}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, clientSecret: event.target.value }))
                  }
                  disabled={!formState.enabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="refreshToken">Refresh Token</Label>
                <Input
                  id="refreshToken"
                  type="password"
                  placeholder="Refresh token from OAuth flow"
                  value={formState.refreshToken}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, refreshToken: event.target.value }))
                  }
                  disabled={!formState.enabled}
                />
              </div>
            </div>

            {formState.enabled && missingFields.length > 0 && (
              <p className="text-xs text-destructive">
                Enter all required Google Ads credentials to enable this provider.
              </p>
            )}

            <div className="flex items-center justify-end">
              <Button onClick={handleSave} disabled={isSaveDisabled}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legacy UI</CardTitle>
          <CardDescription>Enable legacy keyword jobs and trends UI for debugging.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            To re-enable legacy navigation items, set{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_FEATURE_LEGACY_UI=true</code>{" "}
            in the web app environment and restart the frontend.
          </p>
          <p>
            Legacy APIs and engines also require{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">LEGACY_API_ENABLED=true</code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">LEGACY_ENGINE_ENABLED=true</code>{" "}
            on the API service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
