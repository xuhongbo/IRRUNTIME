import React, { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import type { Graph } from "../../engine/ir";
import { sampleGraph } from "../../mock/graph";
import type { Command } from "../commands";
import { acceptMessage, createSourceId, useGraphSync } from "../sync";

const graph = sampleGraph as Graph;

describe("createSourceId", () => {
  it("returns a non-empty id", () => {
    const id = createSourceId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("uses crypto.randomUUID when available", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => "test-uuid" },
      configurable: true,
    });
    const id = createSourceId();
    expect(id).toBe("test-uuid");
    Object.defineProperty(globalThis, "crypto", {
      value: original,
      configurable: true,
    });
  });

  it("falls back when crypto is unavailable", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    const id = createSourceId();
    expect(id.startsWith("source-")).toBe(true);
    Object.defineProperty(globalThis, "crypto", {
      value: original,
      configurable: true,
    });
  });
});

describe("acceptMessage", () => {
  it("filters duplicate or self messages", () => {
    const map = new Map<string, number>();
    const message = { type: "command", sourceId: "remote", seq: 1, command: { type: "DISCONNECT", edgeId: "edge-1" } as Command };
    expect(acceptMessage("self", map, message)).toBe(true);
    expect(acceptMessage("self", map, message)).toBe(false);
    expect(acceptMessage("remote", map, message)).toBe(false);
  });

  it("rejects older sequence values", () => {
    const map = new Map<string, number>([["remote", 3]]);
    const message = { type: "command", sourceId: "remote", seq: 2, command: { type: "DISCONNECT", edgeId: "edge-1" } as Command };
    expect(acceptMessage("self", map, message)).toBe(false);
  });
});

describe("useGraphSync", () => {
  const originalChannel = globalThis.BroadcastChannel;

  class MockChannel {
    static instances: MockChannel[] = [];
    name: string;
    listeners: ((event: MessageEvent) => void)[] = [];
    constructor(name: string) {
      this.name = name;
      MockChannel.instances.push(this);
    }
    postMessage(data: unknown) {
      for (const instance of MockChannel.instances) {
        if (instance.name !== this.name) continue;
        instance.listeners.forEach((listener) => listener({ data } as MessageEvent));
      }
    }
    addEventListener(_type: string, listener: (event: MessageEvent) => void) {
      this.listeners.push(listener);
    }
    removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
      this.listeners = this.listeners.filter((item) => item !== listener);
    }
    close() {
      return;
    }
  }

  beforeAll(() => {
    Object.defineProperty(globalThis, "BroadcastChannel", {
      value: MockChannel,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, "BroadcastChannel", {
      value: originalChannel,
      configurable: true,
    });
  });

  it("broadcasts commands and snapshots across channels", async () => {
    const mainCommands: Command[] = [];
    const canvasGraphs: Graph[] = [];

    const Wrapper = () => {
      const main = useGraphSync({
        graph,
        mode: "main",
        onApplyGraph: () => null,
        onApplyCommand: (command) => mainCommands.push(command),
      });
      const canvas = useGraphSync({
        graph,
        mode: "canvas",
        onApplyGraph: (next) => canvasGraphs.push(next),
        onApplyCommand: () => null,
      });

      useEffect(() => {
        canvas.sendCommand({ type: "DISCONNECT", edgeId: "edge-1" });
        canvas.requestSnapshot();
      }, [canvas]);

      useEffect(() => {
        main.sendSnapshot(graph);
      }, [main]);

      return null;
    };

    render(<Wrapper />);

    await waitFor(() => {
      expect(mainCommands.length).toBe(1);
      expect(canvasGraphs.length).toBeGreaterThan(0);
    });
  });

  it("skips setup when disabled", async () => {
    const commands: Command[] = [];
    const Wrapper = () => {
      const sync = useGraphSync({
        graph,
        mode: "main",
        enabled: false,
        onApplyGraph: () => null,
        onApplyCommand: (command) => commands.push(command),
      });
      useEffect(() => {
        sync.sendCommand({ type: "DISCONNECT", edgeId: "edge-2" });
      }, [sync]);
      return null;
    };
    render(<Wrapper />);
    await waitFor(() => {
      expect(commands.length).toBe(0);
    });
  });
});
