"use client";

import * as React from "react";

export type ToastVariant = "default" | "destructive";

export type ToastActionOption = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastActionOption;
};

export type ToastEntry = ToastOptions & {
  id: string;
  open: boolean;
};

/** Задержка перед удалением тоста из состояния, чтобы отыграла анимация закрытия. */
const TOAST_REMOVE_DELAY = 200;

let toastCount = 0;
let snapshot: ToastEntry[] = [];
const toasts: ToastEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = [...toasts];
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function addToast(options: ToastOptions) {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER;
  const id = `toast-${toastCount}`;

  toasts.push({ ...options, id, open: true });
  emit();

  return id;
}

function removeToast(id: string) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index === -1) return;

  toasts.splice(index, 1);
  emit();
}

function dismissToast(id?: string) {
  if (id) {
    const toast = toasts.find((item) => item.id === id);
    if (!toast || !toast.open) return;

    toast.open = false;
    emit();
    window.setTimeout(() => removeToast(id), TOAST_REMOVE_DELAY);
    return;
  }

  toasts.forEach((toast) => {
    if (toast.open) toast.open = false;
  });
  emit();

  const ids = toasts.map((toast) => toast.id);
  window.setTimeout(() => {
    ids.forEach(removeToast);
  }, TOAST_REMOVE_DELAY);
}

export function toast(options: ToastOptions) {
  return addToast(options);
}

toast.dismiss = dismissToast;

export function useToast() {
  const toasts = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  return { toasts, toast, dismiss: dismissToast };
}
