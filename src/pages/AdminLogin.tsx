import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

const AdminLogin = () => {
  const { isAuthenticated, isLoading, authError, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? "/staff";

  if (isAuthenticated) {
    return <Navigate to="/staff" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const isValid = await login(email, password);

    if (!isValid) {
      setError(authError || "Unable to login.");
      setIsSubmitting(false);
      return;
    }

    setError("");
    navigate(redirectTo, { replace: true });
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
        <div className="max-w-md mx-auto text-center text-muted-foreground">
          Checking authentication...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-md mx-auto">
        <Card className="shadow-lg border-primary/10">
          <CardHeader className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Sign in to manage staff attendance and edit staff details.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter email"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>

              {authError || error ? (
                <p className="text-sm text-destructive">{error || authError}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Login"}
              </Button>
            </form>

            <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              New user?{" "}
              <Link
                to="/admin/register"
                className="text-primary hover:underline"
              >
                Create account
              </Link>{" "}
              and wait for super admin approval.
            </div>

            <Link
              to="/"
              className="inline-block mt-4 text-sm text-primary hover:underline"
            >
              Back to Home
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminLogin;
