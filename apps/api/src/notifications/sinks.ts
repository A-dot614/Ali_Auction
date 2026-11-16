import { emailProvider } from "../email/index.js";
import type { NotificationCategory } from "./templates.js";

/**
 * D4 (Slice 8): delivery sinks. No real provider; the console sink wraps the
 * existing dev-console email provider. Sinks never see raw internal IDs beyond
 * the recipient's own resource reference and never receive moderation reasons.
 */

export type NotificationDeliveryMessage = {
  notificationId: string;
  recipientEmail: string;
  category: NotificationCategory;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
};

export interface NotificationSink {
  readonly channel: string;
  deliver(message: NotificationDeliveryMessage): Promise<void> | void;
}

/**
 * In-app delivery is the notification row itself, already visible only to the
 * authenticated owner through myNotifications. No unauthenticated link is emitted.
 */
export class InAppSink implements NotificationSink {
  readonly channel = "in_app";
  async deliver(_message: NotificationDeliveryMessage): Promise<void> {
    return;
  }
}

/** Dev-only console email sink; wraps the provider-agnostic console email provider. */
export class ConsoleEmailSink implements NotificationSink {
  readonly channel = "email_console";
  constructor(private readonly provider: typeof emailProvider = emailProvider) {}
  async deliver(message: NotificationDeliveryMessage): Promise<void> {
    await this.provider.send({
      to: message.recipientEmail,
      subject: message.title,
      text: `${message.title}\n${message.body}\nSign in to AliAuction to view this notification.`,
    });
  }
}
