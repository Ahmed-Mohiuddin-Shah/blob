import { redirect } from "next/navigation";

/** Legacy admin users URL — lives under profile shell now. */
export default function AdminUsersRedirect() {
  redirect("/profile/users");
}
