import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Package, Target, ClipboardList, TrendingUp, Calendar } from "lucide-react";
import { KPICard, PageHeader, ActionBadge, type ActionType } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type DashboardKpis = {
  activeProducts: number;
  weeklyFocusItems: number;
  pendingDecisions: number;
  recentDecisions: number;
  productOfWeek: string | null;
};

type WeeklyFocusItem = {
  actionType: ActionType;
  targetType: "KEYWORD" | "PRODUCT" | "THEME";
  targetId: string;
  title: string;
  rationale: string;
  priorityScore: number;
};

type WeeklyFocusResponse = {
  ok: boolean;
  items: WeeklyFocusItem[];
};

export default function Dashboard() {
  const location = useLocation();
  const isRootDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";
  const [weeklyFocus, setWeeklyFocus] = useState<WeeklyFocusItem[]>([]);
  const [weeklyFocusError, setWeeklyFocusError] = useState<string | null>(null);
  const [weeklyFocusLoading, setWeeklyFocusLoading] = useState(false);
  const [kpis, setKpis] = useState<DashboardKpis>({
    activeProducts: 0,
    weeklyFocusItems: 0,
    pendingDecisions: 0,
    recentDecisions: 0,
    productOfWeek: null,
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
          productOfWeek: null,
        });
      } finally {
        setKpisLoading(false);
      }
    }

    async function loadWeeklyFocus() {
      setWeeklyFocusLoading(true);
      setWeeklyFocusError(null);
      try {
        const response = await api<WeeklyFocusResponse>("/weekly-focus?limit=3");
        setWeeklyFocus(response.items ?? []);
      } catch (e: unknown) {
        setWeeklyFocusError(e instanceof Error ? e.message : "Failed to load SEO focus");
      } finally {
        setWeeklyFocusLoading(false);
      }
    }

    void loadKpis();
    void loadWeeklyFocus();
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SEO Focus - Takes 2 columns */}
        <Card className="lg:col-span-2">
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
              {weeklyFocusLoading && (
                <p className="text-sm text-muted-foreground">Loading SEO focus…</p>
              )}
              {!weeklyFocusLoading && weeklyFocusError && (
                <p className="text-sm text-destructive">{weeklyFocusError}</p>
              )}
              {!weeklyFocusLoading && !weeklyFocusError && weeklyFocus.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No promoted signals yet. Promote keywords to generate SEO focus actions.
                </p>
              )}
              {weeklyFocus.map((item) => (
                <FocusItemPreview
                  key={`${item.targetType}-${item.targetId}`}
                  title={item.title}
                  action={item.actionType}
                  reason={item.rationale}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Product of the Week */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Product of the Week</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <p className="font-medium text-foreground">
                {kpis.productOfWeek ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Not available yet
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-3">
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
}: {
  title: string;
  action: ActionType;
  reason: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3">
        <ActionBadge action={action} />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
        {reason}
      </span>
    </div>
  );
}
