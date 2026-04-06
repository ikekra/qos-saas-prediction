type AdminAuditStatus = "attempt" | "success" | "failed" | "denied";

type AdminAuditEntry = {
  actor_user_id: string;
  actor_email?: string | null;
  action: string;
  resource?: string;
  target_user_id?: string | null;
  target_email?: string | null;
  status: AdminAuditStatus;
  request_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  before_value?: number | null;
  after_value?: number | null;
  delta_value?: number | null;
  reason?: string | null;
  confirm_phrase?: string | null;
  bulk_count?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function insertAdminAuditLog(
  adminClient: {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  },
  entry: AdminAuditEntry,
): Promise<void> {
  const payload = {
    actor_user_id: entry.actor_user_id,
    actor_email: entry.actor_email ?? null,
    action: entry.action,
    resource: entry.resource ?? "token_balance",
    target_user_id: entry.target_user_id ?? null,
    target_email: entry.target_email ?? null,
    status: entry.status,
    request_id: entry.request_id ?? null,
    ip_address: entry.ip_address ?? null,
    user_agent: entry.user_agent ?? null,
    before_value: entry.before_value ?? null,
    after_value: entry.after_value ?? null,
    delta_value: entry.delta_value ?? null,
    reason: entry.reason ?? null,
    confirm_phrase: entry.confirm_phrase ?? null,
    bulk_count: entry.bulk_count ?? 1,
    metadata: entry.metadata ?? {},
  };

  const { error } = await adminClient.from("admin_audit_logs").insert(payload);
  if (error) {
    throw new Error(`Failed to insert admin audit log: ${error.message}`);
  }
}
