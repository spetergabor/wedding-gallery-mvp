import { PassThrough, Readable } from "node:stream";
import { notFound } from "next/navigation";
import { ZipArchive } from "archiver";
import {
  albumDesignExportFilename,
  albumDesignSpreadExportFilename,
  loadAlbumDesignForExport,
  loadAlbumDesignSpreadDraftForExport,
  renderAlbumDesignSpreadJpeg
} from "@/lib/album-design-export";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

function albumDesignZipResponse(design: NonNullable<Awaited<ReturnType<typeof loadAlbumDesignForExport>>>) {
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

export async function GET(_request: Request, { params }: { params: Promise<{ designId: string }> }) {
  const admin = await requireAdmin();
  const { designId } = await params;
  const design = await loadAlbumDesignForExport({ admin, designId });

  if (!design || design.spreads.length === 0) {
    notFound();
  }

  return albumDesignZipResponse(design);
}

export async function POST(request: Request, { params }: { params: Promise<{ designId: string }> }) {
  const admin = await requireAdmin();
  const { designId } = await params;
  const formData = await request.formData();
  const design = await loadAlbumDesignForExport({ admin, designId });

  if (!design || design.spreads.length === 0) {
    notFound();
  }

  const submittedSpreadIds = [
    ...new Set(formData.getAll("draftSpreadIds").filter((value): value is string => typeof value === "string" && value.length > 0))
  ];
  const submittedSpreadIdSet = new Set(submittedSpreadIds);
  const savedSpreadsById = new Map(design.spreads.map((spread) => [spread.id, spread]));
  const orderedSavedSpreads = [
    ...submittedSpreadIds.flatMap((spreadId) => {
      const spread = savedSpreadsById.get(spreadId);

      return spread ? [spread] : [];
    }),
    ...design.spreads.filter((spread) => !submittedSpreadIdSet.has(spread.id))
  ];
  const spreads = await Promise.all(
    orderedSavedSpreads.map(async (savedSpread, index) => {
      const exportSpread = submittedSpreadIdSet.has(savedSpread.id)
        ? ((await loadAlbumDesignSpreadDraftForExport({ admin, spreadId: savedSpread.id, formData })) ?? savedSpread)
        : savedSpread;

      return {
        ...exportSpread,
        sortOrder: index + 1
      };
    })
  );

  return albumDesignZipResponse({ ...design, spreads });
}
