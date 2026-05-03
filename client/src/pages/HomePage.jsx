import '../App.css'
import { Navbar } from '../components/Nav.jsx';
import { AssetDisplay } from '../components/AssetDisplay.jsx';
import Globe from "../components/Globe";

function HomePage() {
  return (
    <main className='home'>
        <Globe />
    </main>
  );
}

export default HomePage;