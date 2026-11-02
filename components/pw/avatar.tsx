import Link from "next/link";

import classes from "./avatar.module.scss";

export interface PwAvatarProps {
  name?: string | null;
  email?: string | null;
  href: string;
}

/** Avatar из payloadcms/website: их SCSS-модуль и их разметка. */
export function PwAvatar({ name, email, href }: PwAvatarProps) {
  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <Link href={href} className={classes.avatar} aria-label={name ?? email ?? "Аккаунт"}>
      <span className={classes.userInitial}>{initial}</span>
    </Link>
  );
}
