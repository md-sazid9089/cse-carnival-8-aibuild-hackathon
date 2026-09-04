import { useRef, useState } from "react";
import { api, setAuth, toast } from "../api.js";
import AuthLayout from "../components/AuthLayout.jsx";
import { Button, Field, TextInput } from "../components/ui.jsx";

export default function SignIn({ onNavigate, onSuccess }) {
  const [values, setValues] = useState({ ident: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const identRef = useRef(null);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const next = {};
    if (!values.ident.trim()) next.ident = "Enter your email address or Student ID.";
    if (!values.password) next.password = "Enter your password.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) {
      identRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await api.signin({ email_or_id: values.ident.trim(), password: values.password });
      setAuth(res.user, res.token);
      toast(`Welcome back, ${res.user.name}`, "success");
      if (onSuccess) onSuccess(res.user);
      else onNavigate?.("overview");
    } catch (err) {
      setFormError(err.message || "We couldn't sign you in. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to CampusOS"
      subtitle="Use the email address or Student ID your department has on file."
      footer={
        <>
          New to CampusOS?{" "}
          <button
            type="button"
            onClick={() => onNavigate?.("signup")}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Create an account
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div aria-live="polite">
          {formError ? (
            <p className="rounded-lg border border-critical/30 bg-critical-soft px-3.5 py-3 text-[13px] font-medium text-critical">
              {formError}
            </p>
          ) : null}
        </div>

        <Field label="Email or Student ID" htmlFor="signin-ident" required error={errors.ident}>
          {({ describedBy }) => (
            <TextInput
              id="signin-ident"
              ref={identRef}
              value={values.ident}
              onChange={set("ident")}
              placeholder="your university email or student ID"
              autoComplete="username"
              autoFocus
              invalid={Boolean(errors.ident)}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field label="Password" htmlFor="signin-password" required error={errors.password}>
          {({ describedBy }) => (
            <div className="relative">
              <TextInput
                id="signin-password"
                type={showPassword ? "text" : "password"}
                value={values.password}
                onChange={set("password")}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-16"
                invalid={Boolean(errors.password)}
                aria-describedby={describedBy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-2 my-auto h-6 rounded px-1.5 text-xs font-medium text-ink-3 transition-colors hover:text-ink"
              >
                {showPassword ? "Hide" : "Show"}
                <span className="sr-only"> password</span>
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
