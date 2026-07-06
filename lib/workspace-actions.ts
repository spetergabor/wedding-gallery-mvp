"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_WORKSPACE_COOKIE, adminWorkspaceCookieOptions, requireAdmin, type AdminWorkspaceMode } from "@/lib/auth";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function returnPathFromReferer(referer: string | null) {
  if (!referer) {
    return "/admin/dashboard";
  }

  try {
    const url = new URL(referer);
    return url.pathname.startsWith("/admin") ? `${url.pathname}${url.search}` : "/admin/dashboard";
  } catch {
    return "/admin/dashboard";
  }
}

export async function switchWorkspaceAction(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin.isTeamMember) {
    redirect("/admin/dashboard");
  }

  const mode: AdminWorkspaceMode = formString(formData, "workspaceMode") === "own" ? "own" : "team";
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_WORKSPACE_COOKIE, mode, adminWorkspaceCookieOptions());

  const requestHeaders = await headers();
  redirect(returnPathFromReferer(requestHeaders.get("referer")));
}
