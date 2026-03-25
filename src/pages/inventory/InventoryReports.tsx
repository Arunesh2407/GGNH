import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryService } from "@/services/inventoryService";
import type { ItemTraceRow, StockAvailabilityRow } from "@/types/inventory";

const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","),
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const InventoryReports = () => {
  const [availabilityRows, setAvailabilityRows] = useState<
    StockAvailabilityRow[]
  >([]);
  const [itemOptions, setItemOptions] = useState<
    { id: string; label: string; currentStock: number; category: string }[]
  >([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [traceRows, setTraceRows] = useState<ItemTraceRow[]>([]);
  const [traceItemName, setTraceItemName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const lowStockCount = useMemo(
    () => availabilityRows.filter((row) => row.isLowStock).length,
    [availabilityRows],
  );

  const loadAvailability = async () => {
    setIsLoading(true);

    try {
      const [rows, options] = await Promise.all([
        inventoryService.getStockAvailabilityReport(),
        inventoryService.getItemLookupOptions(),
      ]);
      setAvailabilityRows(rows);
      setItemOptions(options);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load inventory reports.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
  }, []);

  const loadTrace = async (itemId: string) => {
    if (!itemId) {
      setTraceRows([]);
      setTraceItemName("");
      return;
    }

    try {
      const result = await inventoryService.getItemTraceReport(itemId);
      setTraceRows(result.rows);
      setTraceItemName(result.itemName);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load item trace.",
      );
    }
  };

  const handleExportAvailabilityCsv = () => {
    downloadCsv(
      "inventory-availability.csv",
      ["Item", "SKU", "Category", "Stock", "Reorder", "Status"],
      availabilityRows.map((row) => [
        row.itemName,
        row.sku,
        row.categoryName,
        String(row.currentStock),
        String(row.reorderLevel),
        row.isLowStock ? "Low stock" : "Normal",
      ]),
    );

    toast.success("Availability CSV downloaded.");
  };

  const handleExportTraceCsv = () => {
    if (traceRows.length === 0) {
      toast.error("No item trace data to export.");
      return;
    }

    downloadCsv(
      "item-trace.csv",
      ["Date", "Action", "Quantity", "Balance", "Source", "Notes", "Actor"],
      traceRows.map((row) => [
        row.date,
        row.action,
        String(row.quantity),
        String(row.balanceAfter),
        row.sourceRef,
        row.notes,
        row.actor,
      ]),
    );

    toast.success("Item trace CSV downloaded.");
  };

  const handleExportAvailabilityPdf = () => {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    pdf.setFontSize(14);
    pdf.text("Inventory Availability Report", 40, 40);
    pdf.setFontSize(10);
    pdf.text(`Low stock items: ${lowStockCount}`, 40, 58);

    autoTable(pdf, {
      startY: 72,
      head: [["Item", "SKU", "Category", "Stock", "Reorder", "Status"]],
      body: availabilityRows.map((row) => [
        row.itemName,
        row.sku,
        row.categoryName,
        String(row.currentStock),
        String(row.reorderLevel),
        row.isLowStock ? "Low stock" : "Normal",
      ]),
      styles: {
        fontSize: 9,
      },
    });

    pdf.save("inventory-availability.pdf");
    toast.success("Availability PDF downloaded.");
  };

  const handleExportTracePdf = () => {
    if (traceRows.length === 0) {
      toast.error("No item trace data to export.");
      return;
    }

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    pdf.setFontSize(14);
    pdf.text(`Item Trace Report: ${traceItemName || "Selected item"}`, 40, 40);

    autoTable(pdf, {
      startY: 56,
      head: [["Date", "Action", "Qty", "Balance", "Source", "Notes", "Actor"]],
      body: traceRows.map((row) => [
        row.date,
        row.action,
        String(row.quantity),
        String(row.balanceAfter),
        row.sourceRef,
        row.notes,
        row.actor,
      ]),
      styles: {
        fontSize: 9,
      },
    });

    pdf.save("item-trace.pdf");
    toast.success("Item trace PDF downloaded.");
  };

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Stock Availability</CardTitle>
              <CardDescription>
                Real-time stock position and low-stock monitoring.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void loadAvailability()}>
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleExportAvailabilityCsv}>
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <Button onClick={handleExportAvailabilityPdf}>
                <Download className="w-4 h-4" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading report...
              </div>
            ) : (
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Reorder</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availabilityRows.map((row) => (
                      <TableRow key={row.itemId}>
                        <TableCell className="font-medium">
                          {row.itemName}
                        </TableCell>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell>
                          {row.currentStock} {row.unit}
                        </TableCell>
                        <TableCell>
                          {row.reorderLevel} {row.unit}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              row.isLowStock
                                ? "text-red-700 font-semibold"
                                : "text-emerald-700 font-semibold"
                            }
                          >
                            {row.isLowStock ? "Low stock" : "Normal"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {availabilityRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No availability data available.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Item Trace</CardTitle>
              <CardDescription>
                Transaction-level tracing for a selected item.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 min-w-[280px] rounded-md border border-input bg-background px-3 text-sm"
                value={selectedItemId}
                onChange={(event) => {
                  const itemId = event.target.value;
                  setSelectedItemId(itemId);
                  void loadTrace(itemId);
                }}
              >
                <option value="">Select item</option>
                {itemOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={handleExportTraceCsv}>
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <Button onClick={handleExportTracePdf}>
                <Download className="w-4 h-4" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traceRows.map((row, index) => (
                    <TableRow key={`${row.sourceRef}-${index}`}>
                      <TableCell>
                        {new Date(row.date).toLocaleString()}
                      </TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{row.balanceAfter}</TableCell>
                      <TableCell>{row.sourceRef}</TableCell>
                      <TableCell>{row.actor}</TableCell>
                    </TableRow>
                  ))}
                  {traceRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        Select an item to view trace history.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default InventoryReports;
