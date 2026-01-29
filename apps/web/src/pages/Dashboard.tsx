import { Link, Outlet, useLocation } from "react-router-dom";
import { Package, Target, ClipboardList, TrendingUp, Calendar } from "lucide-react";
import { KPICard, PageHeader } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Mock data - in production this would come from API
const mockKPIs = {
  activeProducts: 127,
  weeklyFocusItems: 7,
  pendingDecisions: 12,
  recentDecisions: 5,
  productOfWeek: "Vintage Lace Collar",
};

export default function Dashboard() {
  const location = useLocation();
  const isRootDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Active Products"
          value={mockKPIs.activeProducts}
          description="In Shopify catalog"
          icon={Package}
        />
        <KPICard
          title="Weekly Focus Items"
          value={mockKPIs.weeklyFocusItems}
          description="Prioritized actions"
          icon={Target}
          variant="highlight"
        />
        <KPICard
          title="Pending Decisions"
          value={mockKPIs.pendingDecisions}
          description="Awaiting execution"
          icon={ClipboardList}
        />
        <KPICard
          title="Decisions This Week"
          value={mockKPIs.recentDecisions}
          description="Last 7 days"
          icon={TrendingUp}
          trend={{ value: 25, label: "vs last week" }}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* This Week's Focus - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">This Week's Focus</CardTitle>
              </div>
              <Link 
                to="/dashboard/weekly-focus"
                className="text-sm text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Preview of top focus items */}
              <FocusItemPreview 
                name="Vintage Lace Collar" 
                action="BOOST" 
                reason="High demand, low stock"
              />
              <FocusItemPreview 
                name="Summer Floral Dress" 
                action="MIGRATE" 
                reason="Strong Etsy sales, not in Shopify"
              />
              <FocusItemPreview 
                name="Winter Wool Scarf" 
                action="PAUSE" 
                reason="Off-season, review in Q4"
              />
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
              <p className="font-medium text-foreground">{mockKPIs.productOfWeek}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Top performer based on sales velocity
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
                to="/dashboard/weekly-focus"
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Weekly Focus</p>
                  <p className="text-sm text-muted-foreground">View prioritized actions</p>
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

// Helper component for focus item preview
function FocusItemPreview({ 
  name, 
  action, 
  reason 
}: { 
  name: string; 
  action: string; 
  reason: string 
}) {
  const actionColors: Record<string, string> = {
    BOOST: "bg-action-boost/15 text-action-boost",
    MIGRATE: "bg-action-migrate/15 text-action-migrate",
    RETIRE: "bg-action-retire/15 text-action-retire",
    PAUSE: "bg-action-pause/15 text-action-pause",
    KEEP: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[action] || actionColors.KEEP}`}>
          {action}
        </span>
        <span className="font-medium text-sm">{name}</span>
      </div>
      <span className="text-xs text-muted-foreground">{reason}</span>
    </div>
  );
}
