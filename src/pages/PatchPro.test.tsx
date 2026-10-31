import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import PatchPro from "./PatchPro";

// Sends a message as if it came from the designer inside the frame, and collects what the screen sends back.
function setup() {
  const { container } = render(
    <MemoryRouter>
      <PatchPro />
    </MemoryRouter>,
  );
  const frame = container.querySelector("iframe")!;
  const win = frame.contentWindow!;
  const replies: unknown[] = [];
  vi.spyOn(win, "postMessage").mockImplementation((msg: unknown) => {
    replies.push(msg);
  });
  const send = (data: unknown, source: unknown = win) =>
    window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin, source: source as Window }));
  return { frame, replies, send };
}

describe("PatchPro screen", () => {
  beforeEach(() => invoke.mockReset());

  it("opens the designer full screen", () => {
    const { frame } = setup();
    expect(frame.getAttribute("src")).toBe("/patch-pro/index.html");
  });

  it("answers hello so the designer shows the SanMar hat search", () => {
    const { replies, send } = setup();
    send({ type: "pp:hello" });
    expect(replies).toContainEqual({ type: "smp:ready" });
  });

  it("looks up a SanMar style and returns one photo per color", async () => {
    invoke.mockResolvedValue({
      data: { items: [{ color: "Navy", frontFlat: "https://cdnm.sanmar.com/n.jpg" }, { color: "Navy", frontFlat: "https://cdnm.sanmar.com/n2.jpg" }] },
      error: null,
    });
    const { replies, send } = setup();
    send({ type: "pp:call", id: 7, op: "sanmarColors", args: { style: "c112" } });
    await waitFor(() => expect(replies.length).toBe(1));
    expect(invoke).toHaveBeenCalledWith("sanmar-api", { body: { action: "getProductInfo", styleNumber: "C112" } });
    expect(replies[0]).toEqual({ type: "smp:reply", id: 7, result: [{ color: "Navy", image: "https://cdnm.sanmar.com/n.jpg", swatch: "" }] });
  });

  it("passes SanMar's error message back to the designer", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Edge Function returned a non-2xx status code") });
    const { replies, send } = setup();
    send({ type: "pp:call", id: 3, op: "sanmarImage", args: { url: "https://cdnm.sanmar.com/x.jpg" } });
    await waitFor(() => expect(replies.length).toBe(1));
    expect(replies[0]).toMatchObject({ type: "smp:reply", id: 3, error: "Edge Function returned a non-2xx status code" });
  });

  it("offers a direct bridge the same-site designer can call", async () => {
    invoke.mockResolvedValue({ data: { items: [{ color: "Black", frontFlat: "https://cdnm.sanmar.com/b.jpg" }] }, error: null });
    const { unmount } = render(
      <MemoryRouter>
        <PatchPro />
      </MemoryRouter>,
    );
    const bridge = (window as unknown as { __patchPro?: { call: (op: string, args?: object) => Promise<unknown> } }).__patchPro;
    expect(bridge).toBeTruthy();
    await expect(bridge!.call("sanmarColors", { style: "112" })).resolves.toEqual([{ color: "Black", image: "https://cdnm.sanmar.com/b.jpg", swatch: "" }]);
    await expect(bridge!.call("sanmarImage", { url: "x" })).rejects.toThrow();
    unmount();
    expect((window as unknown as { __patchPro?: unknown }).__patchPro).toBeUndefined();
  });

  it("ignores messages that don't come from the designer", () => {
    const { replies, send } = setup();
    send({ type: "pp:hello" }, window);
    expect(replies).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });
});
