import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { reviewerSignup } from "@/api/auth";
import { toast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api";

type LoginProps = {
  initialMessage?: string;
};

export default function Login({ initialMessage }: LoginProps) {
  const { login, loading } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [reviewerCode, setReviewerCode] = useState("");
  const [showReviewerModal, setShowReviewerModal] = useState(false);
  const [showReviewerEntry, setShowReviewerEntry] = useState(true);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewerPassword, setReviewerPassword] = useState("");
  const [reviewerModalCode, setReviewerModalCode] = useState("");
  const [reviewerError, setReviewerError] = useState("");
  const [reviewerLoading, setReviewerLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  }

  function openReviewerModal() {
    setReviewerModalCode(reviewerCode);
    setReviewerError("");
    setShowReviewerModal(true);
  }

  async function onReviewerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReviewerError("");
    setReviewerLoading(true);

    try {
      const user = await reviewerSignup({
        code: reviewerModalCode,
        name: reviewerName || undefined,
        email: reviewerEmail,
        password: reviewerPassword,
      });

      setShowReviewerModal(false);
      setEmail(user.email);
      setPassword("");
      setReviewerPassword("");
      toast({ title: "Account created. Please log in." });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setReviewerError("Invalid reviewer code");
          return;
        }
        if (err.status === 409) {
          setReviewerError("Email already exists. Please login.");
          return;
        }
        if (err.status === 404) {
          setShowReviewerEntry(false);
          setShowReviewerModal(false);
          setError("Reviewer access disabled");
          return;
        }
      }

      setReviewerError(err instanceof Error ? err.message : "Unable to create reviewer account");
    } finally {
      setReviewerLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">S</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Stylenya Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Decision support for your product catalog
          </p>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {initialMessage && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>{initialMessage}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-10"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            {showReviewerEntry && (
              <div className="mt-6 border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Reviewer Access</p>
                <div className="space-y-2">
                  <Label htmlFor="reviewer-code">Reviewer Code</Label>
                  <Input
                    id="reviewer-code"
                    value={reviewerCode}
                    onChange={(e) => setReviewerCode(e.target.value)}
                    placeholder="Enter reviewer code"
                  />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={openReviewerModal}>
                  Continue
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showReviewerModal} onOpenChange={setShowReviewerModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create reviewer account</DialogTitle>
              <DialogDescription>
                This creates a temporary reviewer user. You can then sign in normally.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={onReviewerSubmit}>
              <div className="space-y-2">
                <Label htmlFor="reviewer-name">Name (optional)</Label>
                <Input
                  id="reviewer-name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Reviewer name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-email">Email</Label>
                <Input
                  id="reviewer-email"
                  type="email"
                  value={reviewerEmail}
                  onChange={(e) => setReviewerEmail(e.target.value)}
                  placeholder="reviewer@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-password">Password</Label>
                <Input
                  id="reviewer-password"
                  type="password"
                  value={reviewerPassword}
                  onChange={(e) => setReviewerPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-modal-code">Reviewer Code</Label>
                <Input
                  id="reviewer-modal-code"
                  value={reviewerModalCode}
                  onChange={(e) => setReviewerModalCode(e.target.value)}
                  required
                />
              </div>

              {reviewerError && (
                <p className="text-sm text-destructive">{reviewerError}</p>
              )}

              <DialogFooter>
                <Button type="submit" disabled={reviewerLoading}>
                  {reviewerLoading ? "Creating..." : "Create account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <p className="text-center text-xs text-muted-foreground">
          Powered by product intelligence engine v1
        </p>
      </div>
    </div>
  );
}
