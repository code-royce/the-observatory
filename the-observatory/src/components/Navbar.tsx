import { ChevronDown, CircleUserRound, LogOut } from 'lucide-react';

export type User = {
  name: string;
  email: string;
};

/**
 *
 * @param User  the custom user type with a name and email
 * @param onSignIn  function for the sign in button
 * @param onSignOut  function for the sign in button
 */
interface NavbarProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Navbar({user, onSignIn, onSignOut}: NavbarProps) {
  return (
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
                  <button onClick={() => onSignOut()}>
                    <LogOut className="size-[1.2em]" />Sign out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <button onClick={() => onSignIn()}>
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
            <div
              tabIndex={0}
              role="button"
              className="btn btn-warning rounded-field transition-colors"
            >
              {user.name}<ChevronDown className="size-[1.2em]" />
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
                <button onClick={() => onSignOut()}>
                  <LogOut className="size-[1.2em]" />Sign out
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <button
            onClick={() => onSignIn()}
            className="btn btn-warning hidden md:inline-flex"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
