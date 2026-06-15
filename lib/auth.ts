import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE = "wgm_admin";
const SESSION_VALUE = "single-admin-session";

export async function getAdminSession() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === SESSION_VALUE;
}

export async function requireAdmin() {
  const isAdmin = await getAdminSession();

  if (!isAdmin) {
    redirect("/admin/login");
  }
}

export async function signInAdmin(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me";

  if (email !== adminEmail || password !== adminPassword) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return true;
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
