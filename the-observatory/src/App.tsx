// import { useState } from 'react'
import './App.css'

function App() {
  // const [count, setCount] = useState(0)

  return (
    <>
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
          <a href='#' className="btn">Sign in</a>
        </div>
      </header>

      <div className="hero bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold">Explore the Night Sky</h1>
            <p className="mt-8">
              Search and filter hundreds of celestial objects. Track what you've observed and share conditions with the community.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
