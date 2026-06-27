"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_LANGUAGE_COOKIE, normalizeAdminLanguage } from "@/lib/admin-language";

const ADMIN_LANGUAGE_MAX_AGE = 60 * 60 * 24 * 365;

export async function setAdminLanguageAction(formData: FormData) {
  const language = normalizeAdminLanguage(String(formData.get("language") ?? ""));
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_LANGUAGE_COOKIE, language, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_LANGUAGE_MAX_AGE
  });

  revalidatePath("/", "layout");
}
