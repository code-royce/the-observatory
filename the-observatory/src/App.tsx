import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { flaskFetch } from './components/api';
import { StarField } from "./components/StarField";
import { Navbar } from './components/Navbar';
import type { Tab } from './components/Navbar';
import { AuthModal } from "./components/AuthModal";
import type { SearchData } from './components/ExploreView';
import { ExploreView } from "./components/ExploreView";
import { ConstellationsView } from './components/ConstellationsView';
import { CommunityReports } from './components/CommunityReports';
import { MyLists } from "./components/MyLists";
import { ListDetail } from "./components/ListDetail";
import type { ObjectType, ObservationList, User } from './components/types';
import { useGeolocation } from "./components/useGeolocation";

import './App.css'

interface ObservationListRow {
  ListID: number;
  UserID: number;
  ListName: string;
  Latitude: number | null;
  Longitude: number | null;
  CreatedAt: string;
  ObjectCount: number;
}

function mapObservationList(row: ObservationListRow): ObservationList {
  return {
    listID: row.ListID,
    userID: row.UserID,
    name: row.ListName,
    lat: row.Latitude !== null ? String(row.Latitude) : "",
    lon: row.Longitude !== null ? String(row.Longitude) : "",
    createdAt: row.CreatedAt,
    objectCount: row.ObjectCount,
  };
}

// Signing in only takes an email, so nothing secret is kept here -- this is
// just so a refresh doesn't drop the session.
const USER_STORAGE_KEY = 'observatory.user';

function readStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    // Corrupt entry, or storage blocked in this browser.
    return null;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [authOpen, setAuthOpen] = useState(false);
  const [lists, setLists] = useState<ObservationList[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchData | null>(null);
  const [loadingSearchResults, setLoadingSearchResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<Set<ObjectType>>(new Set());
  const [visibleTonight, setVisibleTonight] = useState(true);
  const [myListsView, setMyListsView] = useState<"grid" | number>("grid");
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    coordinates, locationError, locating, requestLocation, setCoordinates
  } = useGeolocation();

  useEffect(() => {
    if (locationError) {
      console.error(
        'Geolocation error:', locationError.code, locationError.message
      );
    }
  }, [locationError]);

  // Everything the user clicks goes through here. flaskFetch throws with the
  // server's own message, so a rejected constraint or a 409 arrives as text
  // worth showing rather than a console line nobody reads.
  const runAction = async <T,>(
    action: () => Promise<T>, onFailure: T
  ): Promise<T> => {
    setActionError(null);
    try {
      return await action();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Something went wrong.'
      );
      return onFailure;
    }
  };

  const fetchLists = async (userId: number) => {
    try {
      const res = await flaskFetch<{ data: ObservationListRow[]; total: number }>(
        `/api/users/${userId}/lists`
      );
      setLists(res.data.map(mapObservationList));
    } catch (error) {
      console.error('Failed to fetch observation lists:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLists(user.id);
    } else {
      setLists([]);
      setMyListsView('grid');
    }
  }, [user]);

  const handleCreateList = async (
    name: string, lat: string, lng: string
  ): Promise<ObservationList | null> => {
    if (!user) return null;
    return runAction(async () => {
      const body: Record<string, unknown> = { user_id: user.id, list_name: name };
      if (lat) body.latitude = Number(lat);
      if (lng) body.longitude = Number(lng);
      const res = await flaskFetch<{ data: ObservationListRow }>('/api/lists', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const created = mapObservationList({ ...res.data, ObjectCount: 0 });
      setLists((prev) => [created, ...prev]);
      return created;
    }, null);
  };

  const handleDeleteList = async (listId: number): Promise<boolean> => {
    return runAction(async () => {
      await flaskFetch(`/api/lists/${listId}`, { method: 'DELETE' });
      setLists((prev) => prev.filter((l) => l.listID !== listId));
      setMyListsView((v) => (v === listId ? "grid" : v));
      return true;
    }, false);
  };

  const handleUpdateList = async (
    listId: number,
    patch: Partial<Pick<ObservationList, "name" | "lat" | "lon">>
  ): Promise<boolean> => {
    return runAction(async () => {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.list_name = patch.name;
      if (patch.lat) body.latitude = Number(patch.lat);
      if (patch.lon) body.longitude = Number(patch.lon);
      const res = await flaskFetch<{ data: ObservationListRow }>(`/api/lists/${listId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setLists((prev) => prev.map((l) => l.listID === listId
        ? { ...mapObservationList(res.data), objectCount: l.objectCount }
        : l));
      return true;
    }, false);
  };

  const handleAddObjectToList = async (
    listId: number, objectId: number
  ): Promise<boolean> => {
    return runAction(async () => {
      const res = await flaskFetch<{ data: { added: number } }>(
        `/api/lists/${listId}/objects`,
        { method: 'POST', body: JSON.stringify({ object_ids: [objectId] }) }
      );
      setLists((prev) => prev.map((l) => l.listID === listId
        ? { ...l, objectCount: l.objectCount + res.data.added }
        : l));
      return true;
    }, false);
  };

  const handleRemoveObjectFromList = async (
    listId: number, objectId: number
  ): Promise<boolean> => {
    return runAction(async () => {
      await flaskFetch(`/api/lists/${listId}/objects/${objectId}`, { method: 'DELETE' });
      setLists((prev) => prev.map((l) => l.listID === listId
        ? { ...l, objectCount: Math.max(0, l.objectCount - 1) }
        : l));
      return true;
    }, false);
  };

  const handleUpdateSavedObject = async (
    listId: number,
    objectId: number,
    patch: { is_observed?: boolean; notes?: string | null }
  ): Promise<boolean> => {
    return runAction(async () => {
      await flaskFetch(`/api/lists/${listId}/objects/${objectId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return true;
    }, false);
  };

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

  const activeList = myListsView !== "grid" ? lists.find((l) => l.listID === myListsView) ?? null : null;

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
        onSignOut={() => {
          localStorage.removeItem(USER_STORAGE_KEY);
          setUser(null); setLists([]); setMyListsView('grid');
        }}
        // Errors belong to the thing that was clicked, so they don't follow
        // the user to another tab.
        onSetActiveTab={(tabId: Tab) => { setActiveTab(tabId); setActionError(null); }}
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
            lists={lists}
            onAddToList={handleAddObjectToList}
            onCreateList={handleCreateList}
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
            onToggleVisibility={handleToggleVisibility}
            hasLocation={
              typeof coordinates.lat === 'number'
              && typeof coordinates.lng === 'number'
            }
            onRequestLocation={requestLocation}
            locating={locating} />
        </div>
        <div className={`${activeTab !== 'constellations' ? 'hidden' : ''}`}>
          <ConstellationsView
            isLoggedIn={!!user}
            onLoginRequired={() => setAuthOpen(true)}
            latitude={coordinates.lat}
            longitude={coordinates.lng}
            onRequestLocation={requestLocation}
            locating={locating}
            currentUserID={user?.id}
            onListsChanged={() => { if (user) fetchLists(user.id); }}
          />
        </div>
        <div className={`${activeTab !== 'lists' || !user ? 'hidden' : ''}`}>
          {myListsView === 'grid' ? (
            <MyLists lists={lists} userName={user?.name ?? ""}
              onCreate={handleCreateList}
              onDeleteList={handleDeleteList}
              onSelectList={(id) => setMyListsView(id)}/>
          ) : ( activeList ? (
            <ListDetail list={activeList}
              onBack={() => setMyListsView('grid')}
              onUpdate={handleUpdateList}
              onDelete={() => handleDeleteList(activeList.listID)}
              onRemoveItem={handleRemoveObjectFromList}
              onUpdateSavedObject={handleUpdateSavedObject}/>
          ) : (
            // Fall back to grid if list was deleted from elsewhere
            <MyLists lists={lists} userName={user?.name ?? ""}
              onCreate={handleCreateList}
              onDeleteList={handleDeleteList}
              onSelectList={(id) => setMyListsView(id)}
            />
          ))}
        </div>
        <div className={`${activeTab !== 'community' ? 'hidden' : ''}`}>
          <CommunityReports
            isLoggedIn={!!user}
            onLoginRequired={() => setAuthOpen(true)}
            latitude={coordinates.lat}
            longitude={coordinates.lng}
            onSetLatitude={(lat) => setCoordinates({ lat })}
            onSetLongitude={(lng) => setCoordinates({ lng })}
            onRequestLocation={requestLocation}
            locating={locating}
            locationError={locationError}
            currentUserID={user?.id}
          />
        </div>
      </main>

      {/* One place for anything the user clicked that the database refused,
        so constraint messages reach them instead of the console. */}
      {actionError && (
        <div className="toast toast-center toast-bottom z-50">
          <div role="alert" className="alert alert-error">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)}
              className="btn btn-square btn-xs btn-soft"
            >
              <X size={14} />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      )}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={(u: User) => {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
          setUser(u); setActiveTab('explore');
        }}
      />
    </div>
  );
}

export default App
