import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
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

const AdminRegister = () => {
  const { register, authError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    const registerResult = await register(email, password);

    if (!registerResult.ok) {
      setError(
        registerResult.error || authError || "Unable to create account.",
      );
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage(
      "Account created successfully. Your account is pending super admin approval.",
    );
    setPassword("");
    setConfirmPassword("");
    setIsSubmitting(false);

    setTimeout(() => {
      navigate("/admin/login", { replace: true });
    }, 1500);
  };

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-md mx-auto">
        <Card className="shadow-lg border-primary/10">
          <CardHeader className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UserPlus className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription>
              Anyone can create an account. Access is enabled only after super
              admin approval.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="register-email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter email"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="register-password"
                  className="text-sm font-medium"
                >
                  Password
                </label>
                <Input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="register-confirm-password"
                  className="text-sm font-medium"
                >
                  Confirm Password
                </label>
                <Input
                  id="register-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </div>

              {error || authError ? (
                <p className="text-sm text-destructive">{error || authError}</p>
              ) : null}

              {successMessage ? (
                <p className="text-sm text-emerald-700">{successMessage}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              <Link to="/admin/login" className="text-primary hover:underline">
                Back to Login
              </Link>
              <Link to="/" className="text-primary hover:underline">
                Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminRegister;
