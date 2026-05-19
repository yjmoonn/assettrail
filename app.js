(function () {
  const app = document.querySelector("#app");
  const firebaseProjectId = window.assetTrailFirebase?.projectId || "not configured";
  const baseCurrency = window.assetTrailPrices?.baseCurrency || "USD";
  const trackedAssets = window.assetTrailPrices?.trackedAssets || [];

  const items = [
    ["Firebase", firebaseProjectId],
    ["Base currency", baseCurrency],
    ["Tracked assets", trackedAssets.length ? trackedAssets.join(", ") : "none yet"],
  ];

  app.innerHTML = items
    .map(
      ([label, value]) => `
        <article class="status-card">
          <strong>${label}</strong>
          <span>${value}</span>
        </article>
      `,
    )
    .join("");
})();

