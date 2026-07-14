import { PassThrough, Readable } from "node:stream";
import { notFound } from "next/navigation";
import { ZipArchive } from "archiver";
import {
  albumDesignExportFilename,
  albumDesignSpreadExportFilename,
  loadAlbumDesignForExport,
  renderAlbumDesignSpreadJpeg
} from "@/lib/album-design-export";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ designId: string }> }) {
  const admin = await requireAdmin();
  const { designId } = await params;
  const design = await loadAlbumDesignForExport({ admin, designId });

  if (!design || design.spreads.length === 0) {
    notFound();
  }

  const zip = new ZipArchive({
    forceZip64: true,
    store: true
  });
  const zipStream = new PassThrough();

  zip.on("error", (error) => {
    zipStream.destroy(error);
  });
  zip.pipe(zipStream);

  void (async () => {
    try {
      for (const spread of design.spreads) {
        const jpegBuffer = await renderAlbumDesignSpreadJpeg(spread);
        zip.append(jpegBuffer, { name: albumDesignSpreadExportFilename(spread) });
      }

      await zip.finalize();
    } catch (error) {
      const exportError = error instanceof Error ? error : new Error("Album design export failed.");
      zip.destroy(exportError);
      zipStream.destroy(exportError);
    }
  })();

  return new Response(Readable.toWeb(zipStream) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${albumDesignExportFilename(design.title)}"`
    }
  });
}
