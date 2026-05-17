import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = "No results found.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))]">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => {
                const val = (row as Record<string, unknown>)[col.key];
                return (
                  <TableCell key={col.key}>
                    {col.render ? col.render(val, row) : String(val ?? "—")}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
