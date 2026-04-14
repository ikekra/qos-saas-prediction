import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { authFunctionFetch, buildFunctionUrl } from "@/lib/live-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type AuditResponse = {
  success: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    admin_id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    ip: string | null;
    created_at: string;
  }>;
};

export default function AdminAuditLogs() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [payload, setPayload] = useState<AuditResponse | null>(null);

  const load = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (action) params.set("action", action);
    const response = await authFunctionFetch("admin-control-plane", `/api/admin/audit?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load audit logs");
    setPayload(data);
  };

  useEffect(() => {
    void load().catch((error) => {
      toast({ title: "Failed to load audit logs", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    });
  }, [page]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container space-y-6 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Audit logs</CardTitle>
            <div className="flex gap-2">
              <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Filter by action" className="w-48" />
              <Button onClick={() => void load()}>Apply</Button>
              <a href={buildFunctionUrl("admin-control-plane", "/api/admin/audit/export")} target="_blank" rel="noreferrer">
                <Button variant="outline">Export CSV</Button>
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="p-3">{item.admin_id}</td>
                      <td className="p-3">{item.action}</td>
                      <td className="p-3">{item.target_type}:{item.target_id ?? "-"}</td>
                      <td className="p-3">{item.ip ?? "-"}</td>
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
