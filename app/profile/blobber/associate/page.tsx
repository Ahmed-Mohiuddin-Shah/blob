import { BlobberAssociateForm } from "@/components/blobber-associate-form";
import { requireSessionUser } from "@/lib/require-user";
import Link from "next/link";

export default async function ProfileBlobberAssociatePage() {
  await requireSessionUser();
  return (
    <div>
      <p className="text-sm">
        <Link
          href="/profile/blobber"
          className="text-accent-pink hover:underline"
        >
          ← Blobber profile
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Associate with a Blobber
      </h1>
      <div className="mt-8">
        <BlobberAssociateForm />
      </div>
    </div>
  );
}
