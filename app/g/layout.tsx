import { PublicGalleryVersionGuard } from "@/components/public-gallery-version-guard";
import { getDeploymentVersion } from "@/lib/deployment-version";

export default function PublicGalleryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PublicGalleryVersionGuard version={getDeploymentVersion()} />
      {children}
    </>
  );
}
