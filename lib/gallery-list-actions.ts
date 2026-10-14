"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { galleryAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function toggleGalleryActiveFromListAction(id: string, nextIsActive: boolean) {
  const admin = await requireAdmin();
  const gallery = await prisma.gallery.findFirst({
    where: galleryAccessWhere(admin, id),
    select: { id: true }
  });

  if (!gallery) {
    redirect("/admin/galleries");
  }

  const updatedGallery = await prisma.gallery.update({
    where: { id: gallery.id },
    data: { isActive: nextIsActive },
    select: { slug: true }
  });

  revalidatePath("/admin/galleries");
  revalidatePath(`/admin/galleries/${gallery.id}`);
  revalidatePath(`/g/${updatedGallery.slug}`);
  redirect("/admin/galleries?updated=1");
}
