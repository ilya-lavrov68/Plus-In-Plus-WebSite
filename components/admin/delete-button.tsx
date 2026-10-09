"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface DeleteButtonProps {
  label: string;
  id: string;
  /** Server action (passed as a reference) returning `{ ok: boolean; error?: string }`. */
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
  redirectTo?: string;
}

export function DeleteButton({ label, id, onDelete, redirectTo }: DeleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await onDelete(id);
      if (!result.ok) {
        setError(result.error ?? "Delete failed.");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      setError("Delete failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        aria-label={`Delete ${label}`}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        <span className="ml-2">{pending ? "Deleting…" : "Delete"}</span>
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
