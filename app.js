import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const SUGGESTIONS = [
  ["Samsung Electronics", "005930", "KRX"],
  ["KODEX 200", "069500", "KRX"],
  ["TIGER CD Interest", "357870", "KRX"],
  ["Apple", "AAPL", "US"],
  ["Microsoft", "MSFT", "US"],
  ["Vanguard S&P 500 ETF", "VOO", "US"],
  ["Invesco QQQ Trust", "QQQ", "US"],
  ["Cash", "CASH", "CASH"],
  ["Manual asset", "MANUAL", "MANUAL"],
];

const firebaseConfig = window.assetTrailFirebase || {};
const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = firebaseReady ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const provider = new GoogleAuthProvider();

const elements = {
  authStatus: document.querySelector("#authStatus"),
  signInButton: document.querySelector("#signInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  assetForm: document.querySelector("#assetForm"),
  assetType: document.querySelector("#assetType"),
  assetName: document.querySelector("#assetName"),
  assetTicker: document.querySelector("#assetTicker"),
  quantity: document.querySelector("#quantity"),
  averagePrice: document.querySelector("#averagePrice"),
  manualValueInput: document.querySelector("#manualValueInput"),
  assetSuggestions: document.querySelector("#assetSuggestions"),
  tickerSuggestions: document.querySelector("#tickerSuggestions"),
  assetList: document.querySelector("#assetList"),
  emptyState: document.querySelector("#emptyState"),
  totalCost: document.querySelector("#totalCost"),
  manualValue: document.querySelector("#manualValue"),
  assetCount: document.querySelector("#assetCount"),
};

let unsubscribeAssets = null;
let currentUser = null;

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function parseAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function setFormEnabled(enabled) {
  const fields = elements.assetForm.querySelectorAll("input, select, button");
  fields.forEach((field) => {
    field.disabled = !enabled;
  });
}

function renderSuggestions() {
  elements.assetSuggestions.innerHTML = SUGGESTIONS.map(
    ([name]) => `<option value="${name}"></option>`,
  ).join("");
  elements.tickerSuggestions.innerHTML = SUGGESTIONS.map(
    ([, ticker]) => `<option value="${ticker}"></option>`,
  ).join("");
}

function syncSuggestionFromName() {
  const match = SUGGESTIONS.find(([name]) => name === elements.assetName.value);

  if (!match) {
    return;
  }

  const [, ticker, type] = match;
  elements.assetTicker.value = ticker;
  elements.assetType.value = type;
  updateManualValueState();
}

function syncSuggestionFromTicker() {
  const input = elements.assetTicker.value.trim().toUpperCase();
  const match = SUGGESTIONS.find(([, ticker]) => ticker === input);

  elements.assetTicker.value = input;

  if (!match) {
    return;
  }

  const [name, , type] = match;
  elements.assetName.value = name;
  elements.assetType.value = type;
  updateManualValueState();
}

function updateManualValueState() {
  const canUseManualValue = ["CASH", "MANUAL"].includes(elements.assetType.value);
  elements.manualValueInput.disabled = !canUseManualValue || !currentUser;

  if (!canUseManualValue) {
    elements.manualValueInput.value = "";
  }
}

function renderAssets(assets) {
  const totalCost = assets.reduce((sum, asset) => sum + asset.quantity * asset.averagePrice, 0);
  const manualValue = assets.reduce((sum, asset) => sum + (asset.manualValue || 0), 0);

  elements.totalCost.textContent = formatNumber(totalCost);
  elements.manualValue.textContent = formatNumber(manualValue);
  elements.assetCount.textContent = String(assets.length);
  elements.emptyState.hidden = assets.length > 0;

  elements.assetList.innerHTML = assets
    .map(
      (asset) => `
        <article class="asset-row">
          <div>
            <strong>${asset.name}</strong>
            <span>${asset.type} · ${asset.ticker}</span>
          </div>
          <div>
            <strong>${formatNumber(asset.quantity)}</strong>
            <span>Avg ${formatNumber(asset.averagePrice)}</span>
          </div>
          <button type="button" data-delete-id="${asset.id}" aria-label="Delete ${asset.name}">Delete</button>
        </article>
      `,
    )
    .join("");
}

function watchAssets(user) {
  if (unsubscribeAssets) {
    unsubscribeAssets();
  }

  const assetsQuery = query(
    collection(db, "users", user.uid, "assets"),
    orderBy("createdAt", "desc"),
  );

  unsubscribeAssets = onSnapshot(assetsQuery, (snapshot) => {
    const assets = snapshot.docs.map((assetDoc) => ({
      id: assetDoc.id,
      ...assetDoc.data(),
    }));
    renderAssets(assets);
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    return;
  }

  const type = elements.assetType.value;
  const manualValue = ["CASH", "MANUAL"].includes(type)
    ? parseAmount(elements.manualValueInput.value)
    : null;

  await addDoc(collection(db, "users", currentUser.uid, "assets"), {
    type,
    name: elements.assetName.value.trim(),
    ticker: elements.assetTicker.value.trim().toUpperCase(),
    quantity: parseAmount(elements.quantity.value),
    averagePrice: parseAmount(elements.averagePrice.value),
    manualValue,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  elements.assetForm.reset();
  updateManualValueState();
}

async function handleDelete(event) {
  const deleteId = event.target.dataset.deleteId;

  if (!deleteId || !currentUser) {
    return;
  }

  await deleteDoc(doc(db, "users", currentUser.uid, "assets", deleteId));
}

function renderAuthState(user) {
  currentUser = user;
  elements.signInButton.hidden = Boolean(user);
  elements.signOutButton.hidden = !user;
  elements.authStatus.textContent = user ? user.email || "Signed in" : "Signed out";
  setFormEnabled(Boolean(user));
  updateManualValueState();

  if (user) {
    watchAssets(user);
    return;
  }

  if (unsubscribeAssets) {
    unsubscribeAssets();
    unsubscribeAssets = null;
  }

  renderAssets([]);
}

function bindEvents() {
  elements.signInButton.addEventListener("click", () => signInWithPopup(auth, provider));
  elements.signOutButton.addEventListener("click", () => signOut(auth));
  elements.assetForm.addEventListener("submit", handleSubmit);
  elements.assetType.addEventListener("change", updateManualValueState);
  elements.assetName.addEventListener("change", syncSuggestionFromName);
  elements.assetTicker.addEventListener("change", syncSuggestionFromTicker);
  elements.assetList.addEventListener("click", handleDelete);
}

renderSuggestions();
setFormEnabled(false);
updateManualValueState();
bindEvents();

if (firebaseReady) {
  onAuthStateChanged(auth, renderAuthState);
} else {
  elements.authStatus.textContent = "Firebase config needed";
  elements.signInButton.disabled = true;
}
