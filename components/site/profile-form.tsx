"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateUserProfile } from "@/app/actions/user";
import { UserAvatar } from "@/components/site/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

export interface ProfileFormProps {
  initialUser: {
    email: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    role: string;
  };
}

export function ProfileForm({ initialUser }: ProfileFormProps) {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const t = useTranslations("profile");

  const [firstName, setFirstName] = useState(initialUser.firstName);
  const [lastName, setLastName] = useState(initialUser.lastName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUser.avatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    session?.user?.name ||
    initialUser.email;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);
    setIsLoading(true);

    try {
      let result;
      if (avatarFile && avatarFile.size > 0) {
        const formData = new FormData();
        formData.set("firstName", firstName);
        formData.set("lastName", lastName);
        formData.set("avatar", avatarFile);
        result = await updateUserProfile(formData);
      } else {
        result = await updateUserProfile({
          firstName,
          lastName,
        });
      }

      if (result.avatar !== undefined) {
        setAvatarUrl(result.avatar);
      }
      setAvatarFile(null);

      await update();
      router.refresh();

      setFeedback({ kind: "success", text: t("updatedSuccess") });
      toast({
        title: t("updatedSuccess"),
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : t("updateFailed");
      setFeedback({ kind: "error", text: message });
      toast({
        title: t("updateFailed"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 md:py-32">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/60 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                user={{
                  firstName,
                  lastName,
                  email: initialUser.email,
                  avatar: avatarUrl,
                }}
                size={64}
              />
              <div>
                <CardTitle className="text-lg">{displayName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {initialUser.email}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="uppercase">
              {initialUser.role}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={initialUser.email}
                disabled
                className="bg-muted/60 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                {t("emailImmutable")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("firstName")}</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("firstName")}
                  maxLength={80}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{t("lastName")}</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("lastName")}
                  maxLength={80}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar-upload">{t("avatarLabel")}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Label
                  htmlFor="avatar-upload"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary/50 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <Upload aria-hidden="true" className="h-3.5 w-3.5" />
                  {avatarFile ? avatarFile.name : t("avatarLabel")}
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) =>
                    setAvatarFile(e.target.files?.[0] ?? null)
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {t("avatarHint")}
                </span>
              </div>
            </div>

            {feedback ? (
              <p
                role={feedback.kind === "error" ? "alert" : "status"}
                className={
                  feedback.kind === "error"
                    ? "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                    : "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200"
                }
              >
                {feedback.text}
              </p>
            ) : null}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("saving") : t("saveChanges")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
