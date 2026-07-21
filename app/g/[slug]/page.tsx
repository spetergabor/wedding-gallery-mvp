import { notFound } from "next/navigation";
import Image from "next/image";
import { Facebook, Instagram, Lock, Mail, Music2, Phone, Youtube, type LucideIcon } from "lucide-react";
import { GalleryViewTracker } from "@/components/gallery-view-tracker";
import { PublicGallery } from "@/components/public-gallery";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { prisma } from "@/lib/prisma";
import {
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  PROOFING_STATUS_DELIVERED,
  isProofingGallery
} from "@/lib/proofing";
import { canViewGallery, getPaidGalleryPurchaseDownloadState, unlockGalleryAction } from "@/lib/public-actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { dateLocaleForCustomer, normalizeCustomerLanguage } from "@/lib/customer-language";
import { GALLERY_DELIVERY_PAID, galleryDeliveryAllowsDownloads, normalizeGalleryDeliveryMode } from "@/lib/gallery-delivery";
import {
  GALLERY_PURCHASE_KIND_PHOTOS,
  GALLERY_PURCHASE_PAID,
  formatGallerySalePrice,
  galleryPurchasePhotoIds
} from "@/lib/gallery-sales";
import { normalizeGallerySalePricingTiers } from "@/lib/gallery-sale-pricing";
import { GALLERY_DESIGN_COVER_STICKY, normalizeGalleryDesign } from "@/lib/gallery-design";
import {
  galleryHeroTitleSizeClamp,
  galleryTextColorOrDefault,
  galleryTitleFontDefinition,
  normalizeGalleryGridGap,
  normalizeGalleryImageRadius,
  normalizeGalleryTitleSize
} from "@/lib/gallery-appearance";

function formatEventDate(date: Date | null, language: "de" | "hu") {
  if (!date) {
    return language === "hu" ? "Privát galéria" : "Private Galerie";
  }

  return new Intl.DateTimeFormat(dateLocaleForCustomer(language), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function mailHref(value: string | null | undefined) {
  const email = value?.trim();

  return email ? `mailto:${email}` : null;
}

function phoneHref(value: string | null | undefined) {
  const phone = value?.trim();

  if (!phone) {
    return null;
  }

  const normalizedPhone = phone.replace(/[^\d+]/g, "");

  return normalizedPhone ? `tel:${normalizedPhone}` : null;
}

type ContactQuickLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
};

export default async function PublicGalleryPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; lang?: string; purchase?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const flags = await searchParams;
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    include: {
      sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      photos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          section: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        }
      },
      customer: {
        select: { preferredLanguage: true }
      }
    }
  });

  if (!gallery || !gallery.isActive) {
    notFound();
  }

  const settings = await prisma.siteSettings.findFirst({
    where: {
      OR: [
        ...(gallery.adminId ? [{ adminId: gallery.adminId }] : []),
        ...(gallery.adminId ? [] : [{ id: "default" }])
      ]
    },
    select: {
      businessName: true,
      logoUrl: true,
      logoHeight: true,
      contactEmail: true,
      contactPhone: true,
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
      youtubeUrl: true
    }
  });

  const canView = await canViewGallery(slug, gallery.password);
  const proofingGallery = isProofingGallery(gallery.galleryMode);
  const publicDeliveryStage =
    proofingGallery && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED
      ? PHOTO_DELIVERY_STAGE_RAW
      : PHOTO_DELIVERY_STAGE_FINAL;
  const visiblePhotos = gallery.photos.filter((photo) => !photo.isClientHidden && photo.deliveryStage === publicDeliveryStage);
  const visibleVideos = visiblePhotos.filter((photo) => photo.mediaType === "video");
  const visibleImages = visiblePhotos.filter((photo) => photo.mediaType !== "video");
  const publicPhotos = [...visibleVideos, ...visibleImages];
  const visibleSectionIds = new Set(visibleImages.map((photo) => photo.sectionId).filter((sectionId): sectionId is string => Boolean(sectionId)));
  const visibleSections = gallery.sections.filter((section) => visibleSectionIds.has(section.id));
  const knownSectionIds = new Set(gallery.sections.map((section) => section.id));
  const unsectionedPhotoCount = visibleImages.filter((photo) => !photo.sectionId || !knownSectionIds.has(photo.sectionId)).length;
  const sectionPhotoCounts = new Map<string, number>();

  for (const photo of visibleImages) {
    if (photo.sectionId) {
      sectionPhotoCounts.set(photo.sectionId, (sectionPhotoCounts.get(photo.sectionId) ?? 0) + 1);
    }
  }

  const deliveryMode = normalizeGalleryDeliveryMode(gallery.deliveryMode);
  const paidGallery = deliveryMode === GALLERY_DELIVERY_PAID;
  const downloadsEnabled =
    gallery.downloadsEnabled &&
    galleryDeliveryAllowsDownloads(deliveryMode) &&
    (!proofingGallery || gallery.proofingStatus === PROOFING_STATUS_DELIVERED);
  const favoritesEnabled = !proofingGallery || gallery.proofingStatus !== PROOFING_STATUS_DELIVERED;
  const proofingSelection = proofingGallery && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED;
  const coverPhoto =
    visiblePhotos.find((photo) => photo.id === gallery.coverPhotoId && photo.mediaType !== "video") ??
    visiblePhotos.find((photo) => photo.mediaType !== "video") ??
    null;
  const coverPosition = `${gallery.coverPositionX ?? 50}% ${gallery.coverPositionY ?? 50}%`;
  const language = normalizeCustomerLanguage(gallery.customer?.preferredLanguage ?? flags.lang);
  const logoHeight = Math.min(140, Math.max(32, settings?.logoHeight ?? 80));
  const heroMeta = proofingSelection ? (language === "hu" ? "Képválogatás" : "Bildauswahl") : formatEventDate(gallery.eventDate, language);
  const publicGalleryPath = `/g/${gallery.slug}`;
  const galleryDesign = normalizeGalleryDesign(gallery.galleryDesign);
  const heroTextColor = galleryTextColorOrDefault(
    gallery.galleryTextColor,
    galleryDesign === GALLERY_DESIGN_COVER_STICKY ? "#ffffff" : "#111111"
  );
  const heroTitleFont = galleryTitleFontDefinition(gallery.galleryTitleFont);
  const heroTitleSize = normalizeGalleryTitleSize(gallery.galleryTitleSize);
  const heroTitleStyle = {
    fontFamily: heroTitleFont.family,
    fontSize: galleryHeroTitleSizeClamp(heroTitleSize)
  };
  const publicGridGap = normalizeGalleryGridGap(gallery.publicGridGap);
  const publicImageRadius = normalizeGalleryImageRadius(gallery.publicImageRadius);
  const contactTitle = language === "hu" ? "Fotós elérhetőségei" : "Fotograf kontaktieren";
  const contactText = language === "hu" ? "Kérdésed van a galériával kapcsolatban?" : "Fragen zur Galerie?";
  const contactLinks: ContactQuickLink[] = [
    { href: mailHref(settings?.contactEmail) ?? "", label: "Email", icon: Mail },
    { href: phoneHref(settings?.contactPhone) ?? "", label: language === "hu" ? "Telefon" : "Telefon", icon: Phone },
    { href: settings?.instagramUrl ?? "", label: "Instagram", icon: Instagram, external: true },
    { href: settings?.facebookUrl ?? "", label: "Facebook", icon: Facebook, external: true },
    { href: settings?.tiktokUrl ?? "", label: "TikTok", icon: Music2, external: true },
    { href: settings?.youtubeUrl ?? "", label: "YouTube", icon: Youtube, external: true }
  ].filter((link) => link.href);
  const paidPurchaseDownloadState =
    paidGallery && flags.session_id
      ? await getPaidGalleryPurchaseDownloadState(gallery.id, flags.session_id)
      : null;
  const paidAccessPurchase =
    paidGallery && flags.session_id && !paidPurchaseDownloadState?.paid
      ? await prisma.galleryPurchase.findFirst({
          where: {
            galleryId: gallery.id,
            stripeCheckoutSessionId: flags.session_id,
            status: GALLERY_PURCHASE_PAID
          },
          select: {
            id: true,
            purchaseKind: true,
            purchasedPhotoIds: true
          }
        })
      : null;
  const paidPurchaseKind =
    paidPurchaseDownloadState?.paid
      ? paidPurchaseDownloadState.purchaseKind
      : paidAccessPurchase?.purchaseKind ?? null;
  const purchasedPhotoIds =
    paidPurchaseDownloadState?.paid
      ? paidPurchaseDownloadState.purchasedPhotoIds
      : galleryPurchasePhotoIds(paidAccessPurchase?.purchasedPhotoIds);
  const purchasedPhotoIdSet = new Set(purchasedPhotoIds);
  const fullGalleryPurchased = paidGallery && Boolean(paidPurchaseKind && paidPurchaseKind !== GALLERY_PURCHASE_KIND_PHOTOS);
  const protectedPhotoUrl = (photoId: string) => `/g/${gallery.slug}/watermark/${photoId}?v=6`;
  const canAccessOriginalPhoto = (photo: (typeof publicPhotos)[number]) => {
    return !paidGallery || fullGalleryPurchased || purchasedPhotoIdSet.has(photo.id);
  };
  const coverPhotoSrc =
    paidGallery && coverPhoto && !canAccessOriginalPhoto(coverPhoto)
      ? protectedPhotoUrl(coverPhoto.id)
      : coverPhoto
        ? coverPhoto.previewUrl || coverPhoto.imageUrl
        : "";
  const publicGalleryPhotos = paidGallery
    ? publicPhotos.map((photo) =>
        photo.mediaType === "video" || canAccessOriginalPhoto(photo)
          ? photo
          : {
              ...photo,
              imageUrl: protectedPhotoUrl(photo.id),
              thumbnailUrl: protectedPhotoUrl(photo.id),
              previewUrl: protectedPhotoUrl(photo.id)
            }
      )
    : publicPhotos;

  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-7 text-center shadow-soft">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-ink text-white">
            <Lock size={20} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-ink">{gallery.title}</h1>
          <p className="mt-2 text-sm text-graphite/70">{language === "hu" ? "Ez a galéria PIN-kóddal védett." : "Diese Galerie ist mit PIN-Code geschützt."}</p>

          {flags.error ? (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {flags.error === "rate"
                ? language === "hu"
                  ? "Túl sok próbálkozás történt. Várj pár percet, és próbáld újra."
                  : "Zu viele Versuche. Bitte warte kurz und versuche es erneut."
                : language === "hu"
                  ? "A PIN-kód nem megfelelő."
                  : "Der PIN-Code ist nicht korrekt."}
            </div>
          ) : null}

          <form action={unlockGalleryAction.bind(null, slug)} className="mt-6 space-y-4">
            <input type="hidden" name="lang" value={language} />
            <input
              name="password"
              type="password"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={language === "hu" ? "PIN-kód" : "PIN-Code"}
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-left outline-none transition focus:border-ink/50"
            />
            <FormSubmitButton
              type="submit"
              className="w-full"
              pendingLabel={language === "hu" ? "Megnyitás..." : "Öffnen..."}
            >
              {language === "hu" ? "Galéria megnyitása" : "Galerie öffnen"}
            </FormSubmitButton>
          </form>
        </section>
      </main>
    );
  }

  const saleSettings = paidGallery
    ? {
        priceCents: gallery.salePriceCents,
        unitPriceCents: gallery.saleUnitPriceCents,
        pricingTiers: normalizeGallerySalePricingTiers(gallery.salePricingTiers),
        currency: gallery.saleCurrency,
        priceLabel: formatGallerySalePrice(gallery.salePriceCents, gallery.saleCurrency, dateLocaleForCustomer(language)),
        purchaseStatus: flags.purchase ?? null,
        purchaseSessionId: flags.session_id ?? null,
        purchaseDownload: paidPurchaseDownloadState?.paid ? paidPurchaseDownloadState : null,
        purchasedPhotoIds,
        fullGalleryPurchased
      }
    : null;

  const galleryContent =
    visiblePhotos.length > 0 ? (
      <PublicGallery
        galleryId={gallery.id}
        gallerySlug={gallery.slug}
        title={gallery.title}
        photos={publicGalleryPhotos}
        sections={visibleSections}
        downloadsEnabled={downloadsEnabled}
        deliveryMode={deliveryMode}
        sale={saleSettings}
        favoritesEnabled={favoritesEnabled}
        favoriteMode={proofingSelection ? "proofing" : "favorites"}
        language={language}
        mobileColumns={gallery.publicColumnCount}
        gridGap={publicGridGap}
        imageRadius={publicImageRadius}
        stickyToolbar={
          galleryDesign === GALLERY_DESIGN_COVER_STICKY
            ? {
                title: gallery.title,
                subtitle: settings?.businessName || heroMeta,
                sharePath: publicGalleryPath
              }
            : null
        }
      />
    ) : (
      <div className="rounded-lg border border-ink/10 bg-white px-5 py-16 text-center text-sm text-graphite/70">
        {language === "hu" ? "Ez a galéria még nem tartalmaz fotókat." : "Diese Galerie enthält noch keine Fotos."}
      </div>
    );

  if (galleryDesign === GALLERY_DESIGN_COVER_STICKY) {
    return (
      <main className="min-h-screen bg-paper">
        <GalleryViewTracker galleryId={gallery.id} />
        <header className="relative min-h-[52vh] overflow-hidden bg-ink text-white sm:min-h-[62vh] lg:min-h-[68vh]">
          {coverPhoto ? (
            <Image
              src={coverPhotoSrc}
              alt={gallery.title}
              fill
              priority
              quality={100}
              unoptimized
              className="object-cover"
              sizes="100vw"
              style={{ objectPosition: coverPosition }}
            />
          ) : (
            <div className="absolute inset-0 bg-graphite" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(17,17,17,0.10),rgba(17,17,17,0.20)_46%,rgba(17,17,17,0.58))]" />
          <div className="relative mx-auto flex min-h-[52vh] w-full max-w-7xl items-end px-5 pb-8 pt-24 sm:min-h-[62vh] sm:pb-10 lg:min-h-[68vh] lg:px-8 lg:pb-12">
            <div className="max-w-4xl" style={{ color: heroTextColor }}>
              {settings?.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt={settings.businessName || "Logo"}
                  width={180}
                  height={84}
                  unoptimized
                  className="mb-5 w-auto object-contain drop-shadow"
                  style={{ height: `${Math.min(88, logoHeight)}px`, maxWidth: "min(58vw, 240px)" }}
                />
              ) : settings?.businessName ? (
                <p className="mb-3 text-xs font-semibold uppercase opacity-80 sm:text-sm">{settings.businessName}</p>
              ) : null}
              <p className="text-xs font-semibold uppercase opacity-75 sm:text-sm">{heroMeta}</p>
              <h1
                className="mt-2 max-w-[11ch] font-semibold leading-[0.95] drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:max-w-[13ch]"
                style={heroTitleStyle}
              >
                {gallery.title}
              </h1>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-7xl px-5 pb-28 lg:px-8">
          {galleryContent}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper">
      <GalleryViewTracker galleryId={gallery.id} />
      <header className="relative min-h-[92vh] overflow-hidden bg-paper text-ink">
        <div className="absolute inset-0 overflow-hidden bg-ink">
          {coverPhoto ? (
            <Image
              src={coverPhotoSrc}
              alt={gallery.title}
              fill
              priority
              quality={100}
              unoptimized
              className="object-cover"
              sizes="100vw"
              style={{ objectPosition: coverPosition }}
            />
          ) : (
            <div className="absolute inset-0 bg-graphite" />
          )}
          <div className="absolute inset-0 bg-ink/25" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[70vh] bg-[linear-gradient(to_bottom,rgba(248,247,244,0)_0%,rgba(248,247,244,0.52)_34%,rgba(248,247,244,0.92)_58%,#f8f7f4_82%,#f8f7f4_100%)]" />
        <div className="relative mx-auto flex min-h-[92vh] w-full max-w-5xl flex-col items-center justify-end px-5 pb-16 pt-32 text-center lg:pb-20">
          <div className="flex w-full flex-col items-center" style={{ color: heroTextColor }}>
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.businessName || "Logo"}
                width={190}
                height={90}
                unoptimized
                className="mb-5 w-auto object-contain"
                style={{ height: `${logoHeight}px`, maxWidth: "min(70vw, 320px)" }}
              />
            ) : settings?.businessName ? (
              <p className="font-playfair mb-5 text-lg tracking-[0.18em] opacity-75">
                {settings.businessName}
              </p>
            ) : null}
            <h1
              className="font-semibold leading-tight"
              style={heroTitleStyle}
            >
              {gallery.title}
            </h1>
            <p className="font-playfair mt-4 text-xl opacity-75 md:text-2xl">{heroMeta}</p>
            {proofingSelection ? (
              <p className="mt-4 max-w-2xl text-sm leading-6 opacity-75 md:text-base">
                {language === "hu" ? "Válasszátok ki azokat a fotókat, amelyeket végleges kidolgozásra szeretnétek." : "Wählt die Fotos aus, die ihr final bearbeiten lassen möchtet."}
              </p>
            ) : null}
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.24em] text-graphite/70">
              {visiblePhotos.length} {language === "hu" ? "média" : "Medien"}
            </p>
            <div className="mt-7 flex justify-center">
              <SocialShareButtons path={publicGalleryPath} title={gallery.title} variant="card" language={language} />
            </div>
            {contactLinks.length > 0 ? (
              <div className="mt-5 w-full max-w-2xl rounded-lg border border-ink/10 bg-white/80 px-4 py-4 text-center shadow-soft backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-graphite/65">{contactTitle}</p>
                <p className="mt-1 text-sm text-graphite/75">{contactText}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {contactLinks.map((link) => {
                    const Icon = link.icon;

                    return (
                      <a
                        key={`${link.label}-${link.href}`}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noreferrer" : undefined}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/25 hover:bg-paper"
                      >
                        <Icon size={15} />
                        {link.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-5 pb-28 lg:px-8">
        {visibleSections.length > 0 ? (
          <nav
            className="sticky top-0 z-30 -mx-5 -mt-8 mb-12 border-b border-ink/10 bg-paper/95 px-5 py-2.5 shadow-[0_12px_28px_rgba(17,17,17,0.05)] backdrop-blur lg:-mx-8 lg:px-8"
            aria-label={language === "hu" ? "Galéria szekciók" : "Galerie Abschnitte"}
          >
            <div className="flex min-w-full gap-2 overflow-x-auto [scrollbar-width:none] md:justify-center [&::-webkit-scrollbar]:hidden">
              {visibleVideos.length > 0 ? (
                <a
                  href="#public-gallery-videos"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white px-4 text-sm font-semibold text-graphite shadow-sm transition hover:border-ink/25 hover:text-ink"
                >
                  {language === "hu" ? "Videók" : "Videos"}
                  <span className="ml-2 text-xs opacity-70">{visibleVideos.length}</span>
                </a>
              ) : null}
              {visibleSections.map((section) => (
                <a
                  key={section.id}
                  href={`#gallery-section-${section.slug}`}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white px-4 text-sm font-semibold text-graphite shadow-sm transition hover:border-ink/25 hover:text-ink"
                >
                  {section.title}
                  <span className="ml-2 text-xs opacity-70">{sectionPhotoCounts.get(section.id) ?? 0}</span>
                </a>
              ))}
              {unsectionedPhotoCount > 0 ? (
                <a
                  href="#gallery-section-rest"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white px-4 text-sm font-semibold text-graphite shadow-sm transition hover:border-ink/25 hover:text-ink"
                >
                  {language === "hu" ? "További képek" : "Weitere Bilder"}
                  <span className="ml-2 text-xs opacity-70">{unsectionedPhotoCount}</span>
                </a>
              ) : null}
            </div>
          </nav>
        ) : null}
        {galleryContent}
      </section>
    </main>
  );
}
