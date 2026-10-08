// search-indexer: published events are upserted, drafts and deletes are removed, a failure is reported
// for exactly the failing record (partial batch response).
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({
  indices: { exists: vi.fn(async () => ({ body: true })), create: vi.fn() },
  index: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
}));
vi.mock("../shared/opensearch", () => ({ createSearchClient: () => search }));
const { handler } = await import("./handler");

const record = (seq: string, newImage?: Record<string, unknown>) => ({
  dynamodb: { SequenceNumber: seq, Keys: { eventId: { S: "evt-1" } }, NewImage: newImage },
});
const image = (status: string) => ({ eventId: { S: "evt-1" }, name: { S: "Jazz" }, status: { S: status } });

beforeEach(() => vi.clearAllMocks());

describe("search-indexer", () => {
  it("indexes a published event and deletes a draft", async () => {
    const result = await handler({
      Records: [record("1", image("PUBLISHED")), record("2", image("DRAFT"))],
    } as never);
    expect(search.index).toHaveBeenCalledWith(expect.objectContaining({ index: "events", id: "evt-1" }));
    expect(search.delete).toHaveBeenCalledWith({ index: "events", id: "evt-1" });
    expect(result.batchItemFailures).toEqual([]);
  });

  it("deletes the document when the item was removed from DynamoDB", async () => {
    await handler({ Records: [record("3")] } as never);
    expect(search.delete).toHaveBeenCalled();
  });

  it("reports the first failing record so Lambda retries from there", async () => {
    search.index.mockRejectedValueOnce(new Error("cluster red"));
    const result = await handler({
      Records: [record("4", image("PUBLISHED")), record("5", image("PUBLISHED"))],
    } as never);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "4" }]);
  });
});
