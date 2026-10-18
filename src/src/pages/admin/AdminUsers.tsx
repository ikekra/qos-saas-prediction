import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { authFunctionFetch } from "@/lib/live-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type UserListResponse = {
  success: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    email: string;
    name: string;
    organization: string | null;
    plan: string;
    status: string;
    created_at: string;
    teams: Array<{ team_id: string; role: string; status: string }>;
  }>;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<UserListResponse | null>(null);

  const load = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50", search });
    const response = await authFunctionFetch("admin-control-plane", `/api/admin/users?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load users");
    setPayload(data);
  };

  useEffect(() => {
    void load().catch((error) => {
      toast({ title: "Failed to load users", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    });
  }, [page]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container space-y-6 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>User management</CardTitle>
            <div className="flex gap-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by email or name" className="w-72" />
              <Button onClick={() => void load()}>Search</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Teams</th>
                    <th className="p-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.email}</td>
                      <td className="p-3 capitalize">{item.plan}</td>
                      <td className="p-3 capitalize">{item.status}</td>
                      <td className="p-3">{item.teams.length}</td>
                      <td className="p-3">{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
              <Button variant="outline" disabled={(payload?.total ?? 0) <= page * (payload?.pageSize ?? 50)} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
