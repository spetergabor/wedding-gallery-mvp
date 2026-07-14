import { AlbumDesignManager } from "@/components/album-design-manager";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere, albumDesignOwnedWhere } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_FULL } from "@/lib/proofing";

export default async function AdminAlbumsPage({
  searchParams
}: {
  searchParams: Promise<{
    albumDesignCreated?: string;
    albumDesignDeleted?: string;
    albumDesignUpdated?: string;
    albumDesignExported?: string;
    albumSpreadAutoCreated?: string;
    albumSpreadCreated?: string;
    albumSpreadRegenerated?: string;
    albumSpreadUpdated?: string;
    albumSpreadSlotUpdated?: string;
    albumSpreadDeleted?: string;
    albumDesignError?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;

  const [favoriteLists, sourceGalleries, albumDesigns, customers, albumProjects] = await Promise.all([
    prisma.galleryFavoriteList.findMany({
      where: {
        gallery: adminOwnedWhere(admin)
      },
      orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
      include: {
        gallery: {
          select: {
            title: true
          }
        },
        _count: {
          select: { items: true }
        },
        items: {
          orderBy: { createdAt: "asc" },
          take: 120,
          select: {
            photo: {
              select: {
                id: true,
                filename: true,
                imageUrl: true,
                thumbnailUrl: true
              }
            }
          }
        }
      }
    }),
    prisma.gallery.findMany({
      where: {
        ...adminOwnedWhere(admin),
        galleryMode: GALLERY_MODE_FULL,
        photos: {
          some: {
            mediaType: "image"
          }
        }
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        createdAt: true,
        eventDate: true,
        customer: {
          select: {
            coupleName: true
          }
        },
        _count: {
          select: { photos: true }
        }
      }
    }),
    prisma.albumDesign.findMany({
      where: albumDesignOwnedWhere(admin),
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true
          }
        },
        sourceGallery: {
          select: {
            id: true,
            title: true,
            galleryMode: true,
            photos: {
              where: { mediaType: "image" },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                filename: true,
                imageUrl: true,
                thumbnailUrl: true
              }
            }
          }
        },
        favoriteList: {
          include: {
            gallery: {
              select: { title: true }
            },
            _count: {
              select: { items: true }
            },
            items: {
              orderBy: { createdAt: "asc" },
              take: 120,
              select: {
                photo: {
                  select: {
                    id: true,
                    filename: true,
                    imageUrl: true,
                    thumbnailUrl: true
                  }
                }
              }
            }
          }
        },
        spreads: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            items: {
              orderBy: { slotIndex: "asc" },
              include: {
                photo: {
                  select: {
                    id: true,
                    filename: true,
                    imageUrl: true,
                    thumbnailUrl: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.customer.findMany({
      where: adminOwnedWhere(admin),
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        coupleName: true
      }
    }),
    prisma.customerProject.findMany({
      where: {
        projectType: "album",
        status: { not: "archived" },
        customer: adminOwnedWhere(admin)
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        customerId: true,
        title: true,
        customer: {
          select: {
            coupleName: true
          }
        }
      }
    })
  ]);

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Album szerkesztő</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Beépített album szerkesztő</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-graphite/70">
          Hozz létre albumtervet ügyfél nélkül is, dolgozz favorite listából, majd amikor kész vagy, rendeld hozzá a megfelelő ügyfélhez vagy album projekthez.
        </p>
      </div>

      <div className="mb-5 space-y-3">
        {flags.albumDesignCreated ? <Alert title="Albumterv létrehozva." variant="success" /> : null}
        {flags.albumDesignDeleted ? <Alert title="Albumterv törölve." variant="success" /> : null}
        {flags.albumDesignUpdated ? <Alert title="Albumterv kapcsolata mentve." variant="success" /> : null}
        {flags.albumDesignExported ? <Alert title={`${flags.albumDesignExported} albumterv oldalpár bekerült az album ellenőrzőbe.`} variant="success" /> : null}
        {flags.albumSpreadAutoCreated ? <Alert title="Automatikus album oldalpár létrehozva." variant="success" /> : null}
        {flags.albumSpreadCreated ? <Alert title="Album oldalpár létrehozva." variant="success" /> : null}
        {flags.albumSpreadRegenerated ? <Alert title="Album oldalpár újragenerálva." variant="success" /> : null}
        {flags.albumSpreadUpdated ? <Alert title="Album oldalpár frissítve." variant="success" /> : null}
        {flags.albumSpreadSlotUpdated ? <Alert title="Album oldalpár képe frissítve." variant="success" /> : null}
        {flags.albumSpreadDeleted ? <Alert title="Album oldalpár törölve." variant="success" /> : null}
        {flags.albumDesignError === "favorite-list" ? <Alert title="Válassz favorite listát az albumtervhez." variant="error" /> : null}
        {flags.albumDesignError === "source-gallery" ? <Alert title="A kiválasztott galéria nem található vagy nincs benne kép." variant="error" /> : null}
        {flags.albumDesignError === "customer" ? <Alert title="Az album ellenőrzőhöz előbb ügyfélhez kell rendelni az albumtervet." variant="error" /> : null}
        {flags.albumDesignError === "project" ? <Alert title="A kiválasztott album projekt nem található." variant="error" /> : null}
        {flags.albumDesignError === "photo-count" ? <Alert title="A kiválasztott képek száma nem passzol a layout sablonhoz." variant="error" /> : null}
        {flags.albumDesignError === "layout-count" ? <Alert title="Ehhez a képszámhoz még nincs album layout sablon." variant="error" /> : null}
        {flags.albumDesignError === "no-spreads" ? <Alert title="Nincs exportálható album oldalpár ebben a tervben." variant="error" /> : null}
        {flags.albumDesignError === "export-failed" ? <Alert title="Az albumterv JPG exportja nem sikerült." variant="error" /> : null}
        {flags.albumDesignError === "invalid-photos" ? <Alert title="A kiválasztott képek nem ehhez a favorite listához tartoznak." variant="error" /> : null}
        {flags.albumDesignError === "slot" ? <Alert title="A kiválasztott album slot nem érvényes." variant="error" /> : null}
        {flags.albumDesignError === "missing" ? <Alert title="Az albumterv nem található." variant="error" /> : null}
      </div>

      <AlbumDesignManager
        customerId={null}
        favoriteLists={favoriteLists.filter((list) => list._count.items > 0)}
        sourceGalleries={sourceGalleries.map((gallery) => ({
          id: gallery.id,
          title: gallery.title,
          customerName: gallery.customer?.coupleName ?? null,
          photoCount: gallery._count.photos
        }))}
        designs={albumDesigns}
        projects={albumProjects.map((project) => ({
          id: project.id,
          customerId: project.customerId,
          customerName: project.customer.coupleName,
          title: project.title
        }))}
        customers={customers}
      />
    </AdminShell>
  );
}
