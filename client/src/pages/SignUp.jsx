import { useState } from "react";
import { api, setAuth, toast } from "../api.js";

const DEPARTMENTS = ["CSE", "EEE", "ME", "CE", "TE", "Architecture", "BBA"];

export default function SignUp({ onNavigate, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        student_id: studentId.trim() || undefined,
        department,
      });

      setAuth(res.user, res.token);
      toast(`Registration successful! Account created as Student (${res.user.student_id})`, "success");
      if (onSuccess) onSuccess(res.user);
      else if (onNavigate) onNavigate("overview");
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
      toast(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white text-2xl font-bold shadow-lg shadow-indigo-500/30 mb-3">
            🎓
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Join CampusOS</h1>
          <p className="mt-1 text-sm text-slate-400">Create your university student account</p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-800/90 border border-slate-700/80 backdrop-blur-xl py-7 px-6 shadow-2xl rounded-2xl sm:px-10">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3.5 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Create Student Account</h2>
              <p className="text-xs text-slate-400">Full Access Student Role Provisioning</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("signin")}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              Have an account? Sign In
            </button>
          </div>

          {/* Student Role Notice */}
          <div className="mb-5 rounded-lg bg-indigo-950/60 border border-indigo-600/40 p-3 text-xs text-indigo-200">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-1">
              <span>🎓</span> Role: Student (Full Access)
            </div>
            <p className="text-indigo-300/80">
              New signups are assigned the <b>Student</b> role with complete access across course routines, room management, event registrations, announcements, and AI assistance.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-rose-950/80 border border-rose-600/50 p-3 text-xs text-rose-200 flex items-start gap-2">
              <span className="text-sm"></span>
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sakibul Hassan"
                required
                className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@aust.edu"
                  required
                  className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Student ID <span className="text-slate-500 text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 20-40532"
                  className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Password <span className="text-rose-400">*</span> <span className="text-[10px] text-slate-400">(min. 6 chars)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a secure password"
                required
                minLength={6}
                className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                className="w-full rounded-lg bg-slate-900/90 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Registering Student Account..." : "Sign Up as Student"}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("signin")}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
