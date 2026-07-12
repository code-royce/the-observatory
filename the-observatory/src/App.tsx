import { useState } from 'react'
import { StarField } from "./components/StarField";
import { ExploreView } from "./components/ExploreView";

import './App.css'

interface User {
  name: string;
  email: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [observed, setObserved] = useState<Set<string>>(new Set());

  const toggleObserved = (id: string) => {
    setObserved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="size-full flex flex-col relative overflow-hidden">
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
      <header className="navbar bg-base-100 shadow-sm">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /> </svg>
            </div>
            <ul
              tabIndex={-1}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow">
              <li><a href='#'>Explore</a></li>
              <li><a href='#'>My Log</a></li>
              <li><a href='#'>Community</a></li>
            </ul>
          </div>
          <a href='#' className="btn btn-ghost text-xl">The Observatory</a>
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1">
            <li><a href='#'>Explore</a></li>
            <li><a href='#'>My Log</a></li>
            <li><a href='#'>Community</a></li>
          </ul>
        </div>
        <div className="navbar-end">
          <a href='#' className="btn btn-warning">Sign in</a>
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

      {/* TODO: remove this dumb thing I wrote to appease the TS build settings. */}
      <>{user?.name ? <p className='sr-only'>{authOpen}</p> : setUser(user)}</>
    </div>
  )
}

export default App
