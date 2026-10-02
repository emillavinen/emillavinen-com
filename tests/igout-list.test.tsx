import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import UnfollowList from "@/app/admin/instagram/UnfollowList";

const cards = ["a", "b", "c"].map((u, i) => ({
  thread_id: String(i + 1),
  username: u,
  title: u.toUpperCase(),
  days_since_last_dm: 15.4,
  state: "unfollow_due",
}));

function mockFetch() {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
    new Response(JSON.stringify(init.method === "POST" ? { id: 42 } : { ok: true }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UnfollowList", () => {
  it("shows only as many cards as today's limit allows", () => {
    render(<UnfollowList cards={cards} remaining={2} />);
    expect(screen.getByText("@a")).toBeInTheDocument();
    expect(screen.getByText("@b")).toBeInTheDocument();
    expect(screen.queryByText("@c")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open profile/ }).map((a) => a.getAttribute("href"))).toEqual([
      "https://www.instagram.com/a/",
      "https://www.instagram.com/b/",
    ]);
  });

  it("Unfollowed hides the card and uses up the limit; Skip doesn't; Undo brings it back", async () => {
    const fetchMock = mockFetch();
    render(<UnfollowList cards={cards} remaining={2} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Unfollowed" })[0]);
    await waitFor(() => expect(screen.queryByText("@a")).not.toBeInTheDocument());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ thread_id: "1", status: "done" });
    // One unfollow left today: only b is shown, c still waits.
    expect(screen.getByText("@b")).toBeInTheDocument();
    expect(screen.queryByText("@c")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.getByText("@c")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByText("@b")).toBeInTheDocument());
    expect(fetchMock.mock.calls[2][1].method).toBe("DELETE");
  });

  it("shows an error and keeps the card when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Database error" }), { status: 500 })));
    render(<UnfollowList cards={cards} remaining={3} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Unfollowed" })[0]);
    await waitFor(() => expect(screen.getByText("Database error")).toBeInTheDocument());
    expect(screen.getByText("@a")).toBeInTheDocument();
  });
});
