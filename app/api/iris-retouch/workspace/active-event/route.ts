import {
  DELETE as canonicalDELETE,
  GET as canonicalGET,
  PATCH as canonicalPATCH
} from "@/app/api/irismoment/workspace/active-event/route";

export const runtime = "nodejs";
export const DELETE = canonicalDELETE;
export const GET = canonicalGET;
export const PATCH = canonicalPATCH;
