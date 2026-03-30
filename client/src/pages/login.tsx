// client/src/pages/login.tsx
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoSrc from "@assets/Logo_20251026_003559_0003.jpg_1774860720618.jpeg";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      toast({ title: "Welcome back!" });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md border-border/50 shadow-xl shadow-black/5 relative z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="space-y-3 pb-8 pt-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <img src={logoSrc} alt="Logo" className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-display">
              Welcome to TDS-CRM
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your dashboard
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11 transition-all focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 transition-all focus:ring-primary/20"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium hover-elevate mt-2"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}