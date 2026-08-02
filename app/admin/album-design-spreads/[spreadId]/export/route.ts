import { notFound } from "next/navigation";
import { albumDesignSpreadJpegResponse, loadAlbumDesignSpreadDraftForExport, loadAlbumDesignSpreadForExport } from "@/lib/album-design-export";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ spreadId: string }> }) {
  const admin = await requireAdmin();
  const { spreadId } = await params;
  const spread = await loadAlbumDesignSpreadForExport({ admin, spreadId });

  if (!spread || (spread.items.length === 0 && spread.textItems.length === 0)) {
    notFound();
  }

  return albumDesignSpreadJpegResponse(spread);
}

export async function POST(request: Request, { params }: { params: Promise<{ spreadId: string }> }) {
  const admin = await requireAdmin();
  const { spreadId } = await params;
  const formData = await request.formData();
  const spread = await loadAlbumDesignSpreadDraftForExport({ admin, spreadId, formData });

  if (!spread || (spread.items.length === 0 && spread.textItems.length === 0)) {
    notFound();
  }

  return albumDesignSpreadJpegResponse(spread);
}
