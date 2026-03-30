// client/src/App.tsx
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/use-auth";

// Components
import { Layout } from "@/components/layout";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Templates from "@/pages/templates";
import Users from "@/pages/users";

function Router() {
  const { user, isLoading } = useAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  // If user is not logged in, always show login page
  if (!user) {
    return <Login />;
  }

  // User is logged in, render main app layout with sidebar
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/leads" component={Leads} />
        <Route path="/templates" component={Templates} />
        <Route path="/users" component={Users} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
  } as React.CSSProperties;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle}>
            <Toaster />
            <Router />
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;