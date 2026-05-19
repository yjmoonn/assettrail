(function () {
  const app = document.querySelector("#app");

  if (!app) {
    return;
  }

  const firebaseConfig = window.assetTrailFirebase || {};
  const firebaseProjectId = firebaseConfig.projectId || "not configured";
  const firebaseAuthDomain = firebaseConfig.authDomain || "not configured";
  const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

  const items = [
    ["Firebase project", firebaseProjectId],
    ["Auth domain", firebaseAuthDomain],
    ["Sync status", hasFirebaseConfig ? "ready for Firebase integration" : "configuration needed"],
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
