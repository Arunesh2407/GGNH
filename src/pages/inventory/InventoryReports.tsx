import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Clock, Download, FileText, History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { InventoryLedgerEntry, ItemTraceRow, StockAvailabilityRow } from "@/types/inventory";

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
  const [ledgerEntries, setLedgerEntries] = useState<InventoryLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

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

  const loadLedger = async () => {
    setIsLoadingLedger(true);
    try {
      const transactions = await inventoryService.listTransactions(100);
      setLedgerEntries(transactions);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load inventory ledger audit trail.",
      );
    } finally {
      setIsLoadingLedger(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
    void loadLedger();
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

  const handleExportLedgerCsv = () => {
    if (ledgerEntries.length === 0) {
      toast.error("No ledger transactions to export.");
      return;
    }

    downloadCsv(
      "inventory-ledger-audit.csv",
      ["Timestamp", "Item", "SKU", "Action", "Quantity", "Balance After", "Notes", "Recorded By"],
      ledgerEntries.map((row) => [
        row.createdAt,
        row.itemName || "",
        row.itemSku || "",
        row.action,
        String(row.quantity),
        String(row.balanceAfter),
        row.notes || "",
        row.createdBy || "",
      ]),
    );

    toast.success("Inventory ledger audit CSV downloaded.");
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

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case "receive":
      case "return":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] gap-1">
            <ArrowUpRight className="w-3 h-3" />
            {action.toUpperCase()}
          </Badge>
        );
      case "issue":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[11px] gap-1">
            <ArrowDownRight className="w-3 h-3" />
            ISSUE
          </Badge>
        );
      case "waste":
        return (
          <Badge variant="destructive" className="text-[11px] gap-1">
            <ArrowDownRight className="w-3 h-3" />
            WASTE
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[11px]">
            {action.toUpperCase()}
          </Badge>
        );
    }
  };

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Availability Card */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Stock Availability</CardTitle>
              <CardDescription>
                Real-time stock position and low-stock monitoring across all catalog items.
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
              <div className="text-sm text-muted-foreground py-8 text-center">
                Loading report...
              </div>
            ) : (
              <div className="rounded-md border bg-background overflow-x-auto">
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
                      <TableRow key={row.itemId} className="hover:bg-muted/40">
                        <TableCell className="font-medium">
                          {row.itemName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.sku}</TableCell>
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
                                ? "text-red-700 dark:text-red-400 font-semibold"
                                : "text-emerald-700 dark:text-emerald-400 font-semibold"
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
                          className="text-center text-muted-foreground py-8"
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

        {/* Global Inventory Ledger Audit Trail */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Inventory Ledger Audit Trail
              </CardTitle>
              <CardDescription>
                Immutable transaction record of all stock receipts, dispatches, audits, and adjustments.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadLedger()}
                disabled={isLoadingLedger}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingLedger ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportLedgerCsv}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingLedger ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Loading ledger audit records...
              </div>
            ) : (
              <div className="rounded-md border bg-background overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Item / SKU</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Recorded By</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.map((entry) => (
                      <TableRow key={entry.id} className="hover:bg-muted/40 text-xs">
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {entry.itemName || "Item"}
                          </div>
                          {entry.itemSku && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {entry.itemSku}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getActionBadge(entry.action)}</TableCell>
                        <TableCell>
                          <span
                            className={
                              entry.action === "receive" || entry.action === "return"
                                ? "text-emerald-600 font-semibold"
                                : entry.quantity < 0
                                  ? "text-destructive font-semibold"
                                  : "font-semibold"
                            }
                          >
                            {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {entry.balanceAfter}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.createdBy || "System"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {entry.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {ledgerEntries.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          No stock movements recorded in the ledger yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Item Specific Trace Card */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Single Item Movement History</CardTitle>
              <CardDescription>
                Transaction-level lifecycle tracing for a selected item.
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
            <div className="rounded-md border bg-background overflow-x-auto">
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
                    <TableRow key={`${row.sourceRef}-${index}`} className="hover:bg-muted/40">
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
                        className="text-center text-muted-foreground py-8"
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
