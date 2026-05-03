const assets = [
  {
    id: "SAT-001",
    name: "Alpha",
    type: "Satellite",
    status: "ONLINE",
    battery: 87,
    temperature: 42,
    signalStrength: 91,
    lastUpdated: new Date().toISOString()
  },
    {
    id: "SAT-002",
    name: "Sidra",
    type: "Satellite",
    status: "OFFLINE",
    battery: 0,
    temperature: 42,
    signalStrength: 91,
    lastUpdated: new Date().toISOString()
  },
    {
    id: "SAT-003",
    name: "Astraea",
    type: "Launch Vehicle",
    status: "ONLINE",
    battery: 92,
    temperature: 82,
    signalStrength: 99,
    lastUpdated: new Date().toISOString()
  },
    {
    id: "SAT-004",
    name: "Nefeli",
    type: "Crew Capsule",
    status: "WARNINGS",
    battery: 34,
    temperature: 63,
    signalStrength: 90,
    lastUpdated: new Date().toISOString()
  },
    {
    id: "SAT-005",
    name: "Helios",
    type: "Satellite",
    status: "CRITICAL",
    battery: 92,
    temperature: 24,
    signalStrength: 76,
    lastUpdated: new Date().toISOString()
  }
];

module.exports = assets;