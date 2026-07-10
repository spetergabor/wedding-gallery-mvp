import { NextResponse } from "next/server";
import { buildCustomerProjectCalendarIcs, customerProjectCalendarFilename, customerProjectCalendarUid } from "@/lib/customer-project-calendar";
import { customerPortalUrl } from "@/lib/email";
import { prisma } from "@/lib/prisma";

function plainTextResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function projectTypeLabel(type: string, language: "hu" | "de") {
  const labels = {
    hu: {
      wedding: "Esküvő",
      couple_session: "Párfotózás",
      mini_session: "Mini fotózás",
      family: "Családi fotózás",
      event: "Esemény",
      business: "Céges / brand",
      album: "Album",
      general: "Általános projekt"
    },
    de: {
      wedding: "Hochzeit",
      couple_session: "Paarshooting",
      mini_session: "Mini-Session",
      family: "Familienshooting",
      event: "Event",
      business: "Business / Brand",
      album: "Album",
      general: "Allgemeines Projekt"
    }
  } as const;

  return labels[language][type as keyof (typeof labels)["hu"]] ?? labels[language].general;
}

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ token: string; projectId: string }>;
  }
) {
  const { token, projectId } = await params;
  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      coupleName: true,
      preferredLanguage: true,
      admin: {
        select: {
          siteSettings: {
            select: {
              publicSubdomain: true
            }
          }
        }
      },
      projects: {
        where: {
          id: projectId,
          status: { not: "archived" }
        },
        take: 1
      }
    }
  });
  const project = customer?.projects[0] ?? null;

  if (!customer || !project || !project.eventDate) {
    return plainTextResponse("Érvénytelen naptár link.", 404);
  }

  const language = customer.preferredLanguage === "hu" ? "hu" : "de";
  const publicSubdomain = customer.admin.siteSettings?.publicSubdomain ?? null;
  const url = customerPortalUrl(token, publicSubdomain);
  const description = [
    language === "de" ? `Paar: ${customer.coupleName}` : `Pár: ${customer.coupleName}`,
    `${language === "de" ? "Typ" : "Típus"}: ${projectTypeLabel(project.projectType, language)}`,
    `${language === "de" ? "Portal" : "Portál"}: ${url}`
  ].filter(Boolean).join("\n");
  const ics = buildCustomerProjectCalendarIcs({
    uid: customerProjectCalendarUid(project.id),
    title: project.title,
    eventDate: project.eventDate,
    startTime: project.startTime,
    endTime: project.endTime,
    location: project.venue,
    description,
    url,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${customerProjectCalendarFilename(project.title)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
