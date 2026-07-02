/* ============================================================
   Let It Ride — game flow. Deck, evaluators, and bankroll live
   in js/cards.js and js/bank.js.

   RTP (published): 96.49% with optimal strategy; Three Card
   Bonus 95.80% exact.
   ============================================================ */

"use strict";

/* Worst-case exposure per unit bet: 3 riding circles hitting a royal
   (1000:1) plus a mini-royal bonus (100:1). */
const EXPOSURE_PER_UNIT = 3 * 1000 + 100;

let unit = 5;
let bonusOn = false;
let playerCards = [];
let communityCards = [];
let circlesRiding = [true, true, true];
let bonusBet = 0;
let phase = "betting"; // betting | decision1 | decision2 | settled

const $ = (id) => document.getElementById(id);
const els = {
  message: $("message"),
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

Bank.bind({
  playerEl: $("player-balance"),
  houseEl: $("house-balance"),
  limitsEl: $("table-limits"),
  exposurePerUnit: EXPOSURE_PER_UNIT,
});

function renderBetSummary() {
  els.unitDisplay.textContent = unit;
  els.totalDisplay.textContent = unit * 3 + (bonusOn ? unit : 0);
  els.bonusAmountDisplay.textContent = unit;
  const max = Bank.maxUnit(EXPOSURE_PER_UNIT);
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("selected", Number(chip.dataset.unit) === unit);
    chip.disabled = Number(chip.dataset.unit) > max;
  });
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
  const max = Bank.maxUnit(EXPOSURE_PER_UNIT);
  if (max < Bank.TABLE_MIN) {
    setMessage("Table closed — the vault can't cover the minimum bet.");
    return;
  }
  if (unit > max) {
    setMessage(`Table max is ${max} right now — pick a smaller chip.`);
    return;
  }
  const total = unit * 3 + (bonusOn ? unit : 0);
  if (!Bank.take(total)) {
    setMessage("Not enough chips — lower your bet or refill.");
    return;
  }

  bonusBet = bonusOn ? unit : 0;
  const deck = Cards.newShuffledDeck();
  playerCards = [deck.pop(), deck.pop(), deck.pop()];
  communityCards = [deck.pop(), deck.pop()];
  circlesRiding = [true, true, true];
  phase = "decision1";

  clearTable();
  playerCards.forEach((c, i) => Cards.placeCard(els.playerSlots[i], c, false));
  communityCards.forEach((c, i) => Cards.placeCard(els.communitySlots[i], c, true));

  for (let i = 0; i < 3; i++) {
    els.circles[i].classList.add("active");
    els.circleAmounts[i].textContent = unit;
  }
  if (bonusBet) {
    els.circles[3].classList.add("active");
    els.circleAmounts[3].textContent = bonusBet;
  }

  setMessage("Bet 1: pull it back or let it ride?");
  showControls("decision");
}

function decide(ride) {
  const circleIndex = phase === "decision1" ? 0 : 1;

  if (!ride) {
    circlesRiding[circleIndex] = false;
    Bank.refund(unit); // stake returned, house never touched it
    els.circles[circleIndex].classList.remove("active");
    els.circles[circleIndex].classList.add("pulled");
    els.circleAmounts[circleIndex].textContent = "";
  }

  Cards.flipCard(els.communitySlots[circleIndex]);

  if (phase === "decision1") {
    phase = "decision2";
    setMessage("Bet 2: pull it back or let it ride?");
  } else {
    settle();
  }
}

function settle() {
  phase = "settled";
  const finalHand = [...playerCards, ...communityCards];
  const mainResult = Cards.evaluateMain(finalHand);
  const bonusResult = bonusBet ? Cards.evaluateBonus(playerCards) : null;

  let returned = 0; // stakes + winnings back to the player
  let staked = 0;

  for (let i = 0; i < 3; i++) {
    if (!circlesRiding[i]) continue;
    staked += unit;
    if (mainResult) {
      Bank.settleWin(unit, unit * mainResult.mult);
      returned += unit + unit * mainResult.mult;
      els.circles[i].classList.add("won");
      els.circleAmounts[i].textContent = `+${unit * mainResult.mult}`;
    } else {
      Bank.settleLose(unit);
      els.circles[i].classList.remove("active");
      els.circles[i].classList.add("lost");
    }
  }

  if (bonusBet) {
    staked += bonusBet;
    if (bonusResult) {
      Bank.settleWin(bonusBet, bonusBet * bonusResult.mult);
      returned += bonusBet + bonusBet * bonusResult.mult;
      els.circles[3].classList.add("won");
      els.circleAmounts[3].textContent = `+${bonusBet * bonusResult.mult}`;
    } else {
      Bank.settleLose(bonusBet);
      els.circles[3].classList.remove("active");
      els.circles[3].classList.add("lost");
    }
  }

  const parts = [];
  if (mainResult) parts.push(mainResult.name);
  if (bonusResult) parts.push(`Bonus: ${bonusResult.name}`);

  const net = returned - staked;
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
  Bank.refill();
  setMessage(`Refilled ${Bank.PLAYER_SEED} play chips. Have fun!`);
});

renderBetSummary();
showControls("bet");
