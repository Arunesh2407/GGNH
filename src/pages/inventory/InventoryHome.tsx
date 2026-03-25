import { Link } from "react-router-dom";
import {
  Boxes,
  FileSearch,
  PackagePlus,
  Shapes,
  Truck,
  UsersRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  {
    title: "Item Categories",
    description: "Create and manage inventory item categories.",
    to: "/staff/inventory/categories",
    icon: Shapes,
  },
  {
    title: "Item Master",
    description:
      "Maintain item SKU, unit, reorder level, and supplier mapping.",
    to: "/staff/inventory/items",
    icon: Boxes,
  },
  {
    title: "Suppliers",
    description: "Manage approved suppliers and contact information.",
    to: "/staff/inventory/suppliers",
    icon: UsersRound,
  },
  {
    title: "Stock Receiving",
    description: "Record stock receipts with batch and expiry details.",
    to: "/staff/inventory/stock-receiving",
    icon: PackagePlus,
  },
  {
    title: "Inventory Reports",
    description:
      "View item tracing and stock availability with export support.",
    to: "/staff/inventory/reports",
    icon: FileSearch,
  },
];

const InventoryHome = () => {
  return (
    <main className="min-h-screen pt-28 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Inventory Hub</h1>
            <p className="text-muted-foreground mt-1">
              Hospital inventory and department integration module.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <Link key={module.to} to={module.to}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <module.icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {module.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
};

export default InventoryHome;
