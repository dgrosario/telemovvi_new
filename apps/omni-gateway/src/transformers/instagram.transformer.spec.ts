import { InstagramTransformer } from "./instagram.transformer";

declare const describe: (name: string, fn: () => void | Promise<void>) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: {
  (value: unknown): {
    toEqual(expected: unknown): void;
  };
  objectContaining(value: Record<string, unknown>): unknown;
};
declare const jest: {
  fn(): (...args: unknown[]) => unknown;
};

describe("InstagramTransformer reactions", () => {
  it("maps Meta Instagram message_reactions payloads to a dedicated reaction event", async () => {
    const transformer = new InstagramTransformer({
      getConnection: jest.fn(),
    } as any);

    const result = await transformer.transformMessagesUpsert({
      object: "instagram",
      entry: [
        {
          id: "IGID",
          time: 1569262486134,
          messaging: [
            {
              sender: { id: "IGSID" },
              recipient: { id: "IGID" },
              timestamp: 1569262485349,
              reaction: {
                mid: "MESSAGE-ID",
                action: "react",
                reaction: "love",
                emoji: "\u2764\uFE0F",
              },
            },
          ],
        },
      ],
    } as any);

    expect(result).toEqual([
      {
        event: "messages.reaction",
        instance: "IGID",
        source: "instagram",
        data: {
          targetMessageId: "MESSAGE-ID",
          reactorInstagramScopedId: "IGSID",
          recipientInstagramAccountId: "IGID",
          action: "react",
          reaction: "love",
          emoji: "\u2764\uFE0F",
          timestamp: 1569262485349,
        },
      },
    ]);
  });

  it("keeps unreact payloads even when Meta omits emoji and textual reaction", async () => {
    const transformer = new InstagramTransformer({
      getConnection: jest.fn(),
    } as any);

    const result = await transformer.transformMessagesUpsert({
      object: "instagram",
      entry: [
        {
          id: "IGID",
          time: 1569262486134,
          messaging: [
            {
              sender: { id: "IGSID" },
              recipient: { id: "IGID" },
              timestamp: 1569262485349,
              reaction: {
                mid: "MESSAGE-ID",
                action: "unreact",
              },
            },
          ],
        },
      ],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        event: "messages.reaction",
        data: expect.objectContaining({
          targetMessageId: "MESSAGE-ID",
          action: "unreact",
          emoji: null,
          reaction: null,
        }),
      }),
    ]);
  });
});
