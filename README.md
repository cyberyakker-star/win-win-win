# Win Win Win Casino 🎰

A bright-lights, play-money casino built as a static website — no build step, no
server. Live at **https://cyberyakker-star.github.io/win-win-win/** (GitHub Pages,
deployed from `main`).

## The games

The lobby (`index.html`) links to four games sharing one chip balance and one
persistent house vault:

| Game | RTP | Basis |
|---|---|---|
| Let It Ride | **96.49%** | optimal strategy, standard paytable |
| — Three Card Bonus side bet | **95.80%** | exact, over all C(52,3) = 22,100 hands |
| Roulette (European, single zero) | **97.30%** | exact, every bet returns 36/37 |
| Slots (3 reels, 20 stops) | **96.55%** | exact, over all 8,000 reel combinations |
| Blackjack (6 decks, S17, BJ 3:2) | **≈99.5%** | with basic strategy (decision-dependent) |

All odds are published in-game: each game shows its paytable/rules, and a shared
"Odds & RTP disclosure" modal lists every number above with how it was derived.

## The house never goes broke

- The **house vault** (seeded with 1,000,000 play chips) persists in `localStorage`
  and settles every bet across all games: losing wagers flow in, winning payouts
  flow out. Chips are exactly conserved.
- Each game caps bets so its worst possible payout can never exceed the vault
  (Let It Ride: 3,100× a unit; roulette: worst case across all 37 outcomes checked
  before every spin; slots: the 600× jackpot; blackjack: split + double exposure).
  If the vault shrinks, table limits shrink with it; with every game holding a
  house edge the vault grows over time.
- Randomness is a crypto-seeded RNG: Fisher–Yates shuffles for cards, rejection
  sampling for wheel and reels. Every round is independent.

## Play money only

No real money can be deposited, wagered, or won. Players start with 2,500 chips and
can refill for free. Chips run 1–100; in Let It Ride the Three Card Bonus is an
independent side bet (0–100) on top of the three equal main bets. (Operating this with real money would require gambling
licensing — this project is entertainment/demo only.)

## Structure

```
index.html                      lobby / game picker
letitride.html  roulette.html  slots.html  blackjack.html
css/shared.css                  marquee, cards, chips, panels, modal
css/{lobby,letitride,roulette,slots,blackjack}.css
js/bank.js                      shared chip balance + house vault
js/cards.js                     decks, card rendering, poker evaluators
js/odds.js                      shared odds & RTP disclosure modal
js/{letitride,roulette,slots,blackjack}.js
```

## Verification

Every published RTP is validated by exhaustive enumeration or exact EV math, and
the games are smoke-tested in a headless browser (rounds of each game, chip
conservation across the whole session, zero console errors).
