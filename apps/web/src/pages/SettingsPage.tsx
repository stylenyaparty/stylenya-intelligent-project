import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  createSeoContextSeed,
  createProductType,
  getKeywordProviderSettings,
  getProductTypes,
  getSeoContext,
  updateSeoContextSeed,
  updateKeywordProviderSettings,
  updateProductType,
  type KeywordProviderSettings,
  type ProductTypeDefinition,
  type SeoContextResponse,
  type SeoContextSeed,
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
  googleAds: { enabled: false, configured: false },
};

const emptySeoContext: SeoContextResponse = {
  includeSeeds: [],
  excludeSeeds: [],
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<KeywordProviderSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seoContext, setSeoContext] = useState<SeoContextResponse>(emptySeoContext);
  const [seoLoading, setSeoLoading] = useState(true);
  const [seoSaving, setSeoSaving] = useState(false);
  const [occasionTerm, setOccasionTerm] = useState("");
  const [excludeTerm, setExcludeTerm] = useState("");
  const [productTypes, setProductTypes] = useState<ProductTypeDefinition[]>([]);
  const [productTypesLoading, setProductTypesLoading] = useState(true);
  const [productTypesSaving, setProductTypesSaving] = useState(false);
  const [newProductTypeLabel, setNewProductTypeLabel] = useState("");
  const [newProductTypeSynonyms, setNewProductTypeSynonyms] = useState("");
  const [productTypeEdits, setProductTypeEdits] = useState<
    Record<string, { label: string; synonyms: string }>
  >({});
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

  useEffect(() => {
    let active = true;

    async function loadSeoContext() {
      setSeoLoading(true);
      try {
        const data = await getSeoContext();
        if (!active) return;
        setSeoContext(data);
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof ApiError ? error.message : "Failed to load SEO context.";
        toast.error(message);
      } finally {
        if (active) setSeoLoading(false);
      }
    }

    loadSeoContext();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProductTypes() {
      setProductTypesLoading(true);
      try {
        const data = await getProductTypes("all");
        if (!active) return;
        setProductTypes(data.productTypes);
        setProductTypeEdits(
          data.productTypes.reduce((acc, productType) => {
            acc[productType.id] = {
              label: productType.label,
              synonyms: Array.isArray(productType.synonymsJson)
                ? productType.synonymsJson.join(", ")
                : "",
            };
            return acc;
          }, {} as Record<string, { label: string; synonyms: string }>)
        );
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof ApiError ? error.message : "Failed to load product types.";
        toast.error(message);
      } finally {
        if (active) setProductTypesLoading(false);
      }
    }

    loadProductTypes();

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

  async function handleAddSeed(kind: SeoContextSeed["kind"]) {
    const term = kind === "INCLUDE" ? occasionTerm : excludeTerm;
    if (!term.trim()) {
      toast.error("Enter a term to add.");
      return;
    }
    setSeoSaving(true);
    try {
      const response = await createSeoContextSeed({ term, kind });
      setSeoContext((prev) => ({
        includeSeeds:
          kind === "INCLUDE" ? [response.seed, ...prev.includeSeeds] : prev.includeSeeds,
        excludeSeeds:
          kind === "EXCLUDE" ? [response.seed, ...prev.excludeSeeds] : prev.excludeSeeds,
      }));
      if (kind === "INCLUDE") {
        setOccasionTerm("");
      } else {
        setExcludeTerm("");
      }
      toast.success("SEO context term added.");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to add SEO context term.";
      toast.error(message);
    } finally {
      setSeoSaving(false);
    }
  }

  async function handleUpdateSeed(
    seed: SeoContextSeed,
    updates: { status?: SeoContextSeed["status"]; kind?: SeoContextSeed["kind"] }
  ) {
    setSeoSaving(true);
    try {
      const response = await updateSeoContextSeed(seed.id, updates);
      setSeoContext((prev) => {
        const nextInclude = prev.includeSeeds.filter((item) => item.id !== seed.id);
        const nextExclude = prev.excludeSeeds.filter((item) => item.id !== seed.id);
        const updatedSeed = response.seed;
        if (updatedSeed.kind === "INCLUDE") {
          return { includeSeeds: [updatedSeed, ...nextInclude], excludeSeeds: nextExclude };
        }
        return { includeSeeds: nextInclude, excludeSeeds: [updatedSeed, ...nextExclude] };
      });
      toast.success("SEO context updated.");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to update SEO context.";
      toast.error(message);
    } finally {
      setSeoSaving(false);
    }
  }

  function parseSynonyms(value: string) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  async function handleAddProductType() {
    if (!newProductTypeLabel.trim()) {
      toast.error("Enter a product type label.");
      return;
    }
    setProductTypesSaving(true);
    try {
      const response = await createProductType({
        label: newProductTypeLabel,
        synonyms: parseSynonyms(newProductTypeSynonyms),
      });
      setProductTypes((prev) => [response.productType, ...prev]);
      setProductTypeEdits((prev) => ({
        ...prev,
        [response.productType.id]: {
          label: response.productType.label,
          synonyms: Array.isArray(response.productType.synonymsJson)
            ? response.productType.synonymsJson.join(", ")
            : "",
        },
      }));
      setNewProductTypeLabel("");
      setNewProductTypeSynonyms("");
      toast.success("Product type added.");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to add product type.";
      toast.error(message);
    } finally {
      setProductTypesSaving(false);
    }
  }

  async function handleUpdateProductType(id: string) {
    const edits = productTypeEdits[id];
    if (!edits?.label.trim()) {
      toast.error("Product type label is required.");
      return;
    }
    setProductTypesSaving(true);
    try {
      const response = await updateProductType(id, {
        label: edits.label,
        synonyms: parseSynonyms(edits.synonyms),
      });
      setProductTypes((prev) =>
        prev.map((item) => (item.id === id ? response.productType : item))
      );
      setProductTypeEdits((prev) => ({
        ...prev,
        [response.productType.id]: {
          label: response.productType.label,
          synonyms: Array.isArray(response.productType.synonymsJson)
            ? response.productType.synonymsJson.join(", ")
            : "",
        },
      }));
      toast.success("Product type updated.");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to update product type.";
      toast.error(message);
    } finally {
      setProductTypesSaving(false);
    }
  }

  async function handleToggleProductTypeStatus(productType: ProductTypeDefinition) {
    setProductTypesSaving(true);
    try {
      const response = await updateProductType(productType.id, {
        status: productType.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED",
      });
      setProductTypes((prev) =>
        prev.map((item) => (item.id === productType.id ? response.productType : item))
      );
      toast.success("Product type updated.");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to update product type.";
      toast.error(message);
    } finally {
      setProductTypesSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage keyword provider preferences and integrations."
      />

      <Card>
        <CardHeader>
          <CardTitle>Stylenya Product Types</CardTitle>
          <CardDescription>
            Define the core product taxonomy that gates relevance for signals and drafts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {productTypesLoading ? (
            <LoadingState message="Loading product types..." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-[2fr_3fr_auto] md:items-end">
                <div className="space-y-1">
                  <Label>Label</Label>
                  <Input
                    placeholder="Custom Cake Toppers"
                    value={newProductTypeLabel}
                    onChange={(event) => setNewProductTypeLabel(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Synonyms (comma separated)</Label>
                  <Input
                    placeholder="cake topper, personalized cake topper"
                    value={newProductTypeSynonyms}
                    onChange={(event) => setNewProductTypeSynonyms(event.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddProductType}
                  disabled={productTypesSaving || !newProductTypeLabel.trim()}
                >
                  Add
                </Button>
              </div>
              {productTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No product types yet.</p>
              ) : (
                <div className="space-y-3">
                  {productTypes.map((productType) => {
                    const edits = productTypeEdits[productType.id];
                    return (
                      <div
                        key={productType.id}
                        className="rounded-lg border border-border p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">
                              {productType.label}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Key: {productType.key}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {productType.status === "ARCHIVED" && (
                              <Badge variant="outline">Archived</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleProductTypeStatus(productType)}
                              disabled={productTypesSaving}
                            >
                              {productType.status === "ARCHIVED" ? "Restore" : "Archive"}
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[2fr_3fr_auto] md:items-end">
                          <div className="space-y-1">
                            <Label>Label</Label>
                            <Input
                              value={edits?.label ?? productType.label}
                              onChange={(event) =>
                                setProductTypeEdits((prev) => ({
                                  ...prev,
                                  [productType.id]: {
                                    label: event.target.value,
                                    synonyms:
                                      prev[productType.id]?.synonyms ??
                                      (Array.isArray(productType.synonymsJson)
                                        ? productType.synonymsJson.join(", ")
                                        : ""),
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Synonyms</Label>
                            <Input
                              value={edits?.synonyms ?? ""}
                              onChange={(event) =>
                                setProductTypeEdits((prev) => ({
                                  ...prev,
                                  [productType.id]: {
                                    label: prev[productType.id]?.label ?? productType.label,
                                    synonyms: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateProductType(productType.id)}
                            disabled={productTypesSaving}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO Context</CardTitle>
          <CardDescription>
            Expand and protect relevance with occasion intent terms and exclusions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {seoLoading ? (
            <LoadingState message="Loading SEO context..." />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Occasion &amp; Intent Terms
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Signals that match these terms expand beyond product-type matches.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add occasion or intent term"
                    value={occasionTerm}
                    onChange={(event) => setOccasionTerm(event.target.value)}
                  />
                  <Button
                    onClick={() => handleAddSeed("INCLUDE")}
                    disabled={seoSaving || !occasionTerm.trim()}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {seoContext.includeSeeds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No occasion or intent terms yet.
                    </p>
                  ) : (
                    seoContext.includeSeeds.map((seed) => (
                      <div
                        key={seed.id}
                        className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                      >
                        <span
                          className={
                            seed.status === "ARCHIVED"
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }
                        >
                          {seed.term}
                        </span>
                        {seed.status === "ARCHIVED" && (
                          <Badge variant="outline">Archived</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleUpdateSeed(seed, {
                              status: seed.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED",
                            })
                          }
                          disabled={seoSaving}
                        >
                          {seed.status === "ARCHIVED" ? "Restore" : "Archive"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateSeed(seed, { kind: "EXCLUDE" })}
                          disabled={seoSaving}
                        >
                          Move to exclude
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Exclude Terms</h3>
                  <p className="text-xs text-muted-foreground">
                    Signals that match exclude terms are filtered out.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add exclude term"
                    value={excludeTerm}
                    onChange={(event) => setExcludeTerm(event.target.value)}
                  />
                  <Button
                    onClick={() => handleAddSeed("EXCLUDE")}
                    disabled={seoSaving || !excludeTerm.trim()}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {seoContext.excludeSeeds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No exclude terms yet.</p>
                  ) : (
                    seoContext.excludeSeeds.map((seed) => (
                      <div
                        key={seed.id}
                        className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                      >
                        <span
                          className={
                            seed.status === "ARCHIVED"
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }
                        >
                          {seed.term}
                        </span>
                        {seed.status === "ARCHIVED" && (
                          <Badge variant="outline">Archived</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleUpdateSeed(seed, {
                              status: seed.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED",
                            })
                          }
                          disabled={seoSaving}
                        >
                          {seed.status === "ARCHIVED" ? "Restore" : "Archive"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateSeed(seed, { kind: "INCLUDE" })}
                          disabled={seoSaving}
                        >
                          Move to occasion
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyword Providers</CardTitle>
          <CardDescription>Choose how keyword research providers are configured.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Google Ads</h3>
                  <Badge variant={googleAdsConfigured ? "default" : "outline"}>
                    {googleAdsConfigured ? "Configured" : "Not configured"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Optional integration for keyword research. Enable only when you have credentials ready.
                  {!googleAdsConfigured && " Not configured yet—add credentials when you’re ready."}
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

    </div>
  );
}
