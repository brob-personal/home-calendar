import { describe, it, expect, beforeEach, vi } from "vitest";

import { listDrivePhotos, getDrivePhotos, getFirstDrivePhotoUrl, sizedThumbnail } from "./drive.js";
import { store } from "../lib/store.js";

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

describe("getFirstDrivePhotoUrl", () => {
  it("resolves null without fetching when no folder id is given", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await getFirstDrivePhotoUrl("")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves the alphabetically-first file's photo URL, not the API's own order", async () => {
    mockFetchOnce({
      ok: true,
      files: [
        { id: "zzz", name: "zebra.jpg" },
        { id: "aaa", name: "apple.jpg" },
        { id: "mmm", name: "mango.jpg" },
      ],
    });

    const url = await getFirstDrivePhotoUrl("avatar-folder-alpha");

    expect(url).toMatch(/\/drive\/photo\?/);
    expect(url).toContain("id=aaa");
  });

  it("resolves null for a folder with no image files", async () => {
    mockFetchOnce({ ok: true, files: [] });
    expect(await getFirstDrivePhotoUrl("avatar-folder-empty")).toBeNull();
  });

  it("resolves null, rather than throwing, when the list call fails", async () => {
    mockFetchOnce({}, { ok: false, status: 401 });
    expect(await getFirstDrivePhotoUrl("avatar-folder-fail")).toBeNull();
  });

  it("caches a resolved URL per folder id instead of re-fetching", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, files: [{ id: "abc", name: "one.jpg" }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const first = await getFirstDrivePhotoUrl("avatar-folder-cache");
    const second = await getFirstDrivePhotoUrl("avatar-folder-cache");

    expect(first).toBe(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("uses a small thumbnail rendition, not a screensaver-sized one", async () => {
    mockFetchOnce({
      ok: true,
      files: [
        {
          id: "aaa",
          name: "apple.heic",
          mimeType: "image/heic",
          thumbnailLink: "https://lh3.googleusercontent.com/drive-storage/AAA=s220",
        },
      ],
    });

    expect(await getFirstDrivePhotoUrl("avatar-folder-heic")).toBe(
      "https://lh3.googleusercontent.com/drive-storage/AAA=s128",
    );
  });
});

/*
  The HEIC fix. Screensaver paints photos into a CSS `background-image`, and a
  Chromium kiosk cannot decode `image/heic` — so streaming a file's original
  bytes through api/drive/photo.js showed a blank frame for every photo the
  iPad itself had taken. Drive's thumbnailLink is a JPEG rendition of anything
  Drive can preview, which is what these cover.
*/
describe("sizedThumbnail", () => {
  it("replaces the default =s220 suffix rather than appending to it", () => {
    expect(sizedThumbnail("https://lh3.googleusercontent.com/drive-storage/XYZ=s220")).toBe(
      "https://lh3.googleusercontent.com/drive-storage/XYZ=s1920",
    );
  });

  it("replaces a cropped or width/height option segment wholesale", () => {
    expect(sizedThumbnail("https://lh3.googleusercontent.com/d/XYZ=s220-c")).toBe(
      "https://lh3.googleusercontent.com/d/XYZ=s1920",
    );
    expect(sizedThumbnail("https://lh3.googleusercontent.com/d/XYZ=w220-h165")).toBe(
      "https://lh3.googleusercontent.com/d/XYZ=s1920",
    );
  });

  it("rewrites the legacy sz query parameter in place", () => {
    const out = sizedThumbnail("https://docs.google.com/feeds/vt?gd=true&id=XYZ&sz=s220");
    expect(out).toContain("sz=s1920");
    expect(out).not.toContain("s220");
    expect(out).toContain("id=XYZ");
  });

  it("appends a size when Drive returns a link carrying none", () => {
    expect(sizedThumbnail("https://lh3.googleusercontent.com/drive-storage/XYZ")).toBe(
      "https://lh3.googleusercontent.com/drive-storage/XYZ=s1920",
    );
  });

  it("honours an explicit size for the avatar path", () => {
    expect(sizedThumbnail("https://lh3.googleusercontent.com/d/XYZ=s220", 128)).toBe(
      "https://lh3.googleusercontent.com/d/XYZ=s128",
    );
  });

  it("resolves an empty string for a missing link instead of throwing", () => {
    expect(sizedThumbnail(undefined)).toBe("");
    expect(sizedThumbnail("")).toBe("");
  });
});

describe("listDrivePhotos — HEIC via thumbnailLink", () => {
  it("prefers an upsized thumbnailLink over the byte proxy", async () => {
    mockFetchOnce({
      ok: true,
      files: [
        {
          id: "abc",
          name: "sunset.heic",
          mimeType: "image/heic",
          thumbnailLink: "https://lh3.googleusercontent.com/drive-storage/ABC=s220",
        },
      ],
    });

    expect(await listDrivePhotos("folder-1")).toEqual([
      "https://lh3.googleusercontent.com/drive-storage/ABC=s1920",
    ]);
  });

  it("falls back to the byte proxy for a file with no thumbnail yet", async () => {
    mockFetchOnce({
      ok: true,
      files: [
        { id: "no-thumb", name: "fresh.jpg", mimeType: "image/jpeg" },
        {
          id: "has-thumb",
          name: "old.heif",
          mimeType: "image/heif",
          thumbnailLink: "https://lh3.googleusercontent.com/drive-storage/HT=s220",
        },
      ],
    });

    const photos = await listDrivePhotos("folder-1");

    expect(photos[0]).toMatch(/\/drive\/photo\?/);
    expect(photos[0]).toContain("id=no-thumb");
    expect(photos[1]).toBe("https://lh3.googleusercontent.com/drive-storage/HT=s1920");
  });
});

/*
  thumbnailLink URLs are signed and time-limited, so the degrade cache that
  exists to keep a network blip from blanking the screensaver must not outlive
  their validity. Past the TTL it resolves `[]`, which Screensaver's `hasPhoto`
  branch renders as month art — a deliberate fallback rather than a grid of
  broken images.
*/
describe("getDrivePhotos — signed URLs do not outlive their cache", () => {
  const thumbFile = {
    id: "abc",
    name: "one.heic",
    mimeType: "image/heic",
    thumbnailLink: "https://lh3.googleusercontent.com/drive-storage/ABC=s220",
  };

  it("still serves a cached list through a blip inside the TTL", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      mockFetchOnce({ ok: true, files: [thumbFile] });
      const first = await getDrivePhotos("folder-1");
      expect(first).toHaveLength(1);

      vi.setSystemTime(new Date("2026-01-01T00:30:00Z"));
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      expect(await getDrivePhotos("folder-1")).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a cached list once its signed URLs have aged past the TTL", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      mockFetchOnce({ ok: true, files: [thumbFile] });
      expect(await getDrivePhotos("folder-1")).toHaveLength(1);

      vi.setSystemTime(new Date("2026-01-01T00:46:00Z"));
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      expect(await getDrivePhotos("folder-1")).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a cache entry written before the TTL existed as stale", async () => {
    await store.set("drivePhotoCache", {
      folderId: "folder-1",
      photos: ["https://lh3.googleusercontent.com/drive-storage/OLD=s1920"],
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await getDrivePhotos("folder-1")).toEqual([]);
  });
});
