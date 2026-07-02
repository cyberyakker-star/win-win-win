/* ============================================================
   Blackjack. Rules (published on the page — they set the RTP):
   6 decks reshuffled every round, dealer stands on all 17s,
   blackjack pays 3:2, double on any first two cards, split
   once (split aces receive one card each), no insurance or
   surrender. ≈99.5% RTP with basic strategy.
   ============================================================ */

"use strict";

/* Worst case the vault can owe per unit: two split hands, both doubled,
   both winning = 4 units of winnings; blackjack pays 1.5. 8 is generous. */
const EXPOSURE_PER_UNIT = 8;

let unit = 5;
let deck = [];
let dealerCards = [];
let hands = []; // { cards, bet, done, doubled, fromSplit, result }
let activeHand = 0;
let phase = "betting"; // betting | acting | settled

const $ = (id) => document.getElementById(id);
const els = {
  message: $("message"),
  dealerCardsEl: $("dealer-cards"),
  dealerValue: $("dealer-value"),
  playerHandsEl: $("player-hands"),
  handsPlural: $("hands-plural"),
  betControls: $("bet-controls"),
  actionControls: $("action-controls"),
  nextControls: $("next-controls"),
  betDisplay: $("bet-display"),
  dealBtn: $("deal-btn"),
  hitBtn: $("hit-btn"),
  standBtn: $("stand-btn"),
  doubleBtn: $("double-btn"),
  splitBtn: $("split-btn"),
  nextBtn: $("next-btn"),
  refillBtn: $("refill-btn"),
};

Bank.bind({
  playerEl: $("player-balance"),
  houseEl: $("house-balance"),
  limitsEl: $("table-limits"),
  exposurePerUnit: EXPOSURE_PER_UNIT,
});

/* ---------------- Hand math ---------------- */

function cardValue(card) {
  if (card.rank >= 10 && card.rank <= 13) return 10;
  if (card.rank === 14) return 11; // ace counted below
  return card.rank;
}

/* Best total ≤ 21 where possible; { total, soft } */
function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 14) { aces++; total += 1; }
    else total += cardValue(c);
  }
  let soft = false;
  if (aces > 0 && total + 10 <= 21) { total += 10; soft = true; }
  return { total, soft };
}

function isBlackjack(hand) {
  return !hand.fromSplit && hand.cards.length === 2 && handValue(hand.cards).total === 21;
}

/* ---------------- Rendering ---------------- */

function renderDealer() {
  els.dealerCardsEl.innerHTML = "";
  dealerCards.forEach((c, i) => {
    const slot = document.createElement("div");
    slot.className = "card-slot";
    els.dealerCardsEl.appendChild(slot);
    Cards.placeCard(slot, c, i === 1); // hole card face down
  });
  const up = handValue([dealerCards[0]]);
  els.dealerValue.textContent = `${up.total} + ?`;
}

/* Flip the hole card in place and deal any drawn cards. */
function revealDealer() {
  Cards.flipCard(els.dealerCardsEl.children[1]);
  for (let i = 2; i < dealerCards.length; i++) {
    const slot = document.createElement("div");
    slot.className = "card-slot";
    els.dealerCardsEl.appendChild(slot);
    Cards.placeCard(slot, dealerCards[i], false);
  }
  const v = handValue(dealerCards);
  els.dealerValue.textContent = v.total > 21 ? `${v.total} — BUST` : v.total;
}

function renderHands(animate = false) {
  els.handsPlural.textContent = hands.length > 1 ? "S" : "";
  els.playerHandsEl.innerHTML = "";
  hands.forEach((hand, i) => {
    const box = document.createElement("div");
    box.className = "bj-hand" + (phase === "acting" && i === activeHand && !hand.done ? " active" : "");

    const cardsRow = document.createElement("div");
    cardsRow.className = "bj-cards";
    hand.cards.forEach((c) => {
      const slot = document.createElement("div");
      slot.className = "card-slot";
      cardsRow.appendChild(slot);
      const el = Cards.placeCard(slot, c, false);
      // only the opening deal animates — re-renders show cards in place
      if (!animate) el.classList.remove("dealing");
    });
    box.appendChild(cardsRow);

    const v = handValue(hand.cards);
    const valueEl = document.createElement("div");
    valueEl.innerHTML = `<span class="hand-value">${v.soft ? "soft " : ""}${v.total}</span>`;
    if (hand.result) {
      const badge = document.createElement("span");
      const cls = { win: "win", blackjack: "bj", lose: "lose", bust: "lose", push: "push" }[hand.result];
      badge.className = `hand-badge ${cls}`;
      badge.textContent = hand.result === "blackjack" ? "BLACKJACK 3:2" : hand.result.toUpperCase();
      valueEl.appendChild(badge);
    }
    box.appendChild(valueEl);

    const betEl = document.createElement("div");
    betEl.className = "hand-bet";
    betEl.textContent = `bet ${hand.bet}${hand.doubled ? " (doubled)" : ""}`;
    box.appendChild(betEl);

    els.playerHandsEl.appendChild(box);
  });
}

function renderActions() {
  const hand = hands[activeHand];
  if (!hand || phase !== "acting") return;
  const two = hand.cards.length === 2;
  els.doubleBtn.disabled = !two || hand.fromSplit || Bank.player() < hand.bet;
  els.splitBtn.disabled = !(
    two &&
    hands.length === 1 &&
    hand.cards[0].rank === hand.cards[1].rank &&
    Bank.player() >= hand.bet
  );
}

function setMessage(text, bigWin = false) {
  els.message.textContent = text;
  els.message.classList.toggle("big-win", bigWin);
}

function showControls(which) {
  els.betControls.classList.toggle("hidden", which !== "bet");
  els.actionControls.classList.toggle("hidden", which !== "action");
  els.nextControls.classList.toggle("hidden", which !== "next");
}

/* ---------------- Round flow ---------------- */

function dealRound() {
  const max = Bank.maxUnit(EXPOSURE_PER_UNIT);
  if (unit > max) {
    setMessage(`Table max is ${max} right now — pick a smaller chip.`);
    return;
  }
  if (!Bank.take(unit)) {
    setMessage("Not enough chips — lower your bet or refill.");
    return;
  }

  deck = Cards.newShuffledDeck(6);
  dealerCards = [deck.pop(), deck.pop()];
  hands = [{ cards: [deck.pop(), deck.pop()], bet: unit, done: false, doubled: false, fromSplit: false, result: null }];
  activeHand = 0;
  phase = "acting";

  renderDealer();
  renderHands(true);

  const playerBJ = isBlackjack(hands[0]);
  const dealerBJ = handValue(dealerCards).total === 21;

  if (playerBJ || dealerBJ) {
    hands[0].done = true;
    finishRound();
    return;
  }

  setMessage("Hit, stand, double — or split a pair.");
  showControls("action");
  renderActions();
}

function currentHand() {
  return hands[activeHand];
}

function advanceHand() {
  while (activeHand < hands.length && hands[activeHand].done) activeHand++;
  if (activeHand >= hands.length) {
    finishRound();
    return;
  }
  renderHands();
  renderActions();
  if (hands.length > 1) setMessage(`Playing hand ${activeHand + 1} of ${hands.length}.`);
}

function hit() {
  const hand = currentHand();
  hand.cards.push(deck.pop());
  const v = handValue(hand.cards);
  if (v.total >= 21) hand.done = true;
  renderHands();
  renderActions();
  if (hand.done) advanceHand();
}

function stand() {
  currentHand().done = true;
  advanceHand();
}

function doubleDown() {
  const hand = currentHand();
  if (hand.cards.length !== 2 || !Bank.take(hand.bet)) return;
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(deck.pop());
  hand.done = true;
  renderHands();
  advanceHand();
}

function split() {
  const hand = currentHand();
  if (!(hands.length === 1 && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank)) return;
  if (!Bank.take(hand.bet)) return;

  const splitAces = hand.cards[0].rank === 14;
  const second = { cards: [hand.cards.pop()], bet: hand.bet, done: false, doubled: false, fromSplit: true, result: null };
  hand.fromSplit = true;
  hands.push(second);

  hand.cards.push(deck.pop());
  second.cards.push(deck.pop());

  if (splitAces) {
    // one card each on split aces
    hand.done = true;
    second.done = true;
  } else {
    // a 21 after the split draw stands automatically
    for (const h of hands) if (handValue(h.cards).total === 21) h.done = true;
  }
  renderHands();
  renderActions();
  if (hands[activeHand].done) advanceHand();
}

function finishRound() {
  phase = "settled";
  const dealerBJ = handValue(dealerCards).total === 21 && dealerCards.length === 2;
  const anyLive = hands.some((h) => handValue(h.cards).total <= 21 && !isBlackjack(h));

  // dealer draws only if a non-blackjack hand is still live
  if (anyLive && !dealerBJ) {
    while (handValue(dealerCards).total < 17) dealerCards.push(deck.pop());
  }
  revealDealer();

  const dv = handValue(dealerCards).total;
  let net = 0;

  for (const hand of hands) {
    const hv = handValue(hand.cards).total;
    const bj = isBlackjack(hand);

    if (hv > 21) {
      hand.result = "bust";
      Bank.settleLose(hand.bet);
      net -= hand.bet;
    } else if (bj && dealerBJ) {
      hand.result = "push";
      Bank.refund(hand.bet);
    } else if (bj) {
      hand.result = "blackjack";
      Bank.settleWin(hand.bet, hand.bet * 1.5);
      net += hand.bet * 1.5;
    } else if (dealerBJ || (dv <= 21 && dv > hv)) {
      hand.result = "lose";
      Bank.settleLose(hand.bet);
      net -= hand.bet;
    } else if (dv > 21 || hv > dv) {
      hand.result = "win";
      Bank.settleWin(hand.bet, hand.bet);
      net += hand.bet;
    } else {
      hand.result = "push";
      Bank.refund(hand.bet);
    }
  }

  renderHands();

  if (net > 0) setMessage(`You win ${net.toLocaleString()} chips! 🎉`, true);
  else if (net === 0) setMessage("Push — your bet is returned.");
  else setMessage(`Dealer takes it — down ${(-net).toLocaleString()} chips.`);

  showControls("next");
}

/* ---------------- Wiring ---------------- */

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

els.dealBtn.addEventListener("click", dealRound);
els.hitBtn.addEventListener("click", hit);
els.standBtn.addEventListener("click", stand);
els.doubleBtn.addEventListener("click", doubleDown);
els.splitBtn.addEventListener("click", split);

els.nextBtn.addEventListener("click", () => {
  phase = "betting";
  dealerCards = [];
  hands = [];
  els.dealerCardsEl.innerHTML = "";
  els.playerHandsEl.innerHTML = "";
  els.dealerValue.innerHTML = "&nbsp;";
  setMessage("Place your bet and press DEAL");
  showControls("bet");
});

els.refillBtn.addEventListener("click", () => {
  if (phase === "acting") return;
  Bank.refill();
});
