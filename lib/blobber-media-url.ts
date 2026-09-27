/** Client-safe preview URL for a Glass object used as blobber media. */
export function blobberMediaUrl(objectId: string | null | undefined): string | null {
  if (!objectId) return null;
  return `/api/glass/objects/${objectId}`;
}
