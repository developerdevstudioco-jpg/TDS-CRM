import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import logoSrc from "@assets/Logo_20251026_003559_0003.jpg_1774860720618.jpeg";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquareQuote, 
  LogOut, 
  Settings
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Templates", href: "/templates", icon: MessageSquareQuote },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar">
      <SidebarContent>
        <div className="p-4 pb-2 flex items-center gap-3">
          <img src={logoSrc} alt="TDS-CRM Logo" className="h-10 w-10 rounded-lg object-cover" />
          <span className="font-display font-bold text-lg tracking-tight">TDS-CRM</span>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={`
                        font-medium transition-all duration-200
                        ${isActive ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3 px-3 py-2">
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              {user?.role === 'admin' && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === '/users'}
                    className={`
                      font-medium transition-all duration-200
                      ${location === '/users' ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}
                    `}
                  >
                    <Link href="/users" className="flex items-center gap-3 px-3 py-2">
                      <Settings className={`h-4 w-4 ${location === '/users' ? 'text-primary' : ''}`} />
                      <span>Manage Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{user?.username}</span>
            <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
          </div>
          <button 
            onClick={() => logout()}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background selection:bg-primary/10">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-16 flex items-center gap-4 px-6 border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
        </header>
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
