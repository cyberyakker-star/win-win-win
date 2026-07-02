/* ============================================================
   Shared Odds & RTP disclosure modal, injected on every page
   so the published odds live in exactly one place.

   Usage: <button id="odds-btn"> anywhere on the page, then
   include this script after js/bank.js.
   ============================================================ */

"use strict";

(() => {
  const MODAL_HTML = `
<div class="modal-backdrop hidden" id="odds-modal">
  <div class="modal">
    <button class="modal-close" id="odds-close">✕</button>
    <h2>Odds &amp; Return to Player</h2>
    <p class="rtp-headline">Published RTPs for every game in this casino.</p>

    <div class="rtp-grid">
      <div class="rtp-block">
        <span class="rtp-name">Let It Ride</span>
        <span class="rtp-value">96.49%</span>
        <span class="rtp-note">with optimal strategy</span>
      </div>
      <div class="rtp-block">
        <span class="rtp-name">Three Card Bonus</span>
        <span class="rtp-value">95.80%</span>
        <span class="rtp-note">exact, all bets</span>
      </div>
      <div class="rtp-block">
        <span class="rtp-name">Roulette</span>
        <span class="rtp-value">97.30%</span>
        <span class="rtp-note">European single zero, every bet</span>
      </div>
      <div class="rtp-block">
        <span class="rtp-name">Slots</span>
        <span class="rtp-value">96.55%</span>
        <span class="rtp-note">exact, computed from the reels</span>
      </div>
      <div class="rtp-block">
        <span class="rtp-name">Blackjack</span>
        <span class="rtp-value">≈99.5%</span>
        <span class="rtp-note">with basic strategy</span>
      </div>
    </div>

    <h3>How each number is derived</h3>
    <ul class="strategy-list">
      <li><strong>Let It Ride</strong> — industry-standard paytable (royal 1000:1 … pair of
        10s 1:1); 96.49% assumes the optimal pull/ride strategy shown on the game page.
        The Three Card Bonus RTP is exact over all 22,100 three-card hands.</li>
      <li><strong>Roulette</strong> — single-zero wheel, no la partage. Every bet type
        (straight 35:1, dozens/columns 2:1, even-money 1:1) returns exactly 36/37 =
        97.30% of wagers on average.</li>
      <li><strong>Slots</strong> — three 20-stop reels with a fixed, published paytable.
        96.55% is the exact average over all 8,000 equally likely reel combinations.</li>
      <li><strong>Blackjack</strong> — 6 decks reshuffled every round, dealer stands on all
        17s, blackjack pays 3:2, double on any two cards, split once. RTP depends on your
        decisions; ≈99.5% is achievable with basic strategy.</li>
    </ul>

    <p class="fine-print">
      The chances of getting a particular outcome are always the same at the start of
      every game. Cards, wheel spins, and reel stops come from a cryptographically
      seeded random number generator, freshly drawn each round.
    </p>
    <p class="fine-print">
      Return to Player (RTP) is the long-run share of all wagers paid back as winnings.
      The house keeps the remainder on average, which is how the vault stays funded for
      future players. Table limits scale with the vault so a maximum win can always be
      paid.
    </p>
    <p class="fine-print">
      This site uses <strong>play money only</strong>. No real money can be deposited,
      wagered, or won. Malfunctions void all pays and plays. v1.1.2
    </p>
  </div>
</div>`;

  document.addEventListener("DOMContentLoaded", () => {
    document.body.insertAdjacentHTML("beforeend", MODAL_HTML);
    const modal = document.getElementById("odds-modal");
    const btn = document.getElementById("odds-btn");
    if (btn) btn.addEventListener("click", () => modal.classList.remove("hidden"));
    document.getElementById("odds-close").addEventListener("click", () => modal.classList.add("hidden"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });
})();
