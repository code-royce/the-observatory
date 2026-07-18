import { useEffect, useState } from 'react'
import { StarField } from "./components/StarField";
import { AuthModal } from "./components/AuthModal";
import { ExploreView } from "./components/ExploreView";
import { ChevronDown, CircleUserRound, LogOut } from 'lucide-react';

import './App.css'

interface User {
  name: string;
  email: string;
}

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
      {/* Navbar */}
      <header className="navbar bg-base-200 shadow-sm">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /> </svg>
            </div>
            {/* Mobile menu */}
            <ul
              tabIndex={-1}
              className="menu dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow">
              <li><a href='#'>Explore</a></li>
              <li><a href='#'>My Log</a></li>
              <li><a href='#'>Community</a></li>
              <li></li>
              {user ? (
                <>
                  <li className="px-3 py-1.5 text-xs">Signed in as {user.name}</li>
                  <li>
                    <a href="#">
                      <CircleUserRound className="size-[1.2em]" />Account
                    </a>
                  </li>
                  <li>
                    <button
                      onClick={() => { setUser(null); setObserved(new Set()); }}
                    >
                      <LogOut className="size-[1.2em]" />Sign out
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <button onClick={() => setAuthOpen(true)}>
                    <CircleUserRound className="size-[1.2em]" />Sign in
                  </button>
                </li>
              )}
            </ul>
          </div>
          <a href='#' className="btn btn-ghost text-xl">The Observatory</a>
        </div>
        {/* Desktop menu */}
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1">
            <li><a href='#'>Explore</a></li>
            <li><a href='#'>My Log</a></li>
            <li><a href='#'>Community</a></li>
          </ul>
        </div>
        <div className="navbar-end">
          {user ? (
            <div className="dropdown dropdown-end hidden md:block">
              <div tabIndex={0} role="button" className="btn btn-warning rounded-field transition-colors">
                {user.name}<ChevronDown className="size-[1.2em]"/>
              </div>
              <ul
                tabIndex={-1}
                className="menu dropdown-content bg-base-200 rounded-box z-1 mt-4 w-52 p-2 shadow-sm"
              >
                <li>
                  <a href="#">
                    <CircleUserRound className="size-[1.2em]" />Account
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => { setUser(null); setObserved(new Set()); }}
                  >
                    <LogOut className="size-[1.2em]" />Sign out
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="btn btn-warning hidden md:inline-flex"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
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
          // made need to do other things here idk yet
        }}
      />
    </div>
  )
}

export default App
