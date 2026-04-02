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
  Settings,
  BarChart2
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Templates", href: "/templates", icon: MessageSquareQuote },
  { name: "My Report", href: "/report", icon: BarChart2 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar className="border-r border-white/5 bg-sidebar">
      <SidebarContent>
        {/* Logo */}
        <div className="p-5 pb-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
            <img src={logoSrc} alt="TDS-CRM Logo" className="h-8 w-8 rounded-lg object-cover" />
          </div>
          <div>
            <span className="font-display font-bold text-base tracking-tight text-foreground">TDS-CRM</span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Sales Platform</p>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/5 mb-3" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-4 mb-1">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <SidebarMenu className="gap-0.5">
              {navigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        font-medium transition-all duration-200 rounded-lg h-10
                        ${isActive
                          ? 'bg-primary/10 text-primary border border-primary/15'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
                        }
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3 px-3">
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                        <span className="text-sm">{item.name}</span>
                        {isActive && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
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
                      font-medium transition-all duration-200 rounded-lg h-10
                      ${location === '/users'
                        ? 'bg-primary/10 text-primary border border-primary/15'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
                      }
                    `}
                  >
                    <Link href="/users" className="flex items-center gap-3 px-3">
                      <Settings className={`h-4 w-4 shrink-0 ${location === '/users' ? 'text-primary' : ''}`} />
                      <span className="text-sm">Manage Users</span>
                      {location === '/users' && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 border border-white/5">
          <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">
              {user?.username?.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user?.username}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{user?.role}</p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
            title="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-4 px-6 border-b border-white/5 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}