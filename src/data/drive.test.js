import { describe, it, expect, beforeEach, vi } from "vitest";

import { listDrivePhotos, getDrivePhotos } from "./drive.js";

/*
  PLAN.md §R9: item 2 (list via the proxy), item 3 (cache so rotation never
  blanks), item 5 (month art is the fallback for an empty or unreachable
  folder — which for this module means resolving `[]`, since Screensaver's
  own `hasPhoto` check is what turns that into the month-art branch).
*/

function mockFetchOnce(json, { ok = true, status = 200 } = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status, json: async () => json }));
}

beforeEach(() => {
  localStorage.clear();
});

describe("listDrivePhotos", () => {
  it("maps a file list into proxied photo URLs", async () => {
    mockFetchOnce({
      ok: true,
      files: [
        { id: "abc", name: "one.jpg" },
        { id: "def", name: "two.jpg" },
      ],
    });

    const photos = await listDrivePhotos("folder-1");

    expect(photos).toHaveLength(2);
    for (const url of photos) {
      expect(url).toMatch(/\/drive\/photo\?/);
    }
    expect(photos[0]).toContain("id=abc");
    expect(photos[1]).toContain("id=def");
  });

  it("throws on a non-ok response so getDrivePhotos is the only thing that degrades", async () => {
    mockFetchOnce({}, { ok: false, status: 401 });
    await expect(listDrivePhotos("folder-1")).rejects.toThrow();
  });

  it("resolves an empty list for an empty folder without throwing", async () => {
    mockFetchOnce({ ok: true, files: [] });
    expect(await listDrivePhotos("folder-1")).toEqual([]);
  });
});

describe("getDrivePhotos", () => {
  it("resolves an empty array when no folder is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await getDrivePhotos("")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches a successful list and serves it after a later failure for the same folder", async () => {
    mockFetchOnce({ ok: true, files: [{ id: "abc", name: "one.jpg" }] });
    const first = await getDrivePhotos("folder-1");
    expect(first).toHaveLength(1);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const second = await getDrivePhotos("folder-1");
    expect(second).toEqual(first);
  });

  it("does not leak a cached list across a folder id change on failure", async () => {
    mockFetchOnce({ ok: true, files: [{ id: "abc", name: "one.jpg" }] });
    await getDrivePhotos("folder-1");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await getDrivePhotos("folder-2");
    expect(result).toEqual([]);
  });

  it("resolves an empty array on failure when nothing has ever been cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await getDrivePhotos("folder-1")).toEqual([]);
  });

  it("caches and returns an empty list for a folder that is reachable but empty", async () => {
    mockFetchOnce({ ok: true, files: [] });
    expect(await getDrivePhotos("folder-1")).toEqual([]);
  });
});
