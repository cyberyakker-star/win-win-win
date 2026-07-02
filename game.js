/* ============================================================
   Win Win Win Casino — Let It Ride (play money)

   RTP disclosure (shown in the Odds modal):
     Let It Ride main game: 96.49% with optimal strategy
     Three Card Bonus:      95.80% (exact, computed from the
                            paytable over all C(52,3) hands)

   The house vault is persistent and bets are capped so the
   maximum possible payout of a single round can never exceed
   the vault — the site can always pay winners and never goes
   broke.
   ============================================================ */

"use strict";

/* ---------------- Config ---------------- */

const MAIN_PAYTABLE = [
  // [name, multiplier (to 1)]
  ["Royal Flush", 1000],
  ["Straight Flush", 200],
  ["Four of a Kind", 50],
  ["Full House", 11],
  ["Flush", 8],
  ["Straight", 5],
  ["Three of a Kind", 3],
  ["Two Pair", 2],
  ["Pair of 10s or Better", 1],
];

const BONUS_PAYTABLE = [
  ["Mini Royal", 100],
  ["Straight Flush", 50],
  ["Three of a Kind", 30],
  ["Straight", 6],
  ["Flush", 3],
  ["Pair", 1],
];

const MAX_MAIN_MULT = 1000;
const MAX_BONUS_MULT = 100;
// Worst-case exposure per unit bet: 3 riding circles hitting a royal
// plus a mini-royal bonus. Bets are capped so this always fits in the vault.
const WORST_CASE_PER_UNIT = 3 * MAX_MAIN_MULT + MAX_BONUS_MULT;

const HOUSE_SEED = 250000;
const PLAYER_SEED = 500;
const TABLE_MIN = 1;
const TABLE_MAX = 25;

const STORAGE_KEYS = { player: "www_player_chips", house: "www_house_vault" };

/* ---------------- Persistent balances ---------------- */

function loadBalance(key, fallback) {
  const raw = localStorage.getItem(key);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

let playerChips = loadBalance(STORAGE_KEYS.player, PLAYER_SEED);
let houseVault = loadBalance(STORAGE_KEYS.house, HOUSE_SEED);

function saveBalances() {
  localStorage.setItem(STORAGE_KEYS.player, String(playerChips));
  localStorage.setItem(STORAGE_KEYS.house, String(houseVault));
}

/* The table max shrinks if the vault ever gets low, so a full
   worst-case round is always payable. With a 3.5% average house
   edge the vault grows over time, so this floor is theoretical. */
function currentTableMax() {
  return Math.max(0, Math.min(TABLE_MAX, Math.floor(houseVault / WORST_CASE_PER_UNIT)));
}

/* ---------------- Cards ---------------- */

const SUITS = ["♠", "♥", "♦", "♣"];
const RANK_NAMES = { 11: "J", 12: "Q", 13: "K", 14: "A" };

function newShuffledDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  // Fisher-Yates with crypto randomness
  const rand = new Uint32Array(deck.length);
  crypto.getRandomValues(rand);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankLabel(rank) {
  return RANK_NAMES[rank] || String(rank);
}

/* ---------------- Hand evaluation ---------------- */

function countRanks(cards) {
  const counts = {};
  for (const c of cards) counts[c.rank] = (counts[c.rank] || 0) + 1;
  return counts;
}

function isFlush(cards) {
  return cards.every((c) => c.suit === cards[0].suit);
}

/* Returns the straight's high rank, or 0. Ace plays high or low. */
function straightHigh(cards) {
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== cards.length) return 0;
  if (ranks[ranks.length - 1] - ranks[0] === cards.length - 1) {
    return ranks[ranks.length - 1];
  }
  // wheel: A + lowest run (A-2-3 for 3 cards, A-2-3-4-5 for 5)
  if (ranks[ranks.length - 1] === 14) {
    const low = ranks.slice(0, -1);
    if (low[0] === 2 && low[low.length - 1] - low[0] === cards.length - 2) {
      return low[low.length - 1];
    }
  }
  return 0;
}

/* 5-card evaluation → { name, mult } or null if no pay */
function evaluateMain(cards) {
  const flush = isFlush(cards);
  const sHigh = straightHigh(cards);
  const counts = Object.values(countRanks(cards)).sort((a, b) => b - a);

  if (flush && sHigh === 14) return { name: "Royal Flush", mult: 1000 };
  if (flush && sHigh) return { name: "Straight Flush", mult: 200 };
  if (counts[0] === 4) return { name: "Four of a Kind", mult: 50 };
  if (counts[0] === 3 && counts[1] === 2) return { name: "Full House", mult: 11 };
  if (flush) return { name: "Flush", mult: 8 };
  if (sHigh) return { name: "Straight", mult: 5 };
  if (counts[0] === 3) return { name: "Three of a Kind", mult: 3 };
  if (counts[0] === 2 && counts[1] === 2) return { name: "Two Pair", mult: 2 };
  if (counts[0] === 2) {
    const byRank = countRanks(cards);
    const pairRank = Number(Object.keys(byRank).find((r) => byRank[r] === 2));
    if (pairRank >= 10) return { name: `Pair of ${rankLabel(pairRank)}s`, mult: 1 };
  }
  return null;
}

/* 3-card evaluation for the bonus bet → { name, mult } or null */
function evaluateBonus(cards) {
  const flush = isFlush(cards);
  const sHigh = straightHigh(cards);
  const counts = Object.values(countRanks(cards)).sort((a, b) => b - a);

  if (flush && sHigh === 14) return { name: "Mini Royal", mult: 100 };
  if (flush && sHigh) return { name: "Straight Flush", mult: 50 };
  if (counts[0] === 3) return { name: "Three of a Kind", mult: 30 };
  if (sHigh) return { name: "Straight", mult: 6 };
  if (flush) return { name: "Flush", mult: 3 };
  if (counts[0] === 2) return { name: "Pair", mult: 1 };
  return null;
}

/* ---------------- Game state ---------------- */

let unit = 5;
let bonusOn = false;
let deck = [];
let playerCards = [];
let communityCards = [];
let circlesRiding = [true, true, true]; // circles 1, 2, 3
let bonusBet = 0;
let phase = "betting"; // betting | decision1 | decision2 | settled

/* ---------------- DOM ---------------- */

const $ = (id) => document.getElementById(id);
const els = {
  message: $("message"),
  playerBalance: $("player-balance"),
  houseBalance: $("house-balance"),
  tableLimits: $("table-limits"),
  unitDisplay: $("unit-display"),
  totalDisplay: $("total-display"),
  bonusAmountDisplay: $("bonus-amount-display"),
  bonusCheckbox: $("bonus-checkbox"),
  dealBtn: $("deal-btn"),
  pullBtn: $("pull-btn"),
  rideBtn: $("ride-btn"),
  nextBtn: $("next-btn"),
  refillBtn: $("refill-btn"),
  betControls: $("bet-controls"),
  decisionControls: $("decision-controls"),
  nextControls: $("next-controls"),
  oddsModal: $("odds-modal"),
  oddsBtn: $("odds-btn"),
  oddsClose: $("odds-close"),
  playerSlots: [$("player-1"), $("player-2"), $("player-3")],
  communitySlots: [$("community-1"), $("community-2")],
  circles: [$("circle-1"), $("circle-2"), $("circle-3"), $("circle-bonus")],
  circleAmounts: [
    $("circle-1-amount"),
    $("circle-2-amount"),
    $("circle-3-amount"),
    $("circle-bonus-amount"),
  ],
};

/* ---------------- Rendering ---------------- */

function renderBalances() {
  els.playerBalance.textContent = playerChips.toLocaleString();
  els.houseBalance.textContent = houseVault.toLocaleString();
  const max = currentTableMax();
  els.tableLimits.textContent =
    max >= TABLE_MIN
      ? `Table limits: ${TABLE_MIN} – ${max} per circle`
      : "Table closed — vault below minimum";
}

function renderBetSummary() {
  els.unitDisplay.textContent = unit;
  els.totalDisplay.textContent = unit * 3 + (bonusOn ? unit : 0);
  els.bonusAmountDisplay.textContent = unit;
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("selected", Number(chip.dataset.unit) === unit);
    chip.disabled = Number(chip.dataset.unit) > currentTableMax();
  });
}

function cardHTML(card) {
  const red = card.suit === "♥" || card.suit === "♦";
  const label = rankLabel(card.rank);
  return `
    <div class="card-face${red ? " red" : ""}">
      <div class="card-corner">${label}<br>${card.suit}</div>
      <div class="card-suit-big">${card.suit}</div>
      <div class="card-corner bottom">${label}<br>${card.suit}</div>
    </div>
    <div class="card-back"></div>`;
}

function placeCard(slot, card, faceDown) {
  const el = document.createElement("div");
  el.className = "card dealing" + (faceDown ? " face-down" : "");
  el.innerHTML = cardHTML(card);
  slot.innerHTML = "";
  slot.appendChild(el);
}

function flipCard(slot) {
  const card = slot.querySelector(".card");
  if (card) card.classList.remove("face-down");
}

function clearTable() {
  [...els.playerSlots, ...els.communitySlots].forEach((s) => (s.innerHTML = ""));
  els.circles.forEach((c) => c.classList.remove("active", "pulled", "won", "lost"));
  els.circleAmounts.forEach((a) => (a.textContent = ""));
  els.message.classList.remove("big-win");
}

function setMessage(text, bigWin = false) {
  els.message.textContent = text;
  els.message.classList.toggle("big-win", bigWin);
}

function showControls(which) {
  els.betControls.classList.toggle("hidden", which !== "bet");
  els.decisionControls.classList.toggle("hidden", which !== "decision");
  els.nextControls.classList.toggle("hidden", which !== "next");
}

/* ---------------- Round flow ---------------- */

function deal() {
  const max = currentTableMax();
  if (max < TABLE_MIN) {
    setMessage("Table closed — the vault can't cover the minimum bet.");
    return;
  }
  if (unit > max) {
    setMessage(`Table max is ${max} right now — pick a smaller chip.`);
    return;
  }
  const total = unit * 3 + (bonusOn ? unit : 0);
  if (total > playerChips) {
    setMessage("Not enough chips — lower your bet or refill.");
    return;
  }

  playerChips -= total;
  bonusBet = bonusOn ? unit : 0;
  saveBalances();

  deck = newShuffledDeck();
  playerCards = [deck.pop(), deck.pop(), deck.pop()];
  communityCards = [deck.pop(), deck.pop()];
  circlesRiding = [true, true, true];
  phase = "decision1";

  clearTable();
  playerCards.forEach((c, i) => placeCard(els.playerSlots[i], c, false));
  communityCards.forEach((c, i) => placeCard(els.communitySlots[i], c, true));

  for (let i = 0; i < 3; i++) {
    els.circles[i].classList.add("active");
    els.circleAmounts[i].textContent = unit;
  }
  if (bonusBet) {
    els.circles[3].classList.add("active");
    els.circleAmounts[3].textContent = bonusBet;
  }

  renderBalances();
  setMessage("Bet 1: pull it back or let it ride?");
  showControls("decision");
}

function decide(ride) {
  const circleIndex = phase === "decision1" ? 0 : 1;

  if (!ride) {
    circlesRiding[circleIndex] = false;
    playerChips += unit; // stake returned, house never touched it
    saveBalances();
    els.circles[circleIndex].classList.remove("active");
    els.circles[circleIndex].classList.add("pulled");
    els.circleAmounts[circleIndex].textContent = "";
  }

  flipCard(els.communitySlots[circleIndex]);

  if (phase === "decision1") {
    phase = "decision2";
    renderBalances();
    setMessage("Bet 2: pull it back or let it ride?");
  } else {
    settle();
  }
}

function settle() {
  phase = "settled";
  const finalHand = [...playerCards, ...communityCards];
  const mainResult = evaluateMain(finalHand);
  const bonusResult = bonusBet ? evaluateBonus(playerCards) : null;

  let playerWon = 0; // winnings + returned stakes
  let houseDelta = 0; // + house gains, - house pays out

  for (let i = 0; i < 3; i++) {
    if (!circlesRiding[i]) continue;
    if (mainResult) {
      playerWon += unit + unit * mainResult.mult;
      houseDelta -= unit * mainResult.mult;
      els.circles[i].classList.add("won");
      els.circleAmounts[i].textContent = `+${unit * mainResult.mult}`;
    } else {
      houseDelta += unit;
      els.circles[i].classList.remove("active");
      els.circles[i].classList.add("lost");
    }
  }

  if (bonusBet) {
    if (bonusResult) {
      playerWon += bonusBet + bonusBet * bonusResult.mult;
      houseDelta -= bonusBet * bonusResult.mult;
      els.circles[3].classList.add("won");
      els.circleAmounts[3].textContent = `+${bonusBet * bonusResult.mult}`;
    } else {
      houseDelta += bonusBet;
      els.circles[3].classList.remove("active");
      els.circles[3].classList.add("lost");
    }
  }

  playerChips += playerWon;
  houseVault += houseDelta;
  saveBalances();
  renderBalances();

  const parts = [];
  if (mainResult) parts.push(mainResult.name);
  if (bonusResult) parts.push(`Bonus: ${bonusResult.name}`);

  const net = playerWon - (unit * circlesRiding.filter(Boolean).length + bonusBet);
  if (net > 0) {
    setMessage(`${parts.join(" — ")}! You win ${net} chips! 🎉`, true);
  } else if (net === 0 && parts.length) {
    setMessage(`${parts.join(" — ")} — you break even.`);
  } else if (parts.length) {
    setMessage(`${parts.join(" — ")} — down ${-net} chips this hand.`);
  } else {
    setMessage("No pay this time. Better luck next hand!");
  }

  showControls("next");
}

/* ---------------- Wiring ---------------- */

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    unit = Number(chip.dataset.unit);
    renderBetSummary();
  });
});

els.bonusCheckbox.addEventListener("change", () => {
  bonusOn = els.bonusCheckbox.checked;
  renderBetSummary();
});

els.dealBtn.addEventListener("click", deal);
els.rideBtn.addEventListener("click", () => decide(true));
els.pullBtn.addEventListener("click", () => decide(false));

els.nextBtn.addEventListener("click", () => {
  phase = "betting";
  clearTable();
  setMessage("Place your bet and press DEAL");
  renderBetSummary();
  showControls("bet");
});

els.refillBtn.addEventListener("click", () => {
  if (phase !== "betting" && phase !== "settled") return;
  playerChips += PLAYER_SEED;
  saveBalances();
  renderBalances();
  setMessage(`Refilled ${PLAYER_SEED} play chips. Have fun!`);
});

els.oddsBtn.addEventListener("click", () => els.oddsModal.classList.remove("hidden"));
els.oddsClose.addEventListener("click", () => els.oddsModal.classList.add("hidden"));
els.oddsModal.addEventListener("click", (e) => {
  if (e.target === els.oddsModal) els.oddsModal.classList.add("hidden");
});

/* ---------------- Init ---------------- */

renderBalances();
renderBetSummary();
showControls("bet");
