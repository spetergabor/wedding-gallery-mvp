import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAdminActivityNotificationEmail } from "@/lib/email";

export const ADMIN_NOTIFICATION_TOPICS = [
  { key: "lead_created", defaultInApp: true, defaultEmail: false },
  { key: "mini_session_booking", defaultInApp: true, defaultEmail: true },
  { key: "mini_session_cancellation", defaultInApp: true, defaultEmail: true },
  { key: "favorite_list_started", defaultInApp: true, defaultEmail: false },
  { key: "favorite_list_submitted", defaultInApp: true, defaultEmail: true },
  { key: "gallery_zip_ready", defaultInApp: true, defaultEmail: true },
  { key: "contract_signed", defaultInApp: true, defaultEmail: false },
  { key: "album_review_submitted", defaultInApp: true, defaultEmail: false }
] as const;

export type AdminNotificationTopic = (typeof ADMIN_NOTIFICATION_TOPICS)[number]["key"];
export type AdminNotificationChannel = "inApp" | "email";

export type AdminNotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  topics: Record<AdminNotificationTopic, { inApp: boolean; email: boolean }>;
};

function jsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function booleanValue(value: Prisma.JsonValue | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function defaultAdminNotificationPreferences(): AdminNotificationPreferences {
  return {
    inAppEnabled: true,
    emailEnabled: true,
    topics: Object.fromEntries(
      ADMIN_NOTIFICATION_TOPICS.map((topic) => [
        topic.key,
        { inApp: topic.defaultInApp, email: topic.defaultEmail }
      ])
    ) as AdminNotificationPreferences["topics"]
  };
}

export async function getAdminNotificationPreferences(adminId: string): Promise<AdminNotificationPreferences> {
  const defaults = defaultAdminNotificationPreferences();
  let saved: { inAppEnabled: boolean; emailEnabled: boolean; topics: Prisma.JsonValue } | null;

  try {
    saved = await prisma.adminNotificationPreference.findUnique({
      where: { adminId },
      select: { inAppEnabled: true, emailEnabled: true, topics: true }
    });
  } catch (error) {
    console.error("Admin notification preferences could not be loaded; using defaults", { adminId, error });
    return defaults;
  }

  if (!saved) {
    return defaults;
  }

  const savedTopics = jsonRecord(saved.topics);

  return {
    inAppEnabled: saved.inAppEnabled,
    emailEnabled: saved.emailEnabled,
    topics: Object.fromEntries(
      ADMIN_NOTIFICATION_TOPICS.map((topic) => {
        const value = jsonRecord(savedTopics[topic.key]);
        return [
          topic.key,
          {
            inApp: booleanValue(value.inApp, topic.defaultInApp),
            email: booleanValue(value.email, topic.defaultEmail)
          }
        ];
      })
    ) as AdminNotificationPreferences["topics"]
  };
}

export function adminNotificationChannelEnabled(
  preferences: AdminNotificationPreferences,
  topic: AdminNotificationTopic,
  channel: AdminNotificationChannel
) {
  const masterEnabled = channel === "inApp" ? preferences.inAppEnabled : preferences.emailEnabled;
  return masterEnabled && preferences.topics[topic][channel];
}

export async function dispatchAdminNotification({
  adminId,
  topic,
  title,
  message,
  href,
  sendEmail
}: {
  adminId: string;
  topic: AdminNotificationTopic;
  title: string;
  message: string;
  href?: string | null;
  sendEmail?: () => Promise<unknown>;
}) {
  const preferences = await getAdminNotificationPreferences(adminId);
  const results = { inApp: false, email: false };

  if (adminNotificationChannelEnabled(preferences, topic, "inApp")) {
    try {
      await prisma.adminNotification.create({
        data: { adminId, type: topic, title, message, href: href || null }
      });
      results.inApp = true;
    } catch (error) {
      console.error("Admin in-app notification failed", { adminId, topic, error });
    }
  }

  if (adminNotificationChannelEnabled(preferences, topic, "email")) {
    try {
      if (sendEmail) {
        await sendEmail();
      } else {
        const admin = await prisma.admin.findUnique({
          where: { id: adminId },
          select: {
            email: true,
            siteSettings: { select: { contactEmail: true } }
          }
        });
        const recipient = admin?.siteSettings?.contactEmail || admin?.email;

        if (recipient) {
          await sendAdminActivityNotificationEmail({ to: recipient, title, message, href: href || null });
        }
      }
      results.email = true;
    } catch (error) {
      console.error("Admin email notification failed", { adminId, topic, error });
    }
  }

  return results;
}
