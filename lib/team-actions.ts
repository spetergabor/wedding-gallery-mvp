"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(code: string): never {
  redirect(`/admin/team?error=${code}`);
}

export async function addTeamMemberAction(formData: FormData) {
  const admin = await requireAdmin();

  if (admin.isTeamMember) {
    redirectWithError("team_member");
  }

  const email = formString(formData, "email").toLowerCase();

  if (!email || !email.includes("@")) {
    redirectWithError("email");
  }

  const member = await prisma.admin.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      teamMembership: {
        select: {
          owner: {
            select: {
              name: true,
              email: true
            }
          }
        }
      },
      _count: {
        select: {
          teamMembers: true
        }
      }
    }
  });

  if (!member) {
    redirectWithError("not_found");
  }

  if (member.id === admin.id) {
    redirectWithError("self");
  }

  if (member.role === "super_admin") {
    redirectWithError("super_admin");
  }

  if (member.status !== "approved") {
    redirectWithError("not_approved");
  }

  if (member.teamMembership) {
    redirectWithError("already_member");
  }

  if (member._count.teamMembers > 0) {
    redirectWithError("owns_team");
  }

  await prisma.adminTeamMembership.create({
    data: {
      ownerAdminId: admin.id,
      memberAdminId: member.id
    }
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?added=1");
}

export async function removeTeamMemberAction(membershipId: string) {
  const admin = await requireAdmin();

  if (admin.isTeamMember) {
    redirectWithError("team_member");
  }

  const membership = await prisma.adminTeamMembership.findFirst({
    where: {
      id: membershipId,
      ownerAdminId: admin.id
    },
    select: {
      id: true
    }
  });

  if (!membership) {
    redirectWithError("missing");
  }

  await prisma.adminTeamMembership.delete({
    where: { id: membership.id }
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?removed=1");
}
