import { notFound } from "next/navigation";
import { albumDesignSpreadExportFilename, loadAlbumDesignSpreadForExport, renderAlbumDesignSpreadJpeg } from "@/lib/album-design-export";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ spreadId: string }> }) {
  const admin = await requireAdmin();
  const { spreadId } = await params;
  const spread = await loadAlbumDesignSpreadForExport({ admin, spreadId });

  if (!spread || spread.items.length === 0) {
    notFound();
  }

  const jpegBuffer = await renderAlbumDesignSpreadJpeg(spread);
  const filename = albumDesignSpreadExportFilename(spread);

  return new Response(new Uint8Array(jpegBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpegBuffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
