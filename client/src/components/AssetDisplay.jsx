import { useEffect, useState } from "react";

function AssetCard({ asset }) {
  return (
    <div className="assetCard">
      <h2>{asset.satname}</h2>

      <p>NORAD ID: {asset.satid}</p>
      <p>International Designator: {asset.intDesignator}</p>
      <p>Launch Date: {asset.launchDate}</p>
      <p>Latitude: {asset.satlat.toFixed(2)}°</p>
      <p>Longitude: {asset.satlng.toFixed(2)}°</p>
      <p>Distance from Earth: {asset.satalt.toFixed(2)} km</p>
    </div>
  );
}

export function AssetDisplay() {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    async function fetchAssets() {
      const response = await fetch("http://localhost:3000/api/assets");
      const data = await response.json();

      console.log("backend data:", data);

      setAssets(data.above || []);
    }

    fetchAssets();
  }, []);

  return (
    <section className="assetGrid">
      {assets.map((asset) => (
        <AssetCard key={asset.satid} asset={asset} />
      ))}
    </section>
  );
}