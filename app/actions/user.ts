"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { localAvatarPath } from "@/lib/upload-policy";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { firstIssueMessage, profileSchema } from "@/lib/validators";

const WINDOW_MS = 10 * 60 * 1000;

export interface UpdateUserProfileInput {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface UpdateUserProfileResult {
  ok: boolean;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

/**
 * Обновление профиля текущего авторизованного пользователя.
 *
 * ЖЁСТКОЕ ОГРАНИЧЕНИЕ: запрещено редактировать профиль без авторизации.
 * Идентификатор пользователя берётся исключительно из подписанной сессии,
 * а email, роль и хэш пароля никогда не принимаются от клиента.
 */
export async function updateUserProfile(
  data: UpdateUserProfileInput | FormData
): Promise<UpdateUserProfileResult> {
  const t = await getActionTranslator();

  if (!isAuthConfigured() || !prisma) {
    throw new Error(t("loginToEditProfile"));
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("loginToEditProfile"));
  }

  if (
    !checkRateLimit(
      hashRateLimitIdentifier(`profile:${session.user.id}`),
      20,
      WINDOW_MS
    ).allowed
  ) {
    throw new Error(t("tooManyProfileUpdates"));
  }

  const rawFirstName = isFormData(data)
    ? String(data.get("firstName") ?? "")
    : String(data?.firstName ?? "");
  const rawLastName = isFormData(data)
    ? String(data.get("lastName") ?? "")
    : String(data?.lastName ?? "");

  const parsed = profileSchema.safeParse({
    firstName: rawFirstName,
    lastName: rawLastName,
  });

  if (!parsed.success) {
    throw new Error(t(firstIssueMessage(parsed.error)));
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, avatar: true, isBlocked: true },
  });

  if (!existing || existing.isBlocked) {
    throw new Error(t("unauthorized"));
  }

  let uploadedAvatar: string | null = null;
  let nextAvatar: string | null | undefined = undefined;
  let saved = false;

  try {
    if (isFormData(data)) {
      const file = data.get("avatar");
      if (typeof file === "string" && file) {
        throw new Error(t("chooseLocalImage"));
      }
      if (file instanceof File && file.name && file.size === 0) {
        throw new UploadValidationError(t("emptyImage"));
      }
      if (file instanceof File && file.size > 0) {
        uploadedAvatar = await saveImageUpload(file, "avatars");
        nextAvatar = uploadedAvatar;
      }
    } else if (data?.avatar !== undefined) {
      if (data.avatar === "") {
        nextAvatar = null;
      } else {
        const safePath = localAvatarPath(data.avatar);
        if (!safePath) {
          throw new Error(t("chooseLocalImage"));
        }
        nextAvatar = safePath;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          firstName: parsed.data.firstName || null,
          lastName: parsed.data.lastName || null,
          ...(nextAvatar !== undefined ? { avatar: nextAvatar } : {}),
        },
        select: {
          firstName: true,
          lastName: true,
          avatar: true,
        },
      });

      await recordActivity(tx, {
        action: "updated profile",
        entityType: "user",
        entityId: existing.id,
        title: existing.email,
        actorId: existing.id,
      });

      return user;
    });

    saved = true;
    if (uploadedAvatar && existing.avatar && existing.avatar !== uploadedAvatar) {
      await cleanupUpload(existing.avatar, "avatars");
    }

    revalidatePath("/profile");
    revalidatePath("/admin/users");
    revalidatePath("/admin/dashboard");

    return {
      ok: true,
      firstName: updated.firstName,
      lastName: updated.lastName,
      avatar: localAvatarPath(updated.avatar),
    };
  } catch (error) {
    if (uploadedAvatar && !saved) {
      await cleanupUpload(uploadedAvatar, "avatars");
    }
    if (error instanceof UploadValidationError) {
      throw new Error(error.message);
    }
    throw error instanceof Error ? error : new Error(t("profileSaveFailed"));
  }
}
