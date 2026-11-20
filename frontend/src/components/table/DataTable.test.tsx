import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DataTable, type TableColumn } from "./DataTable";

type Person = { id: number; name: string; organization: string; value: number };

const people: Person[] = Array.from({ length: 36 }, (_, i) => ({
  id: i + 1,
  name: `Person ${String(i + 1).padStart(2, "0")}`,
  organization: i % 3 === 0 ? "Northwind Metals" : "Atlas Freight",
  value: (i + 1) * 1000,
}));

const columns: TableColumn<Person>[] = [
  { id: "name", header: "Name", text: (p) => p.name },
  { id: "organization", header: "Organization", text: (p) => p.organization },
  {
    id: "value",
    header: "Value",
    text: (p) => `$${p.value.toLocaleString("en-US")}`,
    sortValue: (p) => p.value,
    mono: true,
  },
];

function table(search = "") {
  return render(
    <DataTable
      rows={people}
      columns={columns}
      rowKey={(p) => p.id}
      search={search}
      defaultSort={{ id: "name", desc: false }}
      caption="Contacts"
      noun={{ one: "contact", many: "contacts" }}
      emptyMessage="No contacts yet."
    />,
  );
}

function firstCells(column: number) {
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  return rows.slice(0, 3).map((row) => within(row).getAllByRole("cell")[column].textContent);
}

describe("DataTable", () => {
  it("sorts when a heading is clicked, sets aria-sort, and reverses on a second click", async () => {
    const user = userEvent.setup();
    table();
    const name = screen.getByRole("columnheader", { name: /Name/ });
    const value = screen.getByRole("columnheader", { name: /Value/ });
    expect(name).toHaveAttribute("aria-sort", "ascending");
    expect(value).toHaveAttribute("aria-sort", "none");

    await user.click(within(value).getByRole("button"));
    expect(value).toHaveAttribute("aria-sort", "ascending");
    expect(name).toHaveAttribute("aria-sort", "none");
    // Numeric, so $9,000 comes before $10,000.
    expect(firstCells(2)).toEqual(["$1,000", "$2,000", "$3,000"]);

    await user.click(within(value).getByRole("button"));
    expect(value).toHaveAttribute("aria-sort", "descending");
    expect(firstCells(2)).toEqual(["$36,000", "$35,000", "$34,000"]);
  });

  it('shows "12 of 36 contacts", and says when nothing matches', () => {
    const { unmount } = table("northwind");
    expect(screen.getByText("12 of 36 contacts")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(13);
    unmount();

    table("acme");
    expect(screen.getByText("0 of 36 contacts")).toBeInTheDocument();
    expect(screen.getByText("No contacts match 'acme'")).toBeInTheDocument();
  });
});
