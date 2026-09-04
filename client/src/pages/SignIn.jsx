import { useState } from "react";
import { api, setAuth, toast } from "../api.js";

const DEMO_ACCOUNTS = [
  {
    role: "Student",
    label: "🎓 Sakibul Hassan (Student · Full Access)",
    email: "sakibul.hassan@aust.edu",
    password: "student123",
    badgeCls: "bg-indigo-100 text-indigo-800 border-indigo-200",
    desc: "Enrolled student profile with full access across all campus systems",
  },
  {
    role: "Student",
    label: "🎓 QA Tester (Student · Full Access)",
    email: "qa.tester@aust.edu",
    password: "student123",
    badgeCls: "bg-blue-100 text-blue-800 border-blue-200",
    desc: "Test student profile with full access to schedules, rooms, events & notices",
  },
  {
    role: "Student",
    label: "🎓 Tanvir Ahmed (Student · Full Access)",
    email: "tanvir.ahmed@aust.edu",
    password: "student123",
    badgeCls: "bg-cyan-100 text-cyan-800 border-cyan-200",
    desc: "Student profile with complete room booking and registration rights",
  },
];

export default function SignIn({ onNavigate, onSuccess }) {
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!ident.trim() || !password) {
      setError("Please provide your email or Student ID, and your password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.signin({ email_or_id: ident.trim(), password });
      setAuth(res.user, res.token);
      toast(`Welcome back, ${res.user.name}!`, "success");
      if (onSuccess) onSuccess(res.user);
      else if (onNavigate) onNavigate("overview");
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
      toast(err.message || "Sign in failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (acc) => {
    setIdent(acc.email);
    setPassword(acc.password);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white text-2xl font-bold shadow-lg shadow-indigo-500/30 mb-3">
            🏫
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">CampusOS Authentication</h1>
          <p className="mt-1 text-sm text-slate-400">Ahsanullah University of Science and Technology</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-800/90 border border-slate-700/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Sign In</h2>
              <p className="text-xs text-slate-400">Enter your credentials to access your portal</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("signup")}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              Need an account? Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-rose-950/80 border border-rose-600/50 p-3.5 text-sm text-rose-200 flex items-start gap-2.5">
              <span className="text-base leading-none">⚠️</span>
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email or Student / Employee ID
              </label>
              <input
                type="text"
                value={ident}
                onChange={(e) => setIdent(e.target.value)}
                placeholder="e.g. sakibul.hassan@aust.edu or admin@aust.edu"
                required
                className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Signing in..." : "Sign In to CampusOS"}
              </button>
            </div>
          </form>

          {/* Quick-fill demo credentials */}
          <div className="mt-8 border-t border-slate-700/80 pt-5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Demo Login</p>
              <span className="text-[10px] text-slate-500">1-click fill</span>
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickFill(acc)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-700/70 border border-slate-700/50 hover:border-slate-600 transition-all text-xs flex flex-col gap-0.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 group-hover:text-white">{acc.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${acc.badgeCls}`}>
                      {acc.role}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{acc.email} · {acc.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
