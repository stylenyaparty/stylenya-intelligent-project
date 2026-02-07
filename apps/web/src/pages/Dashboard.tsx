import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Package, Target, ClipboardList, TrendingUp } from "lucide-react";
import { KPICard, PageHeader, ActionBadge, StatusBadge, type ActionType, type DecisionStatus } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type DashboardKpis = {
  activeProducts: number;
  weeklyFocusItems: number;
  pendingDecisions: number;
  recentDecisions: number;
};

type SeoFocusItem = {
  id: string;
  actionType: ActionType;
  title: string;
  status: DecisionStatus;
  rationale: string | null;
};

type SeoFocusResponse = {
  items: SeoFocusItem[];
};

export default function Dashboard() {
  const location = useLocation();
  const isRootDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";
  const [seoFocus, setSeoFocus] = useState<SeoFocusItem[]>([]);
  const [seoFocusError, setSeoFocusError] = useState<string | null>(null);
  const [seoFocusLoading, setSeoFocusLoading] = useState(false);
  const [kpis, setKpis] = useState<DashboardKpis>({
    activeProducts: 0,
    weeklyFocusItems: 0,
    pendingDecisions: 0,
    recentDecisions: 0,
  });
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpisError, setKpisError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRootDashboard) return;

    async function loadKpis() {
      setKpisLoading(true);
      setKpisError(null);
      try {
        const response = await api<DashboardKpis>("/dashboard/kpis");
        setKpis(response);
      } catch (e: unknown) {
        setKpisError(e instanceof Error ? e.message : "Failed to load KPIs");
        setKpis({
          activeProducts: 0,
          weeklyFocusItems: 0,
          pendingDecisions: 0,
          recentDecisions: 0,
        });
      } finally {
        setKpisLoading(false);
      }
    }

    async function loadSeoFocus() {
      setSeoFocusLoading(true);
      setSeoFocusError(null);
      try {
        const response = await api<SeoFocusResponse>("/seo-focus?days=14&includeExecuted=true");
        setSeoFocus(response.items?.slice(0, 3) ?? []);
      } catch (e: unknown) {
        setSeoFocusError(e instanceof Error ? e.message : "Failed to load SEO focus");
      } finally {
        setSeoFocusLoading(false);
      }
    }

    void loadKpis();
    void loadSeoFocus();
  }, [isRootDashboard]);

  // If we're on a nested route, just render the outlet
  if (!isRootDashboard) {
    return <Outlet />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Overview of your product intelligence and recommendations"
      />

      {/* KPI Grid */}
      {kpisError && (
        <p className="mb-3 text-sm text-destructive">
          KPI data unavailable: {kpisError}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Active Products"
          value={kpisLoading ? "—" : kpis.activeProducts}
          description="In Shopify catalog"
          icon={Package}
        />
        <KPICard
          title="SEO Focus Items"
          value={kpisLoading ? "—" : kpis.weeklyFocusItems}
          description="Bi-weekly actions"
          icon={Target}
          variant="highlight"
        />
        <KPICard
          title="Pending Decisions"
          value={kpisLoading ? "—" : kpis.pendingDecisions}
          description="Awaiting execution"
          icon={ClipboardList}
        />
        <KPICard
          title="Decisions This Week"
          value={kpisLoading ? "—" : kpis.recentDecisions}
          description="Last 7 days"
          icon={TrendingUp}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* SEO Focus */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">SEO Focus</CardTitle>
              </div>
              <Link
                to="/dashboard/seo-focus"
                className="text-sm text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {seoFocusLoading && (
                <p className="text-sm text-muted-foreground">Loading SEO focus…</p>
              )}
              {!seoFocusLoading && seoFocusError && (
                <p className="text-sm text-destructive">{seoFocusError}</p>
              )}
              {!seoFocusLoading && !seoFocusError && seoFocus.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No decisions planned or executed in the last two weeks.
                </p>
              )}
              {seoFocus.map((item) => (
                <FocusItemPreview
                  key={item.id}
                  title={item.title}
                  action={item.actionType}
                  reason={item.rationale ?? "—"}
                  status={item.status}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                to="/dashboard/seo-focus"
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">SEO Focus</p>
                  <p className="text-sm text-muted-foreground">View bi-weekly actions</p>
                </div>
              </Link>
              <Link
                to="/dashboard/decisions"
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Decision Log</p>
                  <p className="text-sm text-muted-foreground">Track and manage decisions</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FocusItemPreview({
  title,
  action,
  reason,
  status,
}: {
  title: string;
  action: ActionType;
  reason: string;
  status: DecisionStatus;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3">
        <ActionBadge action={action} />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
          {reason}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}
