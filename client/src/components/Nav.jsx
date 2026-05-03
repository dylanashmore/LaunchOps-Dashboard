import { NavLink, Link } from "react-router-dom";
import '../App.css'

export function Navbar() {
  return (
    <header className='nav'>
        <span>LaunchOps Mission Control</span>
    <nav>
     {/* <NavLink to="/" end>Home</NavLink>
      <NavLink to="/about">About</NavLink>
      <NavLink to="/contact">Contact</NavLink> */}
    </nav>
    </header>
  );
}