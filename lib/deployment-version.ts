export function getDeploymentVersion() {
  return (
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    "local-development"
  );
}
