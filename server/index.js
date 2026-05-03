require("dotenv").config();
console.log("Current folder:", process.cwd());
console.log("Loaded API key?", process.env.N2YO_API_KEY ? "yes" : "no");

const express = require("express");
const cors = require("cors");


const app = express();
const port = 3000;

app.use(cors({
  origin: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, Express is installed!");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/assets", async (req, res) => {
  try {
    const apiKey = process.env.N2YO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing N2YO_API_KEY in .env" });
    }

    const lat = req.query.lat || 28.5;
    const lng = req.query.lng || -81.4;
    const alt = req.query.alt || 0;
    const radius = req.query.radius || 90;
    const category = req.query.category || 0;

    const url = `https://api.n2yo.com/rest/v1/satellite/above/${lat}/${lng}/${alt}/${radius}/${category}/&apiKey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("Error fetching N2YO data:", error);
    res.status(500).json({ error: "Failed to fetch satellite data" });
  }
});

console.log("CORS backend file is running");

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});