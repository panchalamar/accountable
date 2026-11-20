import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import { DoneCheckbox } from "./DoneCheckbox";

describe("DoneCheckbox", () => {
  it("saves at once when ticked", async () => {
    const calls = mockApi({ "PATCH /activities/7": { id: 7, done: true } });
    const onChange = vi.fn();
    renderWithProviders(
      <DoneCheckbox id={7} done={false} description="Call Priya" onChange={onChange} />,
    );
    const box = screen.getByRole("checkbox", { name: "Done: Call Priya" });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "PATCH",
        path: "/activities/7",
        body: { done: true },
      }),
    );
  });

  it("says why when the save fails", async () => {
    mockApi({
      "PATCH /activities/7": { status: 422, body: { message: "That follow-up is gone." } },
    });
    const onError = vi.fn();
    renderWithProviders(
      <>
        <DoneCheckbox id={7} done description="Call Priya" onDark onError={onError} />
        <Toaster />
      </>,
    );
    const box = screen.getByRole("checkbox", { name: "Done: Call Priya" });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(await screen.findByText("That follow-up is gone.")).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });
});

describe("DoneCheckbox, while saving", () => {
  it("ignores a second click until the first save is back", async () => {
    let finish: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<DoneCheckbox id={7} done={false} description="Call Priya" />);
    const box = screen.getByRole("checkbox", { name: "Done: Call Priya" });
    await userEvent.click(box);
    await waitFor(() => expect(box).toHaveAttribute("aria-busy", "true"));
    await userEvent.click(box);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(new Response(JSON.stringify({ id: 7, done: true }), { status: 200 }));
    await waitFor(() => expect(box).not.toHaveAttribute("aria-busy"));
  });
});
