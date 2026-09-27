/**
 * Job payload shapes shared by control plane and remote workers.
 * Keep this file free of prisma / glass — workers import these types only.
 */

import { JOB_TYPE } from "./types";

export type CompositionJobPayload = {
  kind: typeof JOB_TYPE.compositionEncode;
  stickerId: string;
  slug: string;
  title: string;
  revisionId: string;
  documentJson: unknown;
  maxDurationMs: number | null;
  prismId: string | null;
  assets: Array<{
    id: string;
    glassObjectId: string;
    mimeType: string;
  }>;
};

export type SheetJobPayload = {
  kind: typeof JOB_TYPE.sheetEncode;
  sheetId: string;
  slug: string;
  name: string;
  printDocumentJson: unknown;
  prismId: string;
  stickers: Array<{
    stickerId: string;
    glassObjectId: string;
    mimeType: string;
  }>;
};

export type PackJobPayload = {
  kind: typeof JOB_TYPE.packEncode;
  packId: string;
  slug: string;
  name: string;
  prismId: string;
  sheets: Array<{
    sheetId: string;
    status: string;
    pngGlassObjectId: string | null;
    pdfGlassObjectId: string | null;
  }>;
};

export type JobPayload =
  | CompositionJobPayload
  | SheetJobPayload
  | PackJobPayload;
