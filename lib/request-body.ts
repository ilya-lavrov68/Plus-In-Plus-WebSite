export type RequestBodyFailure = {
  ok: false;
  status: 400 | 413 | 415;
  error: string;
};

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | RequestBodyFailure;

function failure(status: RequestBodyFailure["status"], error: string): RequestBodyFailure {
  return { ok: false, status, error };
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads JSON with an actual streamed byte limit. Content-Length is only an early
 * rejection hint: chunked requests and false declarations are still capped while read.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Invalid JSON body limit.");
  }

  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return failure(415, "Content-Type must be application/json.");
  }

  const declaredHeader = request.headers.get("content-length");
  if (declaredHeader !== null) {
    if (!/^\d+$/.test(declaredHeader.trim())) return failure(400, "Invalid Content-Length header.");
    if (Number(declaredHeader) > maxBytes) return failure(413, "Request body is too large.");
  }

  if (!request.body) return failure(400, "Invalid JSON request body.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return failure(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return failure(400, "Invalid JSON request body.");
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return failure(400, "Invalid JSON request body.");
  }
}
