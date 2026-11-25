import { getAdminSession } from "@/lib/auth";

export async function authorizeMetaAdsApi() {
  const admin = await getAdminSession();
  if (!admin || admin.status !== "approved") {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }
  if (admin.role !== "super_admin" || admin.isTeamMember) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }
  return { ok: true as const, admin };
}

export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected Meta Ads intelligence error.";
  if (message.includes("not configured") || message.includes("does not contain")) {
    return { status: 503, message };
  }
  return { status: 500, message: "Meta Ads intelligence request failed." };
}
