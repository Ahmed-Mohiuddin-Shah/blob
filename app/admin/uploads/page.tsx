import { redirect } from "next/navigation";

/** Legacy Glass upload queue — stickers pending lives on profile. */
export default function AdminUploadsRedirect() {
  redirect("/profile/pending");
}
