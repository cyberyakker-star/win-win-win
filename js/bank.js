/* ============================================================
   Shared play-money bank for all Win Win Win Casino games.

   One player chip balance and one persistent house vault,
   shared across games via localStorage. Bets are escrowed by
   the calling game between take() and settle; at the end of
   every round each escrowed chip has either returned to the
   player or entered the vault, so player + vault is conserved.

   Each game passes its own worst-case payout multiplier to
   maxUnit() so a maximum win can never exceed the vault — the
   house can always pay and never goes broke.
   ============================================================ */

"use strict";

const Bank = (() => {
  const KEYS = { player: "www_player_chips", house: "www_house_vault" };
  const PLAYER_SEED = 500;
  const HOUSE_SEED = 250000;
  const TABLE_MIN = 1;
  const TABLE_MAX = 25;

  function load(key, fallback) {
    const raw = localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  let player = load(KEYS.player, PLAYER_SEED);
  let house = load(KEYS.house, HOUSE_SEED);

  function save() {
    localStorage.setItem(KEYS.player, String(player));
    localStorage.setItem(KEYS.house, String(house));
    render();
  }

  let els = null;

  /* Bind the balance display elements once per page. */
  function bind({ playerEl, houseEl, limitsEl, exposurePerUnit }) {
    els = { playerEl, houseEl, limitsEl, exposurePerUnit };
    render();
  }

  function render() {
    if (!els) return;
    if (els.playerEl) els.playerEl.textContent = player.toLocaleString();
    if (els.houseEl) els.houseEl.textContent = house.toLocaleString();
    if (els.limitsEl && els.exposurePerUnit) {
      const max = maxUnit(els.exposurePerUnit);
      els.limitsEl.textContent =
        max >= TABLE_MIN
          ? `Table limits: ${TABLE_MIN} – ${max} per bet`
          : "Table closed — vault below minimum";
    }
  }

  /* The table max shrinks if the vault ever gets low, so the worst
     possible win is always payable. With every game holding a house
     edge the vault grows over time, so this floor is theoretical. */
  function maxUnit(exposurePerUnit) {
    return Math.max(0, Math.min(TABLE_MAX, Math.floor(house / exposurePerUnit)));
  }

  return {
    TABLE_MIN,
    TABLE_MAX,
    PLAYER_SEED,
    bind,
    render,
    maxUnit,
    player: () => player,
    house: () => house,

    /* Escrow a bet from the player. Returns false if they can't cover it. */
    take(n) {
      if (n > player) return false;
      player -= n;
      save();
      return true;
    },

    /* Return escrowed chips to the player (pulled-back / pushed bets). */
    refund(n) {
      player += n;
      save();
    },

    /* Winning bet: stake comes back from escrow, winnings from the vault. */
    settleWin(stake, winnings) {
      player += stake + winnings;
      house -= winnings;
      save();
    },

    /* Losing bet: escrowed stake goes to the vault. */
    settleLose(stake) {
      house += stake;
      save();
    },

    refill() {
      player += PLAYER_SEED;
      save();
    },
  };
})();
