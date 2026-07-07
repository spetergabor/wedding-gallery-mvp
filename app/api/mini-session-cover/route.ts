import { NextResponse } from "next/server";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  createMiniSessionCoverObjectKey,
  deletePhotoObject,
  getPhotoPublicUrl,
  savePhotoObject
} from "@/lib/storage";

export const runtime = "nodejs";

const MINI_SESSION_COVER_MAX_BYTES = 12 * 1024 * 1024;

function coverKeyPrefix(adminId: string) {
  return `mini-sessions/${adminId}/covers/`;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const formData = await request.formData();
  const file = formData.get("coverImage");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: "Válassz ki egy képet a feltöltéshez." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, message: "Csak képfájlt lehet feltölteni." }, { status: 400 });
  }

  if (file.size > MINI_SESSION_COVER_MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "A borítókép legfeljebb 12 MB lehet." }, { status: 413 });
  }

  const r2Key = createMiniSessionCoverObjectKey({
    adminId: workspaceAdminId,
    originalFilename: file.name
  });
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await savePhotoObject({
      r2Key,
      bytes,
      contentType: file.type
    });
  } catch (error) {
    console.error("Mini session cover draft upload failed", {
      adminId: workspaceAdminId,
      r2Key,
      storageDriver: process.env.STORAGE_DRIVER,
      error
    });
    return NextResponse.json({ ok: false, message: "A borítókép feltöltése nem sikerült." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: getPhotoPublicUrl(r2Key),
    r2Key
  });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const body = await request.json().catch(() => null);
  const r2Key = typeof body?.r2Key === "string" ? body.r2Key : "";

  if (!r2Key.startsWith(coverKeyPrefix(workspaceAdminId))) {
    return NextResponse.json({ ok: false, message: "Érvénytelen borítókép." }, { status: 400 });
  }

  await deletePhotoObject(r2Key);

  return NextResponse.json({ ok: true });
}
