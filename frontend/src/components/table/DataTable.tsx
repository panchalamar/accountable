import {
  type ColumnDef,
  type RowData,
  type SortingState,
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { type SortValue, compareValues, countLabel, matchesSearch } from "../../lib/table";

export type TableColumn<T extends RowData> = {
  id: string;
  header: string;
  /** The text the row shows in this column. Search matches it. */
  text: (row: T) => string;
  /** What to sort by. Numbers, money and dates give numbers or ISO dates. Defaults to the text. */
  sortValue?: (row: T) => SortValue;
  /** How the cell looks, when it's more than its text: links, chips. */
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Money, percentages and dates: right-aligned in JetBrains Mono. */
  mono?: boolean;
  /** Sort latest or largest first on the first click. */
  descFirst?: boolean;
  width?: string;
};

type Props<T extends RowData> = {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string | number;
  search: string;
  defaultSort: { id: string; desc: boolean };
  /** The table's name for screen readers, such as "Contacts". */
  caption: string;
  /** For "12 of 36 contacts" and "No contacts match 'acme'". */
  noun: { one: string; many: string };
  /** All the records, when a filter such as status has already narrowed `rows`. */
  total?: number;
  /** Search box and filters, above the table on the left. */
  toolbar?: ReactNode;
  /** Shown when there are no rows and no search. */
  emptyMessage: string;
  rowActions?: (row: T) => ReactNode;
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
});

export function DataTable<T extends RowData>({
  rows,
  columns,
  rowKey,
  search,
  defaultSort,
  caption,
  noun,
  total,
  toolbar,
  emptyMessage,
  rowActions,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([defaultSort]);

  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const columnDefs = useMemo<ColumnDef<typeof features, T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        accessorFn: (row: T) => {
          const value = column.sortValue ? column.sortValue(row) : column.text(row);
          return value === null || value === "" ? undefined : value;
        },
        sortDescFirst: column.descFirst ?? false,
        sortUndefined: "last",
        sortFn: (a, b, id) =>
          compareValues(a.getValue(id) as SortValue, b.getValue(id) as SortValue),
      })),
    [columns],
  );

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    getRowId: (row: T) => String(rowKey(row)),
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getColumnCanGlobalFilter: () => true,
    globalFilterFn: (row, columnId, filterValue: string) => {
      const column = byId.get(columnId);
      return column ? matchesSearch([column.text(row.original as T)], filterValue) : false;
    },
  });

  const shown = table.getRowModel().rows;
  const sortedBy = sorting[0];

  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        {toolbar}
        <p className="ml-auto text-[14px] text-ink-muted" aria-live="polite">
          {countLabel(shown.length, total ?? rows.length, noun.one, noun.many)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted =
                  sortedBy?.id === column.id
                    ? sortedBy.desc
                      ? "descending"
                      : "ascending"
                    : "none";
                const tableColumn = table.getColumn(column.id);
                const Icon =
                  isSorted === "ascending"
                    ? ArrowUp
                    : isSorted === "descending"
                      ? ArrowDown
                      : ArrowUpDown;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={isSorted}
                    className={`pb-2 pt-1 text-[13px] font-medium text-ink-muted ${column.align === "right" || column.mono ? "text-right" : "text-left"} px-3 first:pl-0`}
                    style={{ width: column.width }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        tableColumn?.toggleSorting(
                          isSorted === "none"
                            ? (column.descFirst ?? false)
                            : isSorted === "ascending",
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-[6px] py-1 hover:text-ink ${isSorted !== "none" ? "text-ink" : ""} ${column.align === "right" || column.mono ? "flex-row-reverse" : ""}`}
                    >
                      {column.header}
                      <Icon
                        size={14}
                        aria-hidden="true"
                        className={isSorted === "none" ? "opacity-50" : ""}
                      />
                    </button>
                  </th>
                );
              })}
              {rowActions ? (
                <th
                  scope="col"
                  className="w-[150px] pb-2 pt-1 text-right text-[13px] font-medium text-ink-muted"
                >
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-divider hover:bg-[#F7FAFA]">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-3 py-[11px] align-middle first:pl-0 ${column.align === "right" || column.mono ? "text-right" : ""} ${column.mono ? "num whitespace-nowrap text-[13.5px]" : ""}`}
                  >
                    {column.render
                      ? column.render(row.original as T)
                      : column.text(row.original as T)}
                  </td>
                ))}
                {rowActions ? (
                  <td className="py-[7px] pl-3 text-right whitespace-nowrap">
                    {rowActions(row.original as T)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 ? (
          <p className="border-t border-divider py-8 text-center text-ink-muted">
            {search.trim() ? `No ${noun.many} match '${search.trim()}'` : emptyMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
