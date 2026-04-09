"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 shadow-2xl"
          >
            {/* Decoration */}
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-zinc-900/5 dark:bg-white/5 blur-3xl pointer-events-none" />
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-6 top-6 text-zinc-400 transition-all hover:text-zinc-900 dark:hover:text-white hover:scale-110 active:scale-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                {mode === "accessCode" ? "Access Key" : mode === "login" ? "Welcome Back" : "Join Builtattic"}
              </h2>
              <p className="mt-2 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                {mode === "accessCode"
                  ? "Enter your secure key to unlock enterprise intelligence."
                  : mode === "login"
                  ? "Enter your credentials to access your secure portal."
                  : "Start analyzing high-velocity construction data today."}
              </p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-bold text-red-500">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "accessCode" ? (
                <div className="space-y-2">
                  <label htmlFor="accessCode" className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                    Security Code
                  </label>
                  <input
                    type="text"
                    id="accessCode"
                    name="accessCode"
                    value={formData.accessCode}
                    onChange={handleChange}
                    required
                    className="w-full h-14 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black px-4 font-mono text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-inner"
                    placeholder="XXXX-XXXX-XXXX"
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  {mode === "register" && (
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                        Identity
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full h-14 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black px-4 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-inner"
                        placeholder="John Doe"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full h-14 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black px-4 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-inner"
                      placeholder="you@domain.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                      Security Phrase
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                      className="w-full h-14 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black px-4 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-inner"
                      placeholder="••••••••"
                    />
                  </div>
                </>
              )}

              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase tracking-widest text-[11px] hover:scale-[1.02] active:scale-98 transition-all shadow-xl shadow-zinc-500/20 dark:shadow-white/10"
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-5 w-5 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full" />
                ) : mode === "accessCode" ? (
                  "Unlock Access"
                ) : mode === "login" ? (
                  "Secure Entry"
                ) : (
                  "Initialize Account"
                )}
              </Button>
            </form>

            {/* Toggle mode */}
            <div className="mt-8 space-y-3 text-center">
              <button
                onClick={toggleMode}
                className="block w-full text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {mode === "accessCode"
                  ? "Switch to standard login"
                  : mode === "login"
                  ? "Need access? Register here"
                  : "Member? Sign in here"}
              </button>
              {mode !== "accessCode" && (
                <button
                  onClick={showAccessCodeMode}
                  className="block w-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  Enter Access Key
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
