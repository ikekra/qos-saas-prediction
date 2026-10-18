import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvitation, declineInvitation, fetchInvitation } from "@/components/team/api";
import { useToast } from "@/hooks/use-toast";

export default function TeamInvitationPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof fetchInvitation>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchInvitation(token)
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .catch((error) => {
        toast({ title: "Invite not found", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>Team invitation</CardTitle>
            <CardDescription>Review the invite and choose how you want to proceed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading invitation...</p>}
            {payload && (
              <>
                <p><span className="font-medium">Team:</span> {payload.team?.name || "Unknown team"}</p>
                <p><span className="font-medium">Role:</span> {payload.invitation.role}</p>
                <p><span className="font-medium">Status:</span> {payload.invitation.status}</p>
                <p><span className="font-medium">Expires:</span> {new Date(payload.invitation.expires_at).toLocaleString()}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      await acceptInvitation(token);
                      toast({ title: "Invitation accepted" });
                      navigate("/team");
                    }}
                    disabled={payload.invitation.status !== "pending"}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await declineInvitation(token);
                      toast({ title: "Invitation declined" });
                      navigate("/dashboard");
                    }}
                    disabled={payload.invitation.status !== "pending"}
                  >
                    Decline
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
