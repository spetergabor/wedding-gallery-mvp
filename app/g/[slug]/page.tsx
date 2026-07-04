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
import { canViewGallery, unlockGalleryAction } from "@/lib/public-actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { dateLocaleForCustomer, normalizeCustomerLanguage } from "@/lib/customer-language";

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
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const flags = await searchParams;
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    include: {
      photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
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
  const downloadsEnabled =
    gallery.downloadsEnabled && (!proofingGallery || gallery.proofingStatus === PROOFING_STATUS_DELIVERED);
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

  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-7 text-center shadow-soft">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-ink text-white">
            <Lock size={20} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-ink">{gallery.title}</h1>
          <p className="mt-2 text-sm text-graphite/70">{language === "hu" ? "Ez a galéria jelszóval védett." : "Diese Galerie ist passwortgeschützt."}</p>

          {flags.error ? (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {language === "hu" ? "A galéria jelszava nem megfelelő." : "Das Galerie-Passwort ist nicht korrekt."}
            </div>
          ) : null}

          <form action={unlockGalleryAction.bind(null, slug)} className="mt-6 space-y-4">
            <input type="hidden" name="lang" value={language} />
            <input
              name="password"
              type="password"
              required
              placeholder={language === "hu" ? "Galéria jelszó" : "Galerie-Passwort"}
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

  return (
    <main className="min-h-screen bg-paper">
      <GalleryViewTracker galleryId={gallery.id} />
      <header className="relative min-h-[92vh] overflow-hidden bg-paper text-ink">
        <div className="absolute inset-0 overflow-hidden bg-ink">
          {coverPhoto ? (
            <Image
              src={coverPhoto.previewUrl || coverPhoto.imageUrl}
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
          <div className="flex w-full flex-col items-center">
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
              <p className="font-playfair mb-5 text-lg tracking-[0.18em] text-ink/75">
                {settings.businessName}
              </p>
            ) : null}
            <h1 className="font-playfair text-5xl font-semibold leading-tight text-ink sm:text-6xl md:text-7xl lg:text-8xl">
              {gallery.title}
            </h1>
            <p className="font-playfair mt-4 text-xl text-ink/75 md:text-2xl">{heroMeta}</p>
            {proofingSelection ? (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/75 md:text-base">
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
        {visiblePhotos.length > 0 ? (
          <PublicGallery
            galleryId={gallery.id}
            title={gallery.title}
            photos={visiblePhotos}
            downloadsEnabled={downloadsEnabled}
            favoritesEnabled={favoritesEnabled}
            favoriteMode={proofingSelection ? "proofing" : "favorites"}
            language={language}
            maxColumns={gallery.publicColumnCount}
          />
        ) : (
          <div className="rounded-lg border border-ink/10 bg-white px-5 py-16 text-center text-sm text-graphite/70">
            {language === "hu" ? "Ez a galéria még nem tartalmaz fotókat." : "Diese Galerie enthält noch keine Fotos."}
          </div>
        )}
      </section>
    </main>
  );
}
