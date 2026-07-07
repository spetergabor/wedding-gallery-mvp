import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { customerProjectAccessWhere } from "@/lib/admin-scope";
import { buildCustomerProjectCalendarIcs, customerProjectCalendarFilename, customerProjectCalendarUid } from "@/lib/customer-project-calendar";
import { customerProjectTypeLabel } from "@/lib/customer-project-options";
import { appBaseUrl } from "@/lib/email";
import { prisma } from "@/lib/prisma";

function plainTextResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ projectId: string }>;
  }
) {
  const admin = await getAdminSession();

  if (!admin || admin.status !== "approved") {
    return plainTextResponse("Nincs jogosultságod a naptárfájlhoz.", 401);
  }

  const { projectId } = await params;
  const project = await prisma.customerProject.findFirst({
    where: customerProjectAccessWhere(admin, projectId),
    include: {
      customer: {
        select: {
          id: true,
          coupleName: true
        }
      }
    }
  });

  if (!project || !project.eventDate) {
    return plainTextResponse("A projekt naptárfájlja nem található.", 404);
  }

  const url = `${appBaseUrl()}/admin/clients/${project.customerId}?tab=projects`;
  const description = [
    `Ügyfél: ${project.customer.coupleName}`,
    `Típus: ${customerProjectTypeLabel(project.projectType)}`,
    project.notes ? `Megjegyzés: ${project.notes}` : null,
    `Projekt link: ${url}`
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
