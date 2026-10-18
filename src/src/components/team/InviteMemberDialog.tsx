import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InviteMemberDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatsUsed: number;
  seatsTotal: number;
  disabled?: boolean;
  onSubmit: (payload: { email: string; role: "admin" | "member" }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            {props.seatsUsed} of {props.seatsTotal} seats used
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              disabled={loading || props.disabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as "admin" | "member")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            disabled={loading || props.disabled || !email.trim()}
            onClick={async () => {
              setLoading(true);
              try {
                await props.onSubmit({ email, role });
                setEmail("");
                setRole("member");
                props.onOpenChange(false);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Sending..." : "Send invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
