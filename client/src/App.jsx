import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/HomePage";
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}

export default App
