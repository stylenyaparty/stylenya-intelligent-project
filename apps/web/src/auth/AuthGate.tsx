import { useCallback, useEffect, useState } from "react";
import Login from "@/pages/Login";
import InitialAdminSetup from "@/pages/InitialAdminSetup";
import { fetchBootstrapStatus, type BootstrapStatus } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

const fallbackErrorMessage =
  "Backend not reachable. Please ensure the API is running and try again.";

export default function AuthGate() {
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchBootstrapStatus();
      setStatus(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : fallbackErrorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading setup status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-[420px]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Unable to reach backend</CardTitle>
            <CardDescription>
              We could not check the setup status. Please verify the API is reachable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error || fallbackErrorMessage}</span>
            </div>
            <Button className="w-full" onClick={loadStatus}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const needsBootstrap = status?.bootstrapRequired || status?.usersCount === 0;

  if (needsBootstrap) {
    return (
      <InitialAdminSetup
        onComplete={() => {
          setLoginMessage("Initial admin created. Please sign in.");
          setStatus({ usersCount: 1, bootstrapRequired: false });
        }}
        onConflict={() => {
          setLoginMessage("Setup already completed. Please sign in.");
          setStatus({ usersCount: 1, bootstrapRequired: false });
        }}
      />
    );
  }

  return <Login initialMessage={loginMessage} />;
}
