import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Coins, Database, Sparkles, ArrowRight } from "lucide-react";

export default function AdminHub() {
  const { user } = useAuth();
  const isAdmin = user?.app_metadata?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Admin access required.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-6">
        <div className="relative overflow-hidden rounded-3xl border p-8 text-white" style={{ background: "linear-gradient(120deg, #0f172a 0%, #1d4ed8 45%, #0ea5e9 100%)" }}>
          <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
              <Shield className="h-3.5 w-3.5" />
              ADMIN MODE
            </div>
            <h1 className="mt-4 text-4xl font-semibold">Project Owner Control Hub</h1>
            <p className="mt-2 max-w-2xl text-white/85">
              Centralized controls for token economy, billing oversight, and service governance.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Coins className="h-5 w-5 text-primary" /> Token Console</CardTitle>
              <CardDescription>View pool totals, search users, and adjust balances.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin/tokens">
                <Button className="w-full justify-between">Open Token Admin <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-primary" /> Service Directory</CardTitle>
              <CardDescription>Manage featured services and service metadata.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin/web-services">
                <Button variant="outline" className="w-full justify-between">Open Service Admin <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> QoS Workspace</CardTitle>
              <CardDescription>Jump into standard user-facing QoS tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/dashboard">
                <Button variant="secondary" className="w-full justify-between">Go to Dashboard <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
