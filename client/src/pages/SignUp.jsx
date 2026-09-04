import { useMemo, useState } from "react";
import { api, setAuth, toast } from "../api.js";
import AuthLayout from "../components/AuthLayout.jsx";
import { Button, Field, TextInput } from "../components/ui.jsx";
import { CAMPUS_DOMAIN, CAMPUS_EMAIL_EXAMPLE, isCampusEmail, parseCampusEmail } from "../lib/aust.js";
import { cx } from "../lib/format.js";

const MIN_PASSWORD = 6;

function strengthOf(password) {
  if (!password) return null;
  let score = 0;
  if (password.length >= MIN_PASSWORD) score += 1;
  if (password.length >= 12) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || (/[A-Za-z]/.test(password) && /\d/.test(password))) score += 1;
  return [
    { label: "Weak", bar: "bg-critical", width: "33%" },
    { label: "Fair", bar: "bg-caution", width: "66%" },
    { label: "Strong", bar: "bg-positive", width: "100%" },
  ][Math.max(0, score - 1)];
}

export default function SignUp({ onNavigate, onSuccess }) {
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => strengthOf(values.password), [values.password]);
  const identity = useMemo(() => parseCampusEmail(values.email), [values.email]);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = () => {
    const next = {};
    if (!values.name.trim()) next.name = "Enter your full name.";
    if (!values.email.trim()) next.email = `Enter your AUST email address (@${CAMPUS_DOMAIN}).`;
    else if (!isCampusEmail(values.email))
      next.email = `CampusOS is for AUST students only — use your @${CAMPUS_DOMAIN} address.`;
    else if (!identity) next.email = `Your AUST email should look like ${CAMPUS_EMAIL_EXAMPLE}.`;
    if (!values.password) next.password = "Choose a password.";
    else if (values.password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (values.confirmPassword !== values.password) next.confirmPassword = "Passwords don't match.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const next = validate();
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) {
      document.getElementById(`signup-${Object.keys(next)[0]}`)?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await api.signup({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      setAuth(res.user, res.token);
      toast(`Account created — welcome, ${res.user.name}`, "success");
      if (onSuccess) onSuccess(res.user);
      else onNavigate?.("/dashboard");
    } catch (err) {
      setFormError(err.message || "We couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your student account"
      subtitle={`For AUST students only. Sign up with your university email (${CAMPUS_EMAIL_EXAMPLE}) — your student ID and department are read from it.`}
      onHome={() => onNavigate?.("/")}
      footer={
        <>
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => onNavigate?.("/auth/signin")}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Sign in
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

        <Field label="Full name" htmlFor="signup-name" required error={errors.name}>
          {({ describedBy }) => (
            <TextInput
              id="signup-name"
              value={values.name}
              onChange={set("name")}
              placeholder="Your full name"
              autoComplete="name"
              autoFocus
              invalid={Boolean(errors.name)}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field
          label="AUST email address"
          htmlFor="signup-email"
          required
          error={errors.email}
          hint={`Format: ${CAMPUS_EMAIL_EXAMPLE}`}
        >
          {({ describedBy }) => (
            <TextInput
              id="signup-email"
              type="email"
              value={values.email}
              onChange={set("email")}
              placeholder={CAMPUS_EMAIL_EXAMPLE}
              autoComplete="email"
              invalid={Boolean(errors.email)}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <div
          aria-live="polite"
          className="rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2"
        >
          {identity ? (
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Student ID</dt>
                <dd className="mt-0.5 font-medium text-ink tabular">{identity.studentId}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Department</dt>
                <dd className="mt-0.5 font-medium text-ink">{identity.department}</dd>
              </div>
            </dl>
          ) : (
            <p>Your student ID and department appear here as soon as your AUST email is recognised.</p>
          )}
        </div>

        <Field
          label="Password"
          htmlFor="signup-password"
          required
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
        >
          {({ describedBy }) => (
            <>
              <div className="relative">
                <TextInput
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  value={values.password}
                  onChange={set("password")}
                  placeholder="Choose a secure password"
                  autoComplete="new-password"
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
              {strength ? (
                <p className="mt-2 flex items-center gap-2.5">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={cx("block h-full rounded-full transition-[width] duration-300", strength.bar)}
                      style={{ width: strength.width }}
                    />
                  </span>
                  <span className="text-xs font-medium text-ink-3">{strength.label}</span>
                </p>
              ) : null}
            </>
          )}
        </Field>

        <Field label="Confirm password" htmlFor="signup-confirmPassword" required error={errors.confirmPassword}>
          {({ describedBy }) => (
            <TextInput
              id="signup-confirmPassword"
              type={showPassword ? "text" : "password"}
              value={values.confirmPassword}
              onChange={set("confirmPassword")}
              placeholder="Re-enter password"
              autoComplete="new-password"
              invalid={Boolean(errors.confirmPassword)}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
