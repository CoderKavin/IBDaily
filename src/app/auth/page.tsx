"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, PrimaryButton } from "@/components/ui";
import { signInWithEmail, signUpWithEmail } from "@/lib/firebase";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Check for session expired message
  useEffect(() => {
    if (typeof window !== "undefined") {
      const message = sessionStorage.getItem("authMessage");
      if (message) {
        setInfo(message);
        sessionStorage.removeItem("authMessage");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return; // Prevent double submit

    setError("");
    setInfo("");
    setLoading(true);

    try {
      let firebaseUser;

      if (isLogin) {
        // Sign in with Firebase
        const userCredential = await signInWithEmail(email, password);
        firebaseUser = userCredential.user;
      } else {
        // Sign up with Firebase
        const userCredential = await signUpWithEmail(email, password);
        firebaseUser = userCredential.user;
      }

      // Now sign in with NextAuth using Firebase credentials
      const result = await signIn("credentials", {
        email: firebaseUser.email,
        firebaseUid: firebaseUser.uid,
        name: name || firebaseUser.displayName || "",
        redirect: false,
      });

      if (result?.error) {
        setError("Authentication failed. Please try again.");
      } else {
        router.push("/cohort");
        router.refresh();
      }
    } catch (err) {
      // Handle Firebase auth errors
      const firebaseError = err as { code?: string; message?: string };
      switch (firebaseError.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Invalid email or password");
          break;
        case "auth/email-already-in-use":
          setError("Email already in use. Please log in.");
          setIsLogin(true);
          break;
        case "auth/weak-password":
          setError("Password should be at least 6 characters");
          break;
        case "auth/invalid-email":
          setError("Invalid email address");
          break;
        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;
        case "auth/network-request-failed":
          setError("Network error. Please check your connection.");
          break;
        case "auth/operation-not-allowed":
          setError("Email/Password sign-in is not enabled. Please contact support.");
          break;
        case "auth/user-disabled":
          setError("This account has been disabled.");
          break;
        case "auth/requires-recent-login":
          setError("Please log in again to continue.");
          break;
        default:
          console.error("Auth error:", firebaseError.code, firebaseError.message);
          setError(
            firebaseError.message || "Something went wrong. Please try again.",
          );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            IBDaily
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Track your daily concept summaries
          </p>
        </div>

        <Card padding="lg">
          {/* Session info message */}
          {info && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {info}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex mb-6 border-b border-neutral-100 dark:border-neutral-700/50">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError("");
              }}
              className={`
                flex-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${
                  isLogin
                    ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                    : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                }
              `}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError("");
              }}
              className={`
                flex-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${
                  !isLogin
                    ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                    : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                }
              `}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                placeholder="Min 6 characters"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <PrimaryButton
              type="submit"
              disabled={loading}
              loading={loading}
              fullWidth
            >
              {isLogin ? "Login" : "Sign Up"}
            </PrimaryButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
