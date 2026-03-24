import { Link } from "react-router-dom";
import { ClipboardList, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const options = [
  {
    title: "Attendance",
    description: "Mark and manage daily staff attendance.",
    to: "/staff/attendance",
    icon: UserCheck,
  },
  {
    title: "Appointments",
    description: "View booked appointments and mark completed ones.",
    to: "/staff/appointments",
    icon: ClipboardList,
  },
];

const StaffHome = () => {
  return (
    <main className="min-h-screen pt-28 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Staff Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Select a module to continue.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {options.map((option) => (
            <Link key={option.title} to={option.to}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <option.icon className="w-5 h-5" />
                  </div>
                  <CardTitle>{option.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
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

export default StaffHome;
