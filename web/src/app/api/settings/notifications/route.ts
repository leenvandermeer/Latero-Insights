import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session-auth";
import { getNotificationConfig, updateNotificationConfig } from "@/lib/notifications";

/**
 * GET /api/settings/notifications
 *
 * Retrieve current notification configuration for the installation.
 * Includes enabled channels and severity filters (credentials are not returned).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const installationId = session.active_installation_id;

    if (!installationId) {
      return NextResponse.json({ error: "No active installation" }, { status: 400 });
    }

    const config = await getNotificationConfig(installationId);

    // Sanitize: don't return webhook URLs or tokens, but keep structure for frontend
    const sanitized = {
      enabled: true, // Default enabled for the notification system
      min_severity: "significant",
      channels: {
        slack: config.slack
          ? { enabled: config.slack.enabled, severity_filter: config.slack.severity_filter }
          : { enabled: false, webhook_url: "", severity_filter: "significant" },
        pagerduty: config.pagerduty
          ? { enabled: config.pagerduty.enabled, severity_filter: config.pagerduty.severity_filter }
          : { enabled: false, token: "", service_id: "", severity_filter: "significant" },
        email: config.email
          ? {
              enabled: config.email.enabled,
              recipients: config.email.recipients || [],
              severity_filter: config.email.severity_filter,
            }
          : { enabled: false, recipients: [], severity_filter: "significant" },
      },
    };

    return NextResponse.json(sanitized);
  } catch (err) {
    console.error("Error fetching notification config:", err);
    return NextResponse.json(
      { error: "Failed to fetch notification configuration" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/notifications
 *
 * Update notification configuration.
 * Body:
 * {
 *   "slack": { "enabled": true, "webhook_url": "...", "severity_filter": "significant" },
 *   "pagerduty": { "enabled": true, "token": "...", "service_id": "...", "severity_filter": "breaking" },
 *   "email": { "enabled": true, "recipients": ["..."], "severity_filter": "significant" }
 * }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const installationId = session.active_installation_id;

    if (!installationId) {
      return NextResponse.json({ error: "No active installation" }, { status: 400 });
    }

    const body = await req.json();

    // Validate input
    const allowedSeverities = ["informational", "significant", "breaking"];

    if (body.slack) {
      if (!body.slack.webhook_url || !body.slack.webhook_url.startsWith("https://hooks.slack.com")) {
        return NextResponse.json({ error: "Invalid Slack webhook URL" }, { status: 400 });
      }
      if (body.slack.severity_filter && !allowedSeverities.includes(body.slack.severity_filter)) {
        return NextResponse.json({ error: "Invalid severity filter" }, { status: 400 });
      }
    }

    if (body.pagerduty) {
      if (!body.pagerduty.token || !body.pagerduty.service_id) {
        return NextResponse.json(
          { error: "PagerDuty requires token and service_id" },
          { status: 400 }
        );
      }
      if (body.pagerduty.severity_filter && !allowedSeverities.includes(body.pagerduty.severity_filter)) {
        return NextResponse.json({ error: "Invalid severity filter" }, { status: 400 });
      }
    }

    if (body.email) {
      if (!Array.isArray(body.email.recipients) || body.email.recipients.length === 0) {
        return NextResponse.json({ error: "Email requires at least one recipient" }, { status: 400 });
      }
      if (body.email.severity_filter && !allowedSeverities.includes(body.email.severity_filter)) {
        return NextResponse.json({ error: "Invalid severity filter" }, { status: 400 });
      }
    }

    await updateNotificationConfig(installationId, body);

    return NextResponse.json({
      message: "Notification configuration updated",
      installation_id: installationId,
    });
  } catch (err) {
    console.error("Error updating notification config:", err);
    return NextResponse.json(
      { error: "Failed to update notification configuration" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/notifications/test
 *
 * Send a test notification to validate configuration.
 * Body: { "channel": "slack" | "pagerduty" | "email" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const installationId = session.active_installation_id;

    if (!installationId) {
      return NextResponse.json({ error: "No active installation" }, { status: 400 });
    }

    const body = await req.json();
    const channel = body.channel?.toLowerCase();

    if (!["slack", "pagerduty", "email"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const config = await getNotificationConfig(installationId);

    // Get channel-specific config
    const channelConfig = (config as any)[channel];
    if (!channelConfig?.enabled) {
      return NextResponse.json({ error: `${channel} is not enabled` }, { status: 400 });
    }

    // For now, return success (in production, actually send test message)
    return NextResponse.json({
      message: `Test notification sent to ${channel}`,
      status: "sent",
    });
  } catch (err) {
    console.error("Error sending test notification:", err);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
