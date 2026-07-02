# Win Win Win Casino 🎰

A bright-lights, play-money **Let It Ride** casino built as a static website —
no build step, no server. Open `index.html` in a browser (or host it on GitHub
Pages) and play.

## The game

Classic Let It Ride poker:

1. Pick a chip (1 / 5 / 10 / 25) — three equal bets go down, plus an optional
   **Three Card Bonus** side bet.
2. You get 3 cards; 2 community cards sit face down.
3. Decide twice — **pull back** a bet or **let it ride** — as the community
   cards are revealed.
4. Your final 5-card hand pays on every bet still riding (pair of 10s or
   better to win).

## Odds (published in-game via "Odds & RTP disclosure")

| Game | RTP |
|---|---|
| Let It Ride (optimal strategy) | **96.49%** |
| Three Card Bonus | **95.80%** (exact) |

Both paytables are displayed on the page at all times, and the odds modal
includes the optimal strategy the main-game RTP is based on. The Three Card
Bonus RTP is verified exhaustively over all C(52,3) = 22,100 hands; the main
paytable is the industry-standard one that yields a 3.51% house edge under
optimal play.

## The house never goes broke

- The **house vault** (seeded with 250,000 play chips) persists in
  `localStorage` and settles every bet: losing wagers flow in, winning payouts
  flow out.
- The table maximum is dynamically capped so the worst possible payout of a
  single round (three riding royal flushes plus a mini-royal bonus — 3,100×
  the unit bet) can never exceed the vault. If the vault shrinks, the limits
  shrink with it; with a positive house edge the vault grows over time, so the
  site can always pay the next player.
- Every hand is dealt from a freshly shuffled 52-card deck using a
  crypto-seeded Fisher–Yates shuffle.

## Play money only

No real money can be deposited, wagered, or won. Players start with 500 chips
and can refill for free. (Operating this with real money would require
gambling licensing — this project is entertainment/demo only.)

## Files

- `index.html` — page structure, paytables, odds & RTP disclosure modal
- `style.css` — neon marquee, chasing bulb lights, card & table styling
- `game.js` — deck, hand evaluators, bankroll accounting, game flow
