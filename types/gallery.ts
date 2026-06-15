export type GalleryStatus = "active" | "inactive";

export type GalleryPhoto = {
  id: string;
  filename: string;
  r2Key: string;
  imageUrl: string;
  thumbnailUrl: string;
  createdAt: Date;
};

export type GalleryWithPhotos = {
  id: string;
  title: string;
  slug: string;
  password: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  photos: GalleryPhoto[];
};
