"use client";

import { useMemo, useState } from "react";
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import { compareRanking } from "@/lib/ranking";
import type { UniversityCourseResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const WRAP_COLUMN_IDS = new Set([
  "universityLocation",
  "tuitionFee",
  "admissionRequirements",
]);

type ResultColumn = ColumnDef<typeof features, UniversityCourseResult>;

interface ResultsTableProps {
  results: UniversityCourseResult[];
  shortlistedIds: Set<string>;
  onShortlist: (course: UniversityCourseResult) => Promise<void>;
  restored?: boolean;
}

export function ResultsTable({
  results,
  shortlistedIds,
  onShortlist,
  restored = false,
}: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [adding, setAdding] = useState(false);

  const columns = useMemo<ResultColumn[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected() ||
              (table.getIsSomeRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "qsWorldRanking",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            QS Rank
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ getValue }) => getValue<number | null>() ?? "—",
        sortFn: (a, b) =>
          compareRanking(a.original.qsWorldRanking, b.original.qsWorldRanking),
      },
      {
        accessorKey: "universityName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            University
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
      },
      {
        accessorKey: "universityLocation",
        header: "Location",
        cell: ({ getValue }) => (
          <span className="block max-w-[16rem] whitespace-pre-wrap break-words leading-snug">
            {getValue<string>() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "courseName",
        header: "Course",
      },
      {
        accessorKey: "courseLevel",
        header: "Level",
      },
      {
        accessorKey: "specialization",
        header: "Specialization",
      },
      {
        accessorKey: "country",
        header: "Country",
      },
      {
        accessorKey: "tuitionFee",
        header: "Tuition Fee",
        cell: ({ getValue }) => (
          <span className="block max-w-[18rem] whitespace-pre-wrap break-words leading-snug">
            {getValue<string>() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "duration",
        header: "Duration",
      },
      {
        accessorKey: "admissionRequirements",
        header: "Admission Req.",
        cell: ({ getValue }) => (
          <span className="block max-w-[22rem] whitespace-pre-wrap break-words leading-snug">
            {getValue<string>() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "courseUrl",
        header: "URL",
        cell: ({ getValue }) => {
          const url = getValue<string>();
          if (!url) return "—";
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Link
              <ExternalLink className="size-3" />
            </a>
          );
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: "Shortlist",
        cell: ({ row }) => {
          const course = row.original;
          const isShortlisted = shortlistedIds.has(course.id);
          return (
            <Button
              variant={isShortlisted ? "secondary" : "outline"}
              size="sm"
              disabled={isShortlisted || adding}
              onClick={async () => {
                try {
                  await onShortlist(course);
                } catch {
                  toast.error("Failed to add to shortlist");
                }
              }}
            >
              <Star className="size-3.5" />
              {isShortlisted ? "Added" : "Add"}
            </Button>
          );
        },
        enableSorting: false,
      },
    ],
    [shortlistedIds, adding, onShortlist]
  );

  const table = useTable({
    features,
    data: results,
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: filterFn_includesString,
    getRowId: (row) => row.id,
  });

  const selectedCourses = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  async function handleBulkShortlist() {
    if (selectedCourses.length === 0) return;
    setAdding(true);
    try {
      for (const course of selectedCourses) {
        if (!shortlistedIds.has(course.id)) {
          await onShortlist(course);
        }
      }
      setRowSelection({});
      toast.success(`Added ${selectedCourses.length} course(s) to shortlist`);
    } catch {
      toast.error("Failed to add some courses to shortlist");
    } finally {
      setAdding(false);
    }
  }

  if (results.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {results.length} universities found — major universities and closest subject matches first; click QS Rank to sort by ranking
              {restored ? ". Showing your last search until you run a new one." : ""}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Filter results..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-xs"
            />
            {selectedCourses.length > 0 && (
              <Button onClick={handleBulkShortlist} disabled={adding}>
                <Star />
                Shortlist selected ({selectedCourses.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          WRAP_COLUMN_IDS.has(cell.column.id)
                            ? "max-w-[22rem] whitespace-normal align-top"
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results match your filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
