export type TeamInvitationEmailParams = {
  teamName: string;
  inviterName: string;
  invitedEmail: string;
  inviteUrl: string;
  role: "admin" | "member";
  expiresAt: string;
};

export function buildTeamInvitationEmail(params: TeamInvitationEmailParams) {
  const expires = new Date(params.expiresAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = `${params.inviterName} invited you to join ${params.teamName}`;
  const html = `
  <!doctype html>
  <html lang="en">
    <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#10233f;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dbe4f0;">
              <tr>
                <td style="padding:32px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
                  <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.8;">Team Invitation</p>
                  <h1 style="margin:0;font-size:28px;line-height:1.2;">Join ${escapeHtml(params.teamName)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                    ${escapeHtml(params.inviterName)} invited <strong>${escapeHtml(params.invitedEmail)}</strong> to join
                    <strong>${escapeHtml(params.teamName)}</strong> as a <strong>${escapeHtml(params.role)}</strong>.
                  </p>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5b76;">
                    Accept the invitation to start sharing team quota, activity history, and workspace access. This link expires on ${escapeHtml(expires)}.
                  </p>
                  <p style="margin:0 0 24px;">
                    <a href="${params.inviteUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;">
                      Review Invitation
                    </a>
                  </p>
                  <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">If the button does not work, open this URL:</p>
                  <p style="margin:0;font-size:13px;word-break:break-all;color:#2563eb;">${escapeHtml(params.inviteUrl)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  return { subject, html };
}

export async function sendTeamInvitationEmail(params: TeamInvitationEmailParams) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("TEAM_EMAIL_FROM") ?? "QoS Teams <noreply@qoscollab.com>";
  const { subject, html } = buildTeamInvitationEmail(params);

  if (!resendApiKey) {
    console.log("RESEND_API_KEY is not configured. Skipping invite email send.", {
      invitedEmail: params.invitedEmail,
      teamName: params.teamName,
    });
    return { sent: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.invitedEmail],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Failed to send invitation email: ${details || response.statusText}`);
  }

  return { sent: true, skipped: false };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
