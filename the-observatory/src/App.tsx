import { useEffect, useState } from 'react'
import { StarField } from "./components/StarField";
import { Navbar } from './components/Navbar';
import type { User } from './components/Navbar';
import { AuthModal } from "./components/AuthModal";
import { ExploreView } from "./components/ExploreView";

import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [observed, setObserved] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    // If VITE_API_URL is blank (dev), it uses relative paths.
    // If it's populated (production), it uses the Cloud Run URL.
    const apiBase = import.meta.env.VITE_API_URL || '';

    fetch(`${apiBase}/api/test`)
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(error => console.error('Error:', error))
  }, [])

  const toggleObserved = (id: number) => {
    setObserved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="size-full flex flex-col relative overflow-hidden">
      {/* TODO delete usage of message below when search API is ready */}
      <p className="sr-only">{message}</p>
      {/* Star field background */}
      <div className="absolute inset-0 pointer-events-none">
        <StarField />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14, 20, 60, 0.6) 0%, transparent 70%)",
          }} />
      </div>
      <Navbar
        user={user}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={() => { setUser(null); setObserved(new Set()); }}
      />
      {/* Hero */}
      <div className="hero min-h-80">
        <div className="hero-content text-center">
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold">Explore the Night Sky</h1>
            <p className="mt-8">
              Search and filter hundreds of celestial objects. Track what you've observed and share conditions with the community.
            </p>
          </div>
        </div>
      </div>
      {/* Explore View */}
      <main className="overflow-y-auto px-4 pb-8 pt-1 max-w-6xl mx-auto w-full">
        <ExploreView
          observed={observed}
          onToggleObserved={toggleObserved}
          isLoggedIn={!!user}
          onLoginRequired={() => setAuthOpen(true)}/>
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={(u) => {
          setUser(u);
          // may need to do other things here idk yet
        }}
      />
    </div>
  );
}

export default App
