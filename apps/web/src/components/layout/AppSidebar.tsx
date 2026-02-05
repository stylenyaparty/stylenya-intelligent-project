import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  ClipboardList,
  KeyRound,
  Package,
  Settings,
  Radar,
  Inbox,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const legacyUiEnabled = import.meta.env.VITE_FEATURE_LEGACY_UI === "true";

const navigationItems = [
  { 
    title: "Dashboard", 
    url: "/dashboard", 
    icon: LayoutDashboard,
    description: "Overview & KPIs"
  },
  { 
    title: "Signals", 
    url: "/dashboard/signals", 
    icon: Radar,
    description: "CSV signal imports"
  },
  { 
    title: "Decision Drafts", 
    url: "/dashboard/decision-drafts", 
    icon: Inbox,
    description: "Review AI drafts"
  },
  { 
    title: "Decision Log", 
    url: "/dashboard/decisions", 
    icon: ClipboardList,
    description: "Daily decision log"
  },
  { 
    title: "SEO Focus", 
    url: "/dashboard/seo-focus", 
    icon: Target,
    description: "Bi-weekly plan"
  },
  { 
    title: "Products", 
    url: "/dashboard/products", 
    icon: Package,
    description: "Catalog management"
  },
  { 
    title: "Settings", 
    url: "/dashboard/settings", 
    icon: Settings,
    description: "Preferences & integrations"
  },
];

const legacyItems = legacyUiEnabled
  ? [
      { 
        title: "Keyword Jobs", 
        url: "/dashboard/keywords", 
        icon: KeyRound,
        description: "Legacy keyword research"
      },
    ]
  : [];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/dashboard/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar 
      className="border-r border-sidebar-border"
      collapsible="icon"
    >
      <SidebarHeader className="h-14 flex items-center justify-center border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-sidebar-foreground">Stylenya</span>
              <span className="text-xs text-muted-foreground">Intelligence</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && (
                        <span className="truncate">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {legacyItems.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Legacy
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {legacyItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={isCollapsed ? item.title : undefined}
                    >
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && (
                          <span className="truncate">{item.title}</span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
