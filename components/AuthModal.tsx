"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register" | "accessCode";
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  onAccessCode: (code: string) => void;
}

export function AuthModal({ isOpen, onClose, defaultMode = "login", onLogin, onRegister, onAccessCode }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register" | "accessCode">(defaultMode);
  const [formData, setFormData] = useState({ email: "", password: "", name: "", accessCode: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setFormData({ email: "", password: "", name: "", accessCode: "" });
      setError("");
      setIsLoading(false);
    }
  }, [isOpen, defaultMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "accessCode") {
        if (!formData.accessCode.trim()) {
          setError("Please enter an access code");
          setIsLoading(false);
          return;
        }
        onAccessCode(formData.accessCode.trim());
        onClose();
      } else if (mode === "login") {
        await onLogin(formData.email, formData.password);
        onClose();
      } else {
        if (!formData.name.trim()) {
          setError("Name is required");
          setIsLoading(false);
          return;
        }
        await onRegister(formData.email, formData.password, formData.name);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    if (mode === "accessCode") {
      setMode("login");
    } else {
      setMode(mode === "login" ? "register" : "login");
    }
    setError("");
    setFormData({ email: "", password: "", name: "", accessCode: "" });
  };

  const showAccessCodeMode = () => {
    setMode("accessCode");
    setError("");
    setFormData({ email: "", password: "", name: "", accessCode: "" });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[color:var(--text)]">
            {mode === "accessCode" ? "Enter Access Code" : mode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {mode === "accessCode"
              ? "Enter your Pro access code to unlock unlimited features"
              : mode === "login"
              ? "Sign in to access your workspace"
              : "Get started with Valuator"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "accessCode" ? (
            <div>
              <label htmlFor="accessCode" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Access Code
              </label>
              <input
                type="text"
                id="accessCode"
                name="accessCode"
                value={formData.accessCode}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-2 font-mono text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
                placeholder="XXXX-XXXX-XXXX"
                autoFocus
              />
              <p className="mt-1 text-[10px] text-[color:var(--muted)]">Enter your Pro access code to unlock unlimited prompts</p>
            </div>
          ) : (
            <>
              {mode === "register" && (
                <div>
                  <label htmlFor="name" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
                    placeholder="John Doe"
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
                  placeholder="••••••••"
                />
                {mode === "register" && (
                  <p className="mt-1 text-[10px] text-[color:var(--muted)]">At least 6 characters</p>
                )}
              </div>
            </>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading
              ? "Please wait..."
              : mode === "accessCode"
              ? "Activate Access Code"
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className="mt-4 space-y-2 text-center">
          <button
            onClick={toggleMode}
            className="block w-full text-xs font-semibold text-[color:var(--accent)] hover:underline"
          >
            {mode === "accessCode"
              ? "Back to login"
              : mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
          {mode !== "accessCode" && (
            <button
              onClick={showAccessCodeMode}
              className="block w-full text-xs text-[color:var(--muted)] hover:text-[color:var(--text)]"
            >
              Have an access code? Enter it here
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
