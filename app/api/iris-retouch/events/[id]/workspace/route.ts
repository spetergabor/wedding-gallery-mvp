import { DELETE as canonicalDELETE, GET as canonicalGET, PATCH as canonicalPATCH } from "@/app/api/irismoment/events/[id]/workspace/route";

export const runtime = "nodejs";
export const GET = canonicalGET;
export const PATCH = canonicalPATCH;
export const DELETE = canonicalDELETE;
