import { useRef, useState } from 'react';
import { X, Telescope } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (user: { name: string; email: string }) => void;
}

export function AuthModal({ open, onClose, onLogin}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);

  // TODO find a replacement for this deprecation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ name: name || email.split("@")[0], email });
    onClose();
  };

  return (
    <dialog open={open} ref={dialogRef} id="auth-modal" className="modal"
      // do I need the behavior from onOpenChange?
      aria-labelledby="auth-modal-title"
    >
      <div className="modal-box max-w-md p-8 border border-neutral">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-1">
            <Telescope size={22} className="text-warning" />
          </div>
          <h2 id="auth-modal-title" className="text-xl font-semibold">
            {mode === "login" ? "Welcome back, stargazer" : "Join the observatory"}
          </h2>
          <p className="text-sm text-center">
            {mode === "login"
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
        <form
          method="dialog"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {mode === "signup" && (
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
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm">Email</label>
            <input id="email" type="email" value={email} name="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@observatory.com"
              className="input validator w-full"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm">Password</label>
            <input id="password" type="password" value={password}
              name="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input validator w-full"
              required
              />
          </div>
          <button
            type="submit"
            className="btn btn-warning mt-2"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm">
          {mode === "login"
            ? "Don't have an account? "
            : "Already have an account? "
          }
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-warning font-bold hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </dialog>
  );
}
