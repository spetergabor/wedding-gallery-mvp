type GalleryEmailOwner = {
  name: string;
  email: string;
  siteSettings: { businessName: string; contactEmail: string | null } | null;
};

export function galleryEmailIdentity(owner: GalleryEmailOwner) {
  const contactEmail = owner.siteSettings?.contactEmail?.trim();
  return {
    senderName: owner.siteSettings?.businessName.trim() || owner.name.trim(),
    replyTo: contactEmail && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contactEmail)
      ? contactEmail
      : owner.email.trim()
  };
}
