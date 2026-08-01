import { useEffect, useMemo, useState } from 'react';
import { flaskFetch } from './components/api';
import { StarField } from "./components/StarField";
import { Navbar } from './components/Navbar';
import type { Tab } from './components/Navbar';
import { AuthModal } from "./components/AuthModal";
import type { SearchData } from './components/ExploreView';
import { ExploreView } from "./components/ExploreView";
import { CommunityReports } from './components/CommunityReports';
import { ConstellationsView } from './components/ConstellationsView';
import type { ObjectType, ObservationList, User } from './components/types';
import { useGeolocation } from "./components/useGeolocation";

import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [lists, setLists] = useState<ObservationList[]>([]);
  // TODO: do I still need observed after converting from 1 observation list max to multiple?
  const [observed, setObserved] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchData | null>(null);
  const [loadingSearchResults, setLoadingSearchResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<Set<ObjectType>>(new Set());
  const [visibleTonight, setVisibleTonight] = useState(true);

  // TODO: maybe? without loaded, when the geoloc request finishes,
  // error is null and coordinates are empty strings. Doesn't distinguish
  // between waiting and "failed with no message", but not sure if problematic
  const { coordinates, locationError } = useGeolocation();

  useEffect(() => {
    if (locationError) {
      console.error(
        'Geolocation error:', locationError.code, locationError.message
      );
    }
  }, [locationError]);

  const allObservedIds = useMemo(
    () => new Set(lists.flatMap((l) => l.items.map((i) => i.ObjectID))),
    [lists]
  );

  // TODO: finish list helpers section

  const handleSearch = async (query: string, page?: number, types?: Set<ObjectType>, visible?: boolean) => {
    setLoadingSearchResults(true);
    const useVisible = visible ?? visibleTonight;
    try {
      const params = new URLSearchParams();
      params.set('q', query);
      if (page) params.set('page', String(page));
      types?.forEach((t) => params.append('types', t));

      let endpoint: string;
      if (useVisible && coordinates.lat && coordinates.lng) {
        params.set('lat', String(coordinates.lat));
        params.set('lon', String(coordinates.lng));
        endpoint = `/api/visible-search?${params.toString()}`;
      } else {
        endpoint = `/api/search?${params.toString()}`;
      }

      const results = await flaskFetch<SearchData>(endpoint);
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

  const handleToggleVisibility = (on: boolean) => {
    setVisibleTonight(on);
    setCurrentPage(1);
    handleSearch(searchQuery, undefined, selectedTypes, on);
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
        activeTab={activeTab}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={() => { setUser(null); setLists([]); setObserved(new Set()); }}
        onSetActiveTab={(tabId: Tab) => setActiveTab(tabId)}
      />
      {/* Hero banner - explore only */}
      <div className={`hero min-h-80${activeTab !== 'explore' ? ' hidden' : ''}`}>
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
        <div className={`${activeTab !== 'explore' ? 'hidden' : ''}`}>
          <ExploreView
            allObservedIds={allObservedIds}
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
            onClearTypes={clearTypes}
            visibleTonight={visibleTonight}
            onToggleVisibility={handleToggleVisibility} />
        </div>
        <div className={`${activeTab !== 'constellations' ? 'hidden' : ''}`}>
          <ConstellationsView
            isLoggedIn={!!user}
            onLoginRequired={() => setAuthOpen(true)}
            latitude={coordinates.lat}
            longitude={coordinates.lng}
            currentUserID={user?.id}
          />
        </div>
        <div className={`${activeTab !== 'community' ? 'hidden' : ''}`}>
          <CommunityReports
            isLoggedIn={!!user}
            onLoginRequired={() => setAuthOpen(true)}
            latitude={coordinates.lat}
            longitude={coordinates.lng}
            onSetLatitude={(lat: number) => { coordinates.lat = lat; }}
            onSetLongitude={(lon: number) => { coordinates.lng = lon; }}
            currentUserID={user?.id}
          />
        </div>
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={(u: User) => setUser(u)}
      />
    </div>
  );
}

export default App
