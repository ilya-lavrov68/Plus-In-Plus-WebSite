import { createHmac } from "node:crypto";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const EMAIL_TEST = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const IPV4_TEST = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

function pseudonym(kind: string, value: string, key: string): string {
  return `${kind}_${createHmac("sha256", key).update(`${kind}:${value}`).digest("hex").slice(0, 32)}`;
}

/** Keeps event/action/entity context while replacing direct actor and contact identifiers. */
export function pseudonymizeActivityRecord(
  record: { actorId: string | null; actorPseudonym: string | null; title: string },
  key: string,
): { actorId: null; actorPseudonym: string | null; title: string; changed: boolean } {
  const actorPseudonym = record.actorId
    ? pseudonym("actor", record.actorId, key)
    : record.actorPseudonym;
  let title = record.title.replace(EMAIL, (value) => pseudonym("contact", value.toLowerCase(), key));
  title = title.replace(IPV4, (value) => pseudonym("network", value, key));
  return {
    actorId: null,
    actorPseudonym,
    title,
    changed: record.actorId !== null || actorPseudonym !== record.actorPseudonym || title !== record.title,
  };
}

export function looksLikeContactOrNetworkText(value: string): boolean {
  return EMAIL_TEST.test(value) || IPV4_TEST.test(value);
}
