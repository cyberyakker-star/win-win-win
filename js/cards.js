/* ============================================================
   Shared playing-card utilities: crypto-shuffled decks, card
   DOM rendering, and the poker hand evaluators used by
   Let It Ride. Blackjack reuses the deck and rendering.
   ============================================================ */

"use strict";

const Cards = (() => {
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANK_NAMES = { 11: "J", 12: "Q", 13: "K", 14: "A" };

  function newShuffledDeck(deckCount = 1) {
    const deck = [];
    for (let d = 0; d < deckCount; d++) {
      for (const suit of SUITS) {
        for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
      }
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

  /* ---------------- DOM rendering ---------------- */

  function cardHTML(card) {
    const red = card.suit === "♥" || card.suit === "♦";
    const label = rankLabel(card.rank);
    // U+FE0E forces text presentation — without it, iOS Safari renders the
    // suit characters as giant colored emoji that overflow the card layout
    const suit = card.suit + "︎";
    return `
      <div class="card-face${red ? " red" : ""}">
        <div class="card-corner">${label}<br>${suit}</div>
        <div class="card-suit-big">${suit}</div>
        <div class="card-corner bottom">${label}<br>${suit}</div>
      </div>
      <div class="card-back"></div>`;
  }

  function placeCard(slot, card, faceDown) {
    const el = document.createElement("div");
    el.className = "card dealing" + (faceDown ? " face-down" : "");
    el.innerHTML = cardHTML(card);
    slot.innerHTML = "";
    slot.appendChild(el);
    return el;
  }

  function flipCard(slot) {
    const card = slot.querySelector(".card");
    if (card) card.classList.remove("face-down");
  }

  /* ---------------- Poker evaluation ---------------- */

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

  /* 5-card evaluation for Let It Ride → { name, mult } or null if no pay */
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

  return {
    SUITS,
    newShuffledDeck,
    rankLabel,
    cardHTML,
    placeCard,
    flipCard,
    evaluateMain,
    evaluateBonus,
  };
})();
