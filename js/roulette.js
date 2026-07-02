/* ============================================================
   European roulette (single zero).

   Every bet type pays so that the expected return is exactly
   36/37 of the wager — RTP 97.30%, published on the page.
   Before each spin the worst-case payout across all 37
   outcomes is checked against the vault, so the house can
   always pay.
   ============================================================ */

"use strict";

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const STRAIGHT_MULT = 35;

/* betId -> { mult, wins(n) } */
const BET_TYPES = {
  red:   { label: "RED",   mult: 1, wins: (n) => n > 0 && RED.has(n) },
  black: { label: "BLACK", mult: 1, wins: (n) => n > 0 && !RED.has(n) },
  odd:   { label: "ODD",   mult: 1, wins: (n) => n > 0 && n % 2 === 1 },
  even:  { label: "EVEN",  mult: 1, wins: (n) => n > 0 && n % 2 === 0 },
  low:   { label: "1–18",  mult: 1, wins: (n) => n >= 1 && n <= 18 },
  high:  { label: "19–36", mult: 1, wins: (n) => n >= 19 },
  dz1:   { label: "1st 12", mult: 2, wins: (n) => n >= 1 && n <= 12 },
  dz2:   { label: "2nd 12", mult: 2, wins: (n) => n >= 13 && n <= 24 },
  dz3:   { label: "3rd 12", mult: 2, wins: (n) => n >= 25 },
  col1:  { label: "2:1", mult: 2, wins: (n) => n > 0 && n % 3 === 1 },
  col2:  { label: "2:1", mult: 2, wins: (n) => n > 0 && n % 3 === 2 },
  col3:  { label: "2:1", mult: 2, wins: (n) => n > 0 && n % 3 === 0 },
};
for (let n = 0; n <= 36; n++) {
  BET_TYPES[`n${n}`] = { label: String(n), mult: STRAIGHT_MULT, wins: (x) => x === n };
}

let unit = 5;
let bets = {}; // betId -> staked amount (escrowed in Bank)
let spinning = false;
let history = [];

const $ = (id) => document.getElementById(id);
const els = {
  board: $("board"),
  wheel: $("wheel"),
  hub: $("wheel-hub"),
  message: $("message"),
  historyEl: $("history"),
  totalBet: $("total-bet"),
  spinBtn: $("spin-btn"),
  clearBtn: $("clear-btn"),
  refillBtn: $("refill-btn"),
};

Bank.bind({
  playerEl: $("player-balance"),
  houseEl: $("house-balance"),
  limitsEl: $("table-limits"),
  exposurePerUnit: STRAIGHT_MULT + 1,
});

/* ---------------- Board construction ---------------- */

function numColor(n) {
  return n === 0 ? "green" : RED.has(n) ? "red" : "black";
}

function buildBoard() {
  const frag = document.createDocumentFragment();

  const zero = spotEl("n0", "0", "green");
  zero.id = "spot-0";
  frag.appendChild(zero);

  for (let n = 1; n <= 36; n++) {
    const el = spotEl(`n${n}`, String(n), numColor(n));
    el.style.gridColumn = String(Math.floor((n - 1) / 3) + 2);
    el.style.gridRow = String(3 - ((n - 1) % 3));
    frag.appendChild(el);
  }

  [["col3", 1], ["col2", 2], ["col1", 3]].forEach(([id, row]) => {
    const el = spotEl(id, "2:1", "outside colbet");
    el.style.gridRow = String(row);
    frag.appendChild(el);
  });

  [["dz1", 2], ["dz2", 6], ["dz3", 10]].forEach(([id, col]) => {
    const el = spotEl(id, BET_TYPES[id].label, "outside");
    el.style.gridRow = "4";
    el.style.gridColumn = `${col} / span 4`;
    frag.appendChild(el);
  });

  [["low", 2], ["even", 4], ["red", 6], ["black", 8], ["odd", 10], ["high", 12]].forEach(([id, col]) => {
    const el = spotEl(id, BET_TYPES[id].label, `outside ${id === "red" ? "red" : id === "black" ? "black" : ""}`);
    el.style.gridRow = "5";
    el.style.gridColumn = `${col} / span 2`;
    frag.appendChild(el);
  });

  els.board.appendChild(frag);
}

function spotEl(betId, label, extraClass) {
  const el = document.createElement("div");
  el.className = `spot ${extraClass}`.trim();
  el.dataset.bet = betId;
  el.textContent = label;
  el.addEventListener("click", () => onSpotClick(betId, el));
  return el;
}

/* ---------------- Betting ---------------- */

function totalStaked() {
  return Object.values(bets).reduce((a, b) => a + b, 0);
}

/* Largest winnings the vault would owe across all 37 outcomes. */
function worstCasePayout(betMap) {
  let worst = 0;
  for (let n = 0; n <= 36; n++) {
    let pay = 0;
    for (const [id, amt] of Object.entries(betMap)) {
      if (BET_TYPES[id].wins(n)) pay += amt * BET_TYPES[id].mult;
    }
    worst = Math.max(worst, pay);
  }
  return worst;
}

let removeMode = false;

function onSpotClick(betId, el) {
  if (spinning) return;
  const existing = bets[betId] || 0;

  if (removeMode) {
    if (existing) removeChip(betId, el);
    return;
  }

  const newBets = { ...bets, [betId]: existing + unit };
  if (worstCasePayout(newBets) > Bank.house()) {
    setMessage("That bet would exceed what the vault can pay — table limit reached.");
    return;
  }
  if (!Bank.take(unit)) {
    setMessage("Not enough chips — pick a smaller chip or refill.");
    return;
  }
  bets[betId] = existing + unit;
  renderSpot(betId, el);
  renderTotals();
}

function removeChip(betId, el) {
  const amt = bets[betId];
  const back = Math.min(unit, amt);
  Bank.refund(back);
  if (amt - back <= 0) delete bets[betId];
  else bets[betId] = amt - back;
  renderSpot(betId, el);
  renderTotals();
}

function renderSpot(betId, el) {
  const target = el || els.board.querySelector(`[data-bet="${betId}"]`);
  if (!target) return;
  let chipEl = target.querySelector(".bet-chip");
  const amt = bets[betId];
  if (!amt) {
    if (chipEl) chipEl.remove();
    return;
  }
  if (!chipEl) {
    chipEl = document.createElement("span");
    chipEl.className = "bet-chip";
    target.appendChild(chipEl);
  }
  chipEl.textContent = amt;
}

function renderTotals() {
  els.totalBet.textContent = totalStaked();
}

function clearBets(refund = true) {
  for (const [id, amt] of Object.entries(bets)) {
    if (refund) Bank.refund(amt);
    delete bets[id];
    renderSpot(id);
  }
  renderTotals();
}

/* ---------------- Spin ---------------- */

function randomOutcome() {
  const buf = new Uint32Array(1);
  // rejection sampling for a perfectly uniform 0-36
  const limit = Math.floor(0xffffffff / 37) * 37;
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % 37;
}

function spin() {
  if (spinning) return;
  if (totalStaked() === 0) {
    setMessage("Place at least one bet first.");
    return;
  }
  spinning = true;
  els.spinBtn.disabled = true;
  els.clearBtn.disabled = true;
  document.querySelectorAll(".spot.winner").forEach((s) => s.classList.remove("winner"));

  const outcome = randomOutcome();
  els.hub.textContent = "";
  els.hub.className = "wheel-hub";
  els.wheel.classList.remove("spinning");
  void els.wheel.offsetWidth; // restart animation
  els.wheel.classList.add("spinning");
  setMessage("No more bets…");

  setTimeout(() => settle(outcome), 3000);
}

function settle(outcome) {
  const color = numColor(outcome);
  els.hub.textContent = outcome;
  els.hub.classList.add(`hit-${color}`);

  history.unshift(outcome);
  history = history.slice(0, 12);
  els.historyEl.innerHTML = history
    .map((n) => `<span class="history-num ${numColor(n)}">${n}</span>`)
    .join("");

  let returned = 0;
  const staked = totalStaked();

  for (const [id, amt] of Object.entries(bets)) {
    if (BET_TYPES[id].wins(outcome)) {
      const winnings = amt * BET_TYPES[id].mult;
      Bank.settleWin(amt, winnings);
      returned += amt + winnings;
      const spot = els.board.querySelector(`[data-bet="${id}"]`);
      if (spot) spot.classList.add("winner");
    } else {
      Bank.settleLose(amt);
    }
  }
  const numberSpot = els.board.querySelector(`[data-bet="n${outcome}"]`);
  if (numberSpot) numberSpot.classList.add("winner");

  clearBets(false); // stakes already settled — just clear the display

  const net = returned - staked;
  if (net > 0) setMessage(`${outcome} ${color.toUpperCase()} — you win ${net} chips! 🎉`, true);
  else if (net === 0) setMessage(`${outcome} ${color.toUpperCase()} — you break even.`);
  else setMessage(`${outcome} ${color.toUpperCase()} — down ${-net} chips.`);

  spinning = false;
  els.spinBtn.disabled = false;
  els.clearBtn.disabled = false;
  els.spinBtn.textContent = "SPIN";
}

function setMessage(text, bigWin = false) {
  els.message.textContent = text;
  els.message.classList.toggle("big-win", bigWin);
}

/* ---------------- Wiring ---------------- */

buildBoard();
renderTotals();

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    unit = Number(chip.dataset.unit);
    document.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("selected", Number(c.dataset.unit) === unit)
    );
  });
});
document.querySelector('.chip[data-unit="5"]').classList.add("selected");

els.spinBtn.addEventListener("click", spin);
els.clearBtn.addEventListener("click", () => {
  if (!spinning) clearBets(true);
});
$("remove-btn").addEventListener("click", () => {
  removeMode = !removeMode;
  $("remove-btn").textContent = removeMode ? "✓ REMOVING — TAP CHIPS" : "REMOVE CHIPS";
  $("remove-btn").classList.toggle("btn-stop", removeMode);
  $("remove-btn").classList.toggle("btn-alt", !removeMode);
});
els.refillBtn.addEventListener("click", () => {
  if (!spinning) Bank.refill();
});
