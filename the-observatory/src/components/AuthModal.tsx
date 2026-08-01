import { useRef, useState } from 'react';
import { X, Telescope } from 'lucide-react';
import { flaskFetch } from './api';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (user: { id: number; name?: string; email: string }) => void;
}

interface CreateUserResponse {
  UserID: number;
  message: string;
}

interface LoginResponse {
  UserID: number;
  Name: string | null;
  Email: string;
}

export function AuthModal({ open, onClose, onLogin}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);

  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setError(null);
    setSignupSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSubmitting(true);

    if (mode === "login") {
      try {
        const params = new URLSearchParams();
        if (name) params.set('name', name);

        const user = await flaskFetch<LoginResponse>(`/api/users/login?${params.toString()}`, {
          method: 'POST',
          body: JSON.stringify({ email }),
        });

        onLogin({ id: user.UserID, name: user.Name ?? undefined, email: user.Email });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sign in.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const response = await flaskFetch<CreateUserResponse>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      });
      void response;
      setSignupSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog open={open} ref={dialogRef} id="auth-modal" className="modal"
      aria-labelledby="auth-modal-title"
    >
      <div className="modal-box max-w-md p-8 border border-neutral">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-1">
            <Telescope size={22} className="text-warning" />
          </div>
          <h2 id="auth-modal-title" className="text-xl font-semibold">
            {signupSuccess
              ? "Account created"
              : mode === "login" ? "Welcome back, stargazer" : "Join the observatory"}
          </h2>
          <p className="text-sm text-center">
            {signupSuccess
              ? "Your account is ready. Sign in to get started."
              : mode === "login"
                ? "Sign in to access your observation lists"
                : "Create an account to track celestial objects"}
          </p>
        </div>
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={() => { dialogRef.current?.close(); onClose(); }}
        >
          <X size={18} />
          <span className="sr-only">Close</span>
        </button>
        {signupSuccess ? (
          <p className="text-center text-sm">
            <button
              onClick={() => switchMode("login")}
              className="text-warning font-bold hover:underline"
            >
              Sign in
            </button>
          </p>
        ) : (
          <>
            <form
              method="dialog"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="display-name" className="text-sm">
                  Display name
                </label>
                <input id="display-name" type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Galileo Galilei"
                  className="input w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm">Email</label>
                <input id="email" value={email} name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@observatory.com"
                  className="input validator w-full"
                  autoComplete="email"
                  required
                />
              </div>
              {error && (
                <p className="text-error text-sm">{error}</p>
              )}
              <button
                type="submit"
                className="btn btn-warning mt-2"
                disabled={submitting}
              >
                {submitting
                  ? mode === "login" ? "Signing in…" : "Creating account…"
                  : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "
              }
              <button
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                className="text-warning font-bold hover:underline"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
