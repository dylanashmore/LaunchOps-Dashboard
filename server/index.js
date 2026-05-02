const express = require('express');
const assets = require("./data/assets");
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello, Express is installed!');
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/assets", (req, res) => {
  res.json(assets);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});