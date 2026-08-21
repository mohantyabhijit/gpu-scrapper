export class RequestBodyTooLargeError extends Error {}

export async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > maxBytes) {
      throw new RequestBodyTooLargeError("request body exceeds the allowed size");
    }
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new RequestBodyTooLargeError("request body exceeds the allowed size");
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
