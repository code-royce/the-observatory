import { useState } from 'react';
import { flaskFetch } from './components/api';
import { StarField } from "./components/StarField";
import { Navbar } from './components/Navbar';
import type { User } from './components/Navbar';
import { AuthModal } from "./components/AuthModal";
import type { SearchData } from './components/ExploreView';
import { ExploreView } from "./components/ExploreView";
import type { ObjectType } from './components/data';

import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [observed, setObserved] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchData | null>(null);
  const [loadingSearchResults, setLoadingSearchResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<Set<ObjectType>>(new Set());

  const handleSearch = async (query: string, page?: number, types?: Set<ObjectType>) => {
    setLoadingSearchResults(true);
    try {
      const params = new URLSearchParams();
      params.set('q', query);
      if (page) params.set('page', String(page));
      types?.forEach((t) => params.append('types', t));

      const results = await flaskFetch<SearchData>(`/api/search?${params.toString()}`);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to fetch search results:', error);
    } finally {
      setLoadingSearchResults(false);
    }
  };

  const toggleType = (t: ObjectType) => {
    const next = new Set(selectedTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setSelectedTypes(next);
    setCurrentPage(1);
    handleSearch(searchQuery, undefined, next);
  };

  const clearTypes = () => {
    setSelectedTypes(new Set());
    setCurrentPage(1);
    handleSearch(searchQuery, undefined, new Set());
  };

  const toggleObserved = (id: number) => {
    setObserved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Star field background */}
      <div className="absolute inset-0 -z-1 pointer-events-none">
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
      <main className="px-4 pb-8 pt-1 max-w-6xl mx-auto w-full">
        <ExploreView
          observed={observed}
          onToggleObserved={toggleObserved}
          isLoggedIn={!!user}
          onLoginRequired={() => setAuthOpen(true)}
          query={searchQuery}
          onSetQuery={(q: string) => setSearchQuery(q)}
          onSearch={() => {
            setCurrentPage(1);
            handleSearch(searchQuery, undefined, selectedTypes);
          }}
          loadingResults={loadingSearchResults}
          results={searchResults}
          currentPage={currentPage}
          onSetCurrentPage={(page: number) => {
            setCurrentPage(page);
            handleSearch(searchQuery, page, selectedTypes);
          }}
          selectedTypes={selectedTypes}
          onToggleType={toggleType}
          onClearTypes={clearTypes}/>
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
