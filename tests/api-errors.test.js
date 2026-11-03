import assert from "node:assert/strict";
import { test } from "node:test";
import { getApiErrorDetails, normalizeAxiosError } from "../src/api/errors.js";

test("central API error details prefer backend envelope", () => {
  const details = getApiErrorDetails({
    response: {
      status: 409,
      data: {
        code: "DUPLICATE_BASKET",
        message: "Ижил нэртэй багц байна",
        requestId: "request-123",
      },
    },
  });
  assert.deepEqual(details, {
    status: 409,
    code: "DUPLICATE_BASKET",
    message: "Ижил нэртэй багц байна",
    requestId: "request-123",
  });
});

test("legacy API errors are normalized without losing compatibility", async () => {
  const error = { response: { status: 400, data: { error: "Legacy message" }, headers: { "x-request-id": "header-id" } } };
  await assert.rejects(normalizeAxiosError(error), (normalized) => {
    assert.equal(normalized.response.data.error, "Legacy message");
    assert.equal(normalized.response.data.message, "Legacy message");
    assert.equal(normalized.response.data.code, "HTTP_400");
    assert.equal(normalized.requestId, "header-id");
    return true;
  });
});

test("network errors receive a safe fallback", () => {
  const details = getApiErrorDetails(new Error("Network Error"));
  assert.equal(details.code, "NETWORK_ERROR");
  assert.equal(details.message, "Үйлдлийг гүйцэтгэж чадсангүй");
});
