"use client";

import { Blobatar } from "@blobatar/react";

type Props = {
  username: string;
  size?: number;
  className?: string;
};

/** Always blobatar — never Zitadel picture. */
export function UserBlobatar({ username, size = 36, className }: Props) {
  return (
    <span className={className} style={{ width: size, height: size, display: "inline-flex" }}>
      <Blobatar name={username} size={size} animate="hover" />
    </span>
  );
}
