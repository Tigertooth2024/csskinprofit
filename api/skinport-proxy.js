export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: "Missing market_hash_name" });
  }

  const apiUrl = `https://api.skinport.com/v1/items?app_id=730&currency=USD&market_hash_name=${encodeURIComponent(name)}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch Skinport data" });
  }
}
