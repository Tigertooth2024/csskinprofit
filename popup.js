// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("scanBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const saveBtn = document.getElementById("saveBtn");

  const skinsInput = document.getElementById("skins");
  const discountInput = document.getElementById("discount");
  const minPriceInput = document.getElementById("minPrice");
  const maxPriceInput = document.getElementById("maxPrice");

  const scannedCountEl = document.getElementById("scannedCount");
  const matchedCountEl = document.getElementById("matchedCount");
  const debugOutput = document.getElementById("debugOutput");
  const matchedListings = document.getElementById("matchedListings");
  const spinner = document.getElementById("spinner");

  function updateStats() {
    chrome.runtime.sendMessage({ action: "getStats" }, (stats) => {
      if (chrome.runtime.lastError) return;
      scannedCountEl.textContent = stats?.scannedCount || 0;
      matchedCountEl.textContent = stats?.matchedCount || 0;
    });
  }

  function loadSettings() {
    chrome.runtime.sendMessage({ action: "getSettings" }, (settings) => {
      if (chrome.runtime.lastError) return;
      if (settings) {
        skinsInput.value = (settings.skins || []).join(", ");
        discountInput.value = settings.discount || 5;
        minPriceInput.value = settings.minPrice ?? "";
        maxPriceInput.value = settings.maxPrice ?? "";
      }
    });
  }

  function saveSettings() {
    const skins = skinsInput.value.split(",").map(s => s.trim()).filter(Boolean);
    const discount = parseFloat(discountInput.value);
    const minPrice = parseFloat(minPriceInput.value);
    const maxPrice = parseFloat(maxPriceInput.value);

    chrome.runtime.sendMessage({
      action: "saveSettings",
      settings: {
        skins,
        discount: isNaN(discount) ? 5 : discount,
        minPrice: isNaN(minPrice) ? 0 : minPrice,
        maxPrice: isNaN(maxPrice) ? 9999 : maxPrice
      }
    }, (response) => {
      if (response?.saved) {
        debugOutput.textContent = "✅ Settings saved.";
      } else {
        debugOutput.textContent = "❌ Failed to save settings.";
      }
    });
  }

  function loadDeals() {
    matchedListings.innerHTML = "<strong>Deals Found</strong><br>";
    chrome.runtime.sendMessage({ action: "getDeals" }, (data) => {
      if (chrome.runtime.lastError) return;
      (data.deals || []).forEach(deal => {
        const timestamp = document.createElement("div");
        timestamp.textContent = `🕒 ${new Date(deal.timestamp).toLocaleString()}`;
        matchedListings.appendChild(timestamp);

        const link = document.createElement("a");
        link.href = deal.url;
        link.target = "_blank";
        link.textContent = `${deal.name} - $${deal.price}`;
        matchedListings.appendChild(link);
        matchedListings.appendChild(document.createElement("br"));
      });
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "updateStats") {
      scannedCountEl.textContent = msg.scanned;
      matchedCountEl.textContent = msg.matched;
    }

    if (msg.action === "dealFound") {
      const timestamp = document.createElement("div");
      timestamp.textContent = `🕒 ${new Date(msg.timestamp).toLocaleString()}`;
      matchedListings.appendChild(timestamp);

      const link = document.createElement("a");
      link.href = msg.url;
      link.target = "_blank";
      link.textContent = `${msg.name} - $${msg.price}`;
      matchedListings.appendChild(link);
      matchedListings.appendChild(document.createElement("br"));
    }
  });

  scanBtn.addEventListener("click", () => {
    spinner.style.display = "inline-block";
    chrome.runtime.sendMessage({ action: "startScanning" }, () => {
      updateStats();
      loadDeals();
    });
  });

  pauseBtn.addEventListener("click", () => {
    spinner.style.display = "none";
    chrome.runtime.sendMessage({ action: "pauseScanning" });
  });

  resetBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "resetCounters" }, () => {
      updateStats();
      matchedListings.innerHTML = "";
    });
  });

  saveBtn.addEventListener("click", saveSettings);

  loadSettings();
  updateStats();
  loadDeals();
});
