"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { AccountModalProps } from "@/components/site/account-modal";

const loadAccountModal = () =>
  import("@/components/site/account-modal").then((module) => module.AccountModal);

const AccountModal = dynamic(loadAccountModal, { ssr: false });

/** Desktop hover/focus может загрузить dialog до click; touch загружает его по открытию. */
export function preloadAccountModal() {
  void loadAccountModal();
}

export function LazyAccountModal(props: AccountModalProps) {
  const [hasOpened, setHasOpened] = useState(props.open);

  useEffect(() => {
    if (props.open) setHasOpened(true);
  }, [props.open]);

  if (!hasOpened && !props.open) return null;

  // После первого открытия component остаётся смонтированным, поэтому Radix
  // сохраняет обычный close transition и возврат focus к исходному trigger.
  return <AccountModal {...props} />;
}
