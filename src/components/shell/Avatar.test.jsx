import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { Avatar } from "./Avatar.jsx";

const member = { id: "a", name: "Alice", color: "#7EB6E8" };

function mockFetchOnce(json, { ok = true, status = 200 } = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status, json: async () => json }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

/*
  `<img alt="">` carries ARIA role "presentation", not "img" — queries below
  go through the container rather than getByRole for that reason.
*/
function avImg(container) {
  return container.querySelector(".fb-avimg");
}

describe("Avatar", () => {
  it("renders initials when there is no photo and no Drive folder", () => {
    const { container } = render(
      <Avatar member={{ ...member, photo: "", photoDriveFolderId: "" }} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(avImg(container)).toBeNull();
  });

  it("renders member.photo when set and no Drive folder is configured", () => {
    const { container } = render(
      <Avatar
        member={{ ...member, photo: "https://example.test/a.jpg", photoDriveFolderId: "" }}
      />,
    );
    expect(avImg(container)).toHaveAttribute("src", "https://example.test/a.jpg");
  });

  it("renders the Drive-resolved image once it resolves, over a plain photo URL", async () => {
    mockFetchOnce({ ok: true, files: [{ id: "abc", name: "one.jpg" }] });
    const { container } = render(
      <Avatar
        member={{
          ...member,
          photo: "https://example.test/fallback.jpg",
          photoDriveFolderId: "avatar-test-folder-1",
        }}
      />,
    );
    await waitFor(() =>
      expect(avImg(container).getAttribute("src")).toMatch(/\/drive\/photo\?.*id=abc/),
    );
  });

  it("falls back to member.photo when the Drive folder resolves no image", async () => {
    mockFetchOnce({ ok: true, files: [] });
    const { container } = render(
      <Avatar
        member={{
          ...member,
          photo: "https://example.test/fallback.jpg",
          photoDriveFolderId: "avatar-test-folder-2",
        }}
      />,
    );
    await waitFor(() =>
      expect(avImg(container)).toHaveAttribute("src", "https://example.test/fallback.jpg"),
    );
  });

  it("falls back to initials when the Drive folder resolves no image and there is no plain photo either", async () => {
    mockFetchOnce({ ok: true, files: [] });
    const { container } = render(
      <Avatar member={{ ...member, photo: "", photoDriveFolderId: "avatar-test-folder-3" }} />,
    );
    await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument());
    expect(avImg(container)).toBeNull();
  });
});
