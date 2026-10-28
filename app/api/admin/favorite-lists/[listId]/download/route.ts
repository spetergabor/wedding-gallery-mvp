import { NextResponse } from "next/server";
import { favoriteListAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE
});

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  const formulaSafeText = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${formulaSafeText.replace(/"/g, '""')}"`;
}

function csvRow(values: (string | number | null | undefined)[]) {
  return values.map(csvCell).join(";");
}

function safeDownloadName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const admin = await requireAdmin();
  const { listId } = await params;
  const list = await prisma.galleryFavoriteList.findFirst({
    where: favoriteListAccessWhere(admin, listId),
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      submittedAt: true,
      gallery: {
        select: {
          title: true
        }
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          photo: {
            select: {
              filename: true
            }
          }
        }
      }
    }
  });

  if (!list) {
    return NextResponse.json({ message: "Favorite list not found." }, { status: 404 });
  }

  const status = list.submittedAt ? "Lezárva" : "Folyamatban";
  const rows = [
    csvRow([
      "Galéria",
      "Lista",
      "E-mail",
      "Állapot",
      "Létrehozva",
      "Frissítve",
      "Lezárva",
      "Sorszám",
      "Fájlnév",
      "Kedvenchez adva"
    ]),
    ...list.items.map((item, index) =>
      csvRow([
        list.gallery.title,
        list.name,
        list.email,
        status,
        dateFormatter.format(list.createdAt),
        dateFormatter.format(list.updatedAt),
        list.submittedAt ? dateFormatter.format(list.submittedAt) : "",
        index + 1,
        item.photo.filename,
        dateFormatter.format(item.createdAt)
      ])
    )
  ];

  if (list.items.length === 0) {
    rows.push(
      csvRow([
        list.gallery.title,
        list.name,
        list.email,
        status,
        dateFormatter.format(list.createdAt),
        dateFormatter.format(list.updatedAt),
        list.submittedAt ? dateFormatter.format(list.submittedAt) : "",
        "",
        "",
        ""
      ])
    );
  }

  const baseName = safeDownloadName(`${list.gallery.title}-${list.name}`) || `kedvenclista-${list.id}`;
  const fileName = `${baseName}.csv`;

  return new Response(`\uFEFF${rows.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
