import type { ComponentProps } from "react";
import type { DndContext as DndContextType } from "@dnd-kit/core";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render";
import type { Deal } from "../api";
import { boardTotals } from "../lib/deals";
import type { Stage } from "../lib/stages";
import { Board } from "./Board";

// dnd-kit needs real layout to drag, which jsdom doesn't have. The board's own
// handlers are what decide where a card lands, so the tests call them as
// dnd-kit would, through the props the board gives its DndContext.
const dnd = vi.hoisted(() => ({ props: null as ComponentProps<typeof DndContextType> | null }));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: (props: ComponentProps<typeof DndContextType>) => {
      dnd.props = props;
      return <actual.DndContext {...props} />;
    },
  };
});

const TODAY = new Date(2026, 10, 20);

function deal(id: number, name: string, stage: Stage): Deal {
  return {
    id,
    name,
    organization: { id: 1, name: "Atlas Freight" },
    main_contact: { id: 1, name: "Dana Ortiz" },
    stage,
    value: 100_000,
    probability: 50,
    close_date: "2027-01-31",
    furthest_stage: stage,
    position: id,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
  };
}

const DEALS = [
  deal(1, "Atlas renewal", "new"),
  deal(2, "Steel supply", "proposal"),
  deal(3, "Imaging lease", "proposal"),
  deal(4, "Furnace relining", "won"),
];

type OnMove = ComponentProps<typeof Board>["onMove"];
let onMove: Mock<OnMove>;

function show(sent = true) {
  onMove = vi.fn<OnMove>(() => sent);
  renderWithProviders(
    <Board
      deals={DEALS}
      totals={boardTotals(DEALS, TODAY)}
      today={TODAY}
      onAdd={() => {}}
      onMove={onMove}
    />,
  );
}

function cardsIn(stage: string) {
  return within(screen.getByRole("list", { name: `${stage} deals` }))
    .queryAllByRole("listitem")
    .map((item) => DEALS.find((d) => item.textContent?.includes(d.name))?.name);
}

type Over = { id: string | number; rect: { top: number; height: number } };
const over = (id: string | number): Over => ({ id, rect: { top: 0, height: 100 } });
const active = (id: number, top = 0) => ({ id, rect: { current: { translated: { top } } } });

function drag(event: "onDragStart" | "onDragOver" | "onDragEnd", payload: object) {
  const handler = dnd.props?.[event] as ((e: unknown) => void) | undefined;
  act(() => handler?.(payload));
}

beforeEach(() => {
  dnd.props = null;
});

describe("Board", () => {
  it("shows each deal in its stage's column", () => {
    show();
    expect(cardsIn("New")).toEqual(["Atlas renewal"]);
    expect(cardsIn("Proposal")).toEqual(["Steel supply", "Imaging lease"]);
    expect(cardsIn("Won")).toEqual(["Furnace relining"]);
  });

  it("opens a gap where a dragged card will land, then moves it", () => {
    show();
    drag("onDragStart", { active: active(1) });
    drag("onDragOver", { active: active(1, 80), over: over(2) });
    expect(cardsIn("Proposal")).toEqual(["Steel supply", "Atlas renewal", "Imaging lease"]);
    expect(cardsIn("New")).toEqual([]);
    drag("onDragEnd", { active: active(1), over: over(1) });
    expect(onMove).toHaveBeenCalledWith(DEALS[0], "proposal", 3, expect.any(Object));
    expect(cardsIn("New")).toEqual(["Atlas renewal"]);
  });

  it("puts a card above the one it's over, or at the end of an empty column", () => {
    show();
    drag("onDragStart", { active: active(1) });
    drag("onDragOver", { active: active(1, 0), over: over(3) });
    expect(cardsIn("Proposal")).toEqual(["Steel supply", "Atlas renewal", "Imaging lease"]);
    drag("onDragOver", { active: active(1), over: over("column:negotiation") });
    expect(cardsIn("Negotiation")).toEqual(["Atlas renewal"]);
    drag("onDragOver", { active: active(1), over: over("column:negotiation") });
    drag("onDragEnd", { active: active(1), over: over("column:negotiation") });
    expect(onMove).toHaveBeenCalledWith(DEALS[0], "negotiation", null, expect.any(Object));
  });

  it("reorders within a column", () => {
    show();
    drag("onDragStart", { active: active(2) });
    drag("onDragEnd", { active: active(2), over: over(3) });
    expect(onMove).toHaveBeenCalledWith(DEALS[1], "proposal", null, expect.any(Object));
  });

  it("places a card dropped before the move was drawn", () => {
    show();
    drag("onDragStart", { active: active(1) });
    drag("onDragEnd", { active: active(1), over: over(3) });
    expect(onMove).toHaveBeenCalledWith(DEALS[0], "proposal", 3, expect.any(Object));
    drag("onDragStart", { active: active(1) });
    drag("onDragEnd", { active: active(1), over: over("column:won") });
    expect(onMove).toHaveBeenLastCalledWith(DEALS[0], "won", null, expect.any(Object));
  });

  it("does nothing when a card is dropped where it was, or nowhere", () => {
    show();
    drag("onDragStart", { active: active(2) });
    drag("onDragEnd", { active: active(2), over: over(2) });
    drag("onDragStart", { active: active(2) });
    drag("onDragOver", { active: active(2), over: null });
    drag("onDragEnd", { active: active(2), over: null });
    drag("onDragEnd", { active: active(99), over: over(2) });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("keeps a card where it was dropped while the reopen dialog asks", () => {
    show(false);
    drag("onDragStart", { active: active(4) });
    drag("onDragEnd", { active: active(4), over: over("column:new") });
    expect(cardsIn("New")).toEqual(["Atlas renewal", "Furnace relining"]);
    const options = onMove.mock.calls[0][3] as { onDialogClose: () => void };
    act(() => options.onDialogClose());
    expect(cardsIn("Won")).toEqual(["Furnace relining"]);
  });

  it("puts the card back when a drag is cancelled", () => {
    show();
    drag("onDragStart", { active: active(1) });
    drag("onDragOver", { active: active(1), over: over("column:won") });
    act(() => dnd.props?.onDragCancel?.({ active: active(1) } as never));
    expect(cardsIn("New")).toEqual(["Atlas renewal"]);
  });

  it("announces a drag in words", () => {
    show();
    const say = dnd.props?.accessibility?.announcements;
    const event = (overId: string | number | null) =>
      ({ active: { id: 1 }, over: overId === null ? null : { id: overId } }) as never;
    expect(say?.onDragStart(event(null))).toBe("Picked up Atlas renewal.");
    expect(say?.onDragOver(event("column:won"))).toBe("Atlas renewal is over Won.");
    expect(say?.onDragOver(event(null))).toBe("Atlas renewal is no longer over a column.");
    expect(say?.onDragEnd(event(3))).toBe("Dropped Atlas renewal in Proposal.");
    expect(say?.onDragEnd(event(null))).toBe("Dropped Atlas renewal.");
    expect(say?.onDragCancel({ active: { id: 99 }, over: null } as never)).toBe(
      "Stopped dragging the deal. It's back where it was.",
    );
  });

  it("goes by what's under the pointer, and keeps the last target between columns", () => {
    show();
    const detect = dnd.props?.collisionDetection;
    const rect = { top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10 };
    const base = {
      active: { id: 1 },
      collisionRect: rect,
      droppableRects: new Map([["column:won", rect]]),
      droppableContainers: [{ id: "column:won" }],
    } as never;
    expect(detect?.({ ...(base as object), pointerCoordinates: null } as never)).toEqual(
      expect.any(Array),
    );
    expect(
      detect?.({ ...(base as object), pointerCoordinates: { x: 5, y: 5 } } as never)?.[0]?.id,
    ).toBe("column:won");
    expect(detect?.({ ...(base as object), pointerCoordinates: null } as never)).toEqual([
      { id: "column:won" },
    ]);
  });

  it("moves a card to the top of a column from its stage menu", async () => {
    const user = userEvent.setup();
    show();
    await user.click(
      screen.getByRole("button", { name: "Stage: New. Change stage of Atlas renewal" }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: "Proposal" }));
    expect(onMove).toHaveBeenCalledWith(DEALS[0], "proposal", 2, expect.any(Object));
  });

  it("keeps focus on a card waiting for the reopen dialog", async () => {
    const user = userEvent.setup();
    show(false);
    await user.click(
      screen.getByRole("button", { name: "Stage: Won. Change stage of Furnace relining" }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: "New" }));
    const options = onMove.mock.calls[0][3] as { refocus: () => void };
    act(() => options.refocus());
    expect(onMove).toHaveBeenCalledWith(DEALS[3], "new", 1, expect.any(Object));
  });
});
