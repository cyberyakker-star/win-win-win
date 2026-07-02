/* ============================================================
   Lucky Triple — 3-reel, single-payline slot machine.

   The reel strips below are the entire probability model: three
   fixed 20-stop reels, every stop equally likely (crypto RNG).
   Exhaustive enumeration of all 20³ = 8,000 combinations gives
   a total return of 7,724 units per 8,000 wagered:

       RTP = 7724 / 8000 = 96.55%  (exact — published)

   Paytable values are TOTAL RETURN (×bet): a pay of 1 is money
   back, 600 returns 600× the bet including the stake.
   ============================================================ */

"use strict";

const SEVEN = "7", DBAR = "DB", BAR = "BAR", BELL = "BELL", CHERRY = "CH", BLANK = "-";

const REELS = [
  [SEVEN, BLANK, CHERRY, BAR, BLANK, BELL, CHERRY, BLANK, DBAR, BLANK,
   CHERRY, BAR, BLANK, BELL, BLANK, DBAR, CHERRY, BAR, BELL, BLANK],
  [BLANK, BAR, CHERRY, BLANK, BELL, BLANK, DBAR, BLANK, SEVEN, BLANK,
   BAR, CHERRY, BLANK, BELL, DBAR, BLANK, BAR, BLANK, BELL, CHERRY],
  [BLANK, BELL, BLANK, BAR, BLANK, CHERRY, BLANK, DBAR, BLANK, BAR,
   BLANK, BELL, SEVEN, BLANK, BAR, BLANK, DBAR, BLANK, BELL, CHERRY],
];

const MAX_PAY = 600; // total-return multiplier of the top prize (worst case for the vault)

/* Total-return multiplier for a payline [a, b, c]; 0 = lose. */
function linePay(line) {
  const [a, b, c] = line;
  if (a === SEVEN && b === SEVEN && c === SEVEN) return 600;
  if (a === DBAR && b === DBAR && c === DBAR) return 60;
  if (a === BAR && b === BAR && c === BAR) return 25;
  if (a === BELL && b === BELL && c === BELL) return 15;
  const isBar = (s) => s === BAR || s === DBAR;
  if (isBar(a) && isBar(b) && isBar(c)) return 10; // mixed bars (pure trips caught above)
  const cherries = line.filter((s) => s === CHERRY).length;
  if (cherries === 3) return 10;
  if (cherries === 2) return 4;
  if (cherries === 1) return 1;
  return 0;
}

function payName(pay, line) {
  if (pay === 600) return "★ TRIPLE SEVENS — JACKPOT! ★";
  if (pay === 60) return "Triple Double-Bar!";
  if (pay === 25) return "Triple BAR!";
  if (pay === 15) return "Triple Bells!";
  if (pay === 10) return line.filter((s) => s === CHERRY).length === 3 ? "Triple Cherries!" : "Bar Mix!";
  if (pay === 4) return "Two cherries";
  if (pay === 1) return "One cherry — money back";
  return "";
}

/* ---------------- State / DOM ---------------- */

let unit = 5;
let spinning = false;

const $ = (id) => document.getElementById(id);
const els = {
  message: $("message"),
  spinBtn: $("spin-btn"),
  betDisplay: $("bet-display"),
  refillBtn: $("refill-btn"),
  reelsBox: $("reels"),
  strips: [$("reel-0"), $("reel-1"), $("reel-2")],
};

Bank.bind({
  playerEl: $("player-balance"),
  houseEl: $("house-balance"),
  limitsEl: $("table-limits"),
  exposurePerUnit: MAX_PAY,
});

/* ---------------- Reel rendering ---------------- */

const CELL_H = 64;

function symbolHTML(sym) {
  switch (sym) {
    case SEVEN: return '<span class="sym-seven">7</span>';
    case BAR: return '<span class="sym-bar">BAR</span>';
    case DBAR: return '<span class="sym-dbar">BAR<br>BAR</span>';
    case BELL: return "🔔";
    case CHERRY: return "🍒";
    default: return "";
  }
}

/* Each strip element holds the reel repeated 3× so any stop index can be
   shown (middle copy) with cells visible above and below the payline. */
function buildStrips() {
  els.strips.forEach((stripEl, r) => {
    const reel = REELS[r];
    stripEl.innerHTML = [...reel, ...reel, ...reel]
      .map((s) => `<div class="reel-cell">${symbolHTML(s)}</div>`)
      .join("");
    setStop(r, 0, false);
  });
}

/* Position reel r so stop index s sits on the payline (middle cell). */
function setStop(r, s, animate) {
  const stripEl = els.strips[r];
  const y = -(REELS[r].length + s - 1) * CELL_H; // middle copy, payline row
  if (!animate) stripEl.style.transition = "none";
  stripEl.style.transform = `translateY(${y}px)`;
  if (!animate) {
    void stripEl.offsetWidth;
    stripEl.style.transition = "";
  }
}

function randomStop(len) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / len) * len;
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % len;
}

/* ---------------- Spin ---------------- */

function spin() {
  if (spinning) return;
  const max = Bank.maxUnit(MAX_PAY);
  if (unit > max) {
    setMessage(`Machine max is ${max} right now — pick a smaller chip.`);
    return;
  }
  if (!Bank.take(unit)) {
    setMessage("Not enough chips — pick a smaller chip or refill.");
    return;
  }

  spinning = true;
  els.spinBtn.disabled = true;
  els.reelsBox.classList.remove("win");
  setMessage("Spinning…");

  const stops = REELS.map((reel) => randomStop(reel.length));

  // scroll-blur while "spinning", then land reels left to right
  els.strips.forEach((stripEl, r) => {
    stripEl.classList.add("blur");
    let pos = 0;
    stripEl._interval = setInterval(() => {
      pos = (pos + 5) % REELS[r].length;
      setStop(r, pos, false);
    }, 50);
  });

  stops.forEach((s, r) => {
    setTimeout(() => {
      clearInterval(els.strips[r]._interval);
      els.strips[r].classList.remove("blur");
      setStop(r, s, true);
      if (r === 2) setTimeout(() => settle(stops), 450);
    }, 700 + r * 500);
  });
}

function settle(stops) {
  const line = stops.map((s, r) => REELS[r][s]);
  const pay = linePay(line);

  if (pay > 0) {
    Bank.settleWin(unit, (pay - 1) * unit);
    els.reelsBox.classList.add("win");
    const net = (pay - 1) * unit;
    if (net > 0) setMessage(`${payName(pay, line)} +${net} chips! 🎉`, pay >= 10);
    else setMessage(payName(pay, line));
  } else {
    Bank.settleLose(unit);
    setMessage("No luck — spin again!");
  }

  spinning = false;
  els.spinBtn.disabled = false;
}

function setMessage(text, bigWin = false) {
  els.message.textContent = text;
  els.message.classList.toggle("big-win", bigWin);
}

/* ---------------- Wiring ---------------- */

buildStrips();

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    unit = Number(chip.dataset.unit);
    els.betDisplay.textContent = unit;
    document.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("selected", Number(c.dataset.unit) === unit)
    );
  });
});
document.querySelector('.chip[data-unit="5"]').classList.add("selected");

els.spinBtn.addEventListener("click", spin);
els.refillBtn.addEventListener("click", () => {
  if (!spinning) Bank.refill();
});
