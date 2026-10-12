"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await onDelete(id);
      if (!result.ok) {
        setError(result.error ?? "Delete failed.");
        return;
      }
      setConfirmOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Delete failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={pending} aria-label={`Delete ${label}`}>
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        <span className="ml-2">{pending ? "Deleting…" : "Delete"}</span>
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this item?</DialogTitle>
            <DialogDescription>“{label}” will be permanently removed. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="button" onClick={handleDelete} disabled={pending} className="bg-[#052B42] text-white hover:bg-[#0A4366]">{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
