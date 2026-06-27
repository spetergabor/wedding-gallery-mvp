import { redirect } from "next/navigation";

export default function AdminSecurityPage() {
  redirect("/admin/settings?tab=security");
}
