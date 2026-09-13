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
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Trash2 } from "lucide-react";
import { compareRanking } from "@/lib/ranking";
import type { ShortlistedCourse } from "@/lib/types";
import { CourseDetailsDialog } from "@/components/shortlist/course-details-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
});

type ShortlistColumn = ColumnDef<typeof features, ShortlistedCourse>;

interface ShortlistTableProps {
  items: ShortlistedCourse[];
  onRemove: (id: string) => Promise<void>;
  onSaveNotes: (id: string, notes: string) => Promise<void>;
}

export function ShortlistTable({
  items,
  onRemove,
  onSaveNotes,
}: ShortlistTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "qs_world_ranking", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const columns = useMemo<ShortlistColumn[]>(
    () => [
      {
        accessorKey: "qs_world_ranking",
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
          compareRanking(a.original.qs_world_ranking, b.original.qs_world_ranking),
      },
      {
        accessorKey: "university_name",
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
        accessorKey: "university_location",
        header: "Location",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "course_name",
        header: "Course",
      },
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "tuition_fee",
        header: "Tuition",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "duration",
        header: "Duration",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "admission_requirements",
        header: "Requirements",
        cell: ({ getValue }) => (
          <span className="block max-w-[180px] truncate" title={getValue<string | null>() ?? ""}>
            {getValue<string | null>() ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "course_url",
        header: "URL",
        cell: ({ getValue }) => {
          const url = getValue<string | null>();
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
      },
      {
        accessorKey: "is_manual",
        header: "Source",
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Badge variant="outline">Manual</Badge>
          ) : (
            <Badge variant="secondary">AI Search</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <CourseDetailsDialog course={row.original} onSaveNotes={onSaveNotes} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${row.original.course_name}`}
              disabled={removing === row.original.id}
              onClick={async () => {
                setRemoving(row.original.id);
                try {
                  await onRemove(row.original.id);
                } finally {
                  setRemoving(null);
                }
              }}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [removing, onRemove, onSaveNotes]
  );

  const table = useTable({
    features,
    data: items,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: filterFn_includesString,
    getRowId: (row) => row.id,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Your Shortlist</CardTitle>
            <CardDescription>
              {items.length} course{items.length !== 1 ? "s" : ""} saved — persisted to your account
            </CardDescription>
          </div>
          <Input
            placeholder="Filter shortlist..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground">No courses shortlisted yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Search for courses or add one manually.
            </p>
          </div>
        ) : (
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
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
