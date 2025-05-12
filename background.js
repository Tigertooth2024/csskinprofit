let isScanning = false;
let scanInterval = null;
let scannedCount = 0;
let matchedCount = 0;
let deals = [];
let listingsMap = new Map();
let settings = {
  skins: [],
  discount: 5,
  minPrice: 0,
  maxPrice: 9999
};

const MAX_LISTINGS = 500;
const SKINPORT_API_BASE = "https://api.skinport.com/v1";
const SKINPORT_CURRENCY = "USD";
const SKINPORT_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
let skinportCache = new Map();

function log(...args) {
  console.log("[BG]", ...args);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "startScanning":
      startScanLoop();
      sendResponse({ started: true });
      break;
    case "pauseScanning":
      stopScanLoop();
      sendResponse({ paused: true });
      break;
    case "resetCounters":
      scannedCount = 0;
      matchedCount = 0;
      deals = [];
      listingsMap.clear();
      sendResponse({ reset: true });
      break;
    case "saveSettings":
      settings = {
        ...request.settings,
        minPrice: Number(request.settings.minPrice),
        maxPrice: Number(request.settings.maxPrice)
      };
      sendResponse({ saved: true });
      break;
    case "getSettings":
      sendResponse(settings);
      break;
    case "getStats":
      sendResponse({ scannedCount, matchedCount });
      break;
    case "getDeals":
      sendResponse({ deals });
      break;
  }
});

function startScanLoop() {
  if (isScanning) return;
  log("✅ Scan loop started");
  isScanning = true;
  scanCsfloatListings();
  scanInterval = setInterval(scanCsfloatListings, 30000);
  log("⏱️ Scanning interval set");
}

function stopScanLoop() {
  if (!isScanning) return;
  clearInterval(scanInterval);
  scanInterval = null;
  isScanning = false;
  log("⏹️ Scan loop stopped");
}

async function scanCsfloatListings() {
  log("⏱️ Scanning...");
  const url = "https://csfloat.com/api/v1/listings?limit=39&sort=created&order=desc";

  try {
    const res = await fetch(url);
    if (!res.ok) {
      log("❌ Failed to fetch CSFloat listings");
      return;
    }

    const data = await res.json();
    const items = data?.data || [];

    for (const item of items) {
      const id = item.id;
      if (listingsMap.has(id)) continue;

      const name = item.market_hash_name;
      const price = parseFloat(item.price.toFixed(2));
      const url = `https://csfloat.com/item/${item.id}`;
      const createdAt = item.created_at || new Date().toISOString();

      const matchesSearch = settings.skins.length === 0 || settings.skins.some(keyword =>
        name.toLowerCase().includes(keyword.toLowerCase())
      );

      const matchesPrice = price >= settings.minPrice && price <= settings.maxPrice;
      if (!matchesSearch || !matchesPrice) continue;

      const skinportData = await getSkinportData(name);
      if (skinportData) {
        const isDeal = checkDeal(price, skinportData);
        if (isDeal) {
          matchedCount++;
          deals.push({ timestamp: createdAt, name, price, url });
          chrome.runtime.sendMessage({ action: "dealFound", timestamp: createdAt, name, price, url });
        }
      }

      if (listingsMap.size >= MAX_LISTINGS) {
        const oldestKey = listingsMap.keys().next().value;
        listingsMap.delete(oldestKey);
      }

      listingsMap.set(id, { name, price, url });
    }

    scannedCount += items.length;
    chrome.runtime.sendMessage({ action: "updateStats", scanned: scannedCount, matched: matchedCount });
  } catch (err) {
    log("❌ Scan error:", err);
  }
}

async function getSkinportData(skinName) {
  const now = Date.now();
  if (skinportCache.has(skinName)) {
    const cached = skinportCache.get(skinName);
    if (now - cached.timestamp < SKINPORT_CACHE_DURATION) {
      return cached.data;
    }
  }

  try {
    const params = new URLSearchParams({
      app_id: "730",
      currency: SKINPORT_CURRENCY,
      market_hash_name: skinName
    });

    const response = await fetch(`${SKINPORT_API_BASE}/sales/history?${params}`);
    if (response.ok) {
      const data = await response.json();
      skinportCache.set(skinName, { data, timestamp: now });
      return data;
    } else {
      log(`❌ Failed Skinport fetch: ${response.status}`);
    }
  } catch (error) {
    log(`❌ Error fetching Skinport data for "${skinName}":`, error);
  }

  return null;
}

function checkDeal(price, skinportData) {
  const item = skinportData.find(entry => entry.market_hash_name);
  if (!item || !item.stats_90d?.avg_price) return false;

  const avgPrice = item.stats_90d.avg_price;
  return price < avgPrice * (1 - settings.discount / 100);
}
