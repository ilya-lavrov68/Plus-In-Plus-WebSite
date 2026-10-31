import type { PayloadRequest } from "payload";

import { PAYLOAD_USERS_SLUG } from "./constants.ts";

/** REST и Admin доступны только после Auth.js staff strategy. */
export function hasPayloadAdmin(req: PayloadRequest): boolean {
  return req.user?.collection === PAYLOAD_USERS_SLUG;
}
