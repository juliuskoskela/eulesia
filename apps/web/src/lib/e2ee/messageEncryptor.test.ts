import { describe, expect, it } from "vitest";
import type { SessionState } from "../crypto/index.ts";
import { selectOutboundSessionKey } from "./messageEncryptor.ts";

describe("selectOutboundSessionKey", () => {
  const session: SessionState = {
    conversationId: "conversation-1",
    deviceId: "remote-device",
    sendKey: "send-key",
    receiveKey: "receive-key",
    sendCounter: 3,
    receiveCounter: 1,
  };

  it("uses the receive key for local self-copies", () => {
    expect(
      selectOutboundSessionKey(session, "self-device", "self-device"),
    ).toBe("receive-key");
  });

  it("uses the send key for remote devices", () => {
    expect(
      selectOutboundSessionKey(session, "self-device", "remote-device"),
    ).toBe("send-key");
  });
});
