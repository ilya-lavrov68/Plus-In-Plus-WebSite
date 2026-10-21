"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { localAvatarPath } from "@/lib/upload-policy";
import {
  profileInitials,
  profileName,
  type UserProfile,
} from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function UserAvatar({
  user,
  size = 64,
  className,
}: {
  user: Pick<UserProfile, "firstName" | "lastName" | "email" | "avatar">;
  size?: 36 | 64;
  className?: string;
}) {
  const t = useTranslations("account");
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = localAvatarPath(user.avatar);
  const name = profileName(user) || user.email;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary font-semibold text-foreground",
        size === 64 ? "h-16 w-16 text-xl" : "h-9 w-9 text-sm",
        className
      )}
      role="img"
      aria-label={t("avatarLabel", { name })}
    >
      {src && failedSource !== src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <span aria-hidden="true">{profileInitials(user)}</span>
      )}
    </span>
  );
}
