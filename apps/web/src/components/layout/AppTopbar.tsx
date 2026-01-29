import { useAuth } from "@/auth/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { LogOut, User, ChevronDown } from "lucide-react";

export function AppTopbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-2" />
        <div className="h-6 w-px bg-border" />
        <div>
          <h1 className="text-sm font-medium text-foreground">Decision Support Dashboard</h1>
          <p className="text-xs text-muted-foreground">Product intelligence & recommendations</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-medium truncate max-w-[120px]">
                  {user?.email?.split("@")[0]}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {user?.role?.toLowerCase()}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-lg z-50">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
