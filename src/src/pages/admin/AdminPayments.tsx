import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { authFunctionFetch, buildFunctionUrl } from "@/lib/live-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type PaymentsResponse = {
  success: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    user_id: string;
    amount_in_paise: number;
    plan_name: string | null;
    status: string;
    created_at: string;
  }>;
};

export default function AdminPayments() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [payload, setPayload] = useState<PaymentsResponse | null>(null);

  const load = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (status) params.set("status", status);
    const response = await authFunctionFetch("admin-control-plane", `/api/admin/payments?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load payments");
    setPayload(data);
  };

  useEffect(() => {
    void load().catch((error) => {
      toast({ title: "Failed to load payments", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    });
  }, [page]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container space-y-6 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payments & revenue</CardTitle>
            <div className="flex gap-2">
              <Input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="status filter" className="w-40" />
              <Button onClick={() => void load()}>Apply</Button>
              <a href={buildFunctionUrl("admin-control-plane", "/api/admin/payments/export")} target="_blank" rel="noreferrer">
                <Button variant="outline">Export CSV</Button>
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="p-3">{item.user_id}</td>
                      <td className="p-3 capitalize">{item.plan_name || "-"}</td>
                      <td className="p-3">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((item.amount_in_paise ?? 0) / 100)}</td>
                      <td className="p-3 capitalize">{item.status}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await authFunctionFetch("admin-control-plane", `/api/admin/payments/${item.id}/retry`, { method: "POST" });
                              toast({ title: "Retry queued" });
                            }}
                          >
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              await authFunctionFetch("admin-control-plane", `/api/admin/payments/${item.id}/refund`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ reason: "Manual admin refund" }),
                              });
                              toast({ title: "Payment refunded" });
                              await load();
                            }}
                          >
                            Refund
                          </Button>
                        </div>
                      </td>
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
