import { headers } from "next/headers";

export type RequestLocale = "en" | "ru";

/** Safe in server requests and in isolated component tests without a request store. */
export async function getRequestLocale(): Promise<RequestLocale> {
  try {
    return (await headers()).get("x-pip-locale") === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
}
