# Brainstorm log

## Session 1 — 2026-11-13

### Research: what the "Zombie Miner" ads actually show
- The real game (*Idle Zombie Miner: Gold Tycoon*, Vistrex / Royal Ark) is an idle merge game (tap to assign zombies to break rocks). The UK ASA ruled its ads misleading because the advertised gameplay isn't in the game (only a 60s bonus stage resembles it). Source: https://www.asa.org.uk/rulings/vistrex-ltd.html
- Ad content, from YouTube "Ads Review" compilations (@puzzlegameplay etc.) — see `references/`:
  - Small bulldozer plowing huge fields of thousands of loose physics items (balls, gold bars, coins, gems) in a high 3/4 view.
  - Purple x10 / x100 multiplier gates; spiked multiplier crushers.
  - Dashed SELL pads, filling glass tanks with counters, crushers / hammers / gears / conveyors turning loot into coins.
  - Terrain slabs breaking into balls, +10 popups.
  - "UPGRADE / BUY / HIRE" floor pads, bridges unlocking new areas, Lvl 1 → 50 → 100 progression.
  - Glossy, saturated 3D toy look, cartoon zombie driver.
- Our game will be an original title in that genre (own name, character, art), not a recreation.

### What the user finds intriguing in the ads
1. Graphics look really good, seemingly realtime lighting; the golden material especially is awesome.
2. Physics look fully simulated: the bulldozer pushes large stacks of balls that roll and shift over each other.
3. Extremely satisfying gameplay: pushing balls into the multiplier gate produces a flood out the other side; smooth, good-feeling animations.
4. Solid loop: push balls into the gate, push them across the bridge into a sell area, upgrade equipment (bigger bulldozer, wider bridge, automated conveyor belt).

### Decisions
- **Core verb:** bulldozer pushing a mass of physics balls. User picked the "pushing balls with a bulldozer" ads as the reference (`ad-multiplier-gate.jpg`, `ad-wall-to-balls.jpg`).
- **Hook:** "the ad, but real". No extra gameplay layers (no puzzle gates, no hazards). Considered alternatives (gate puzzles, flood-as-hazard) were rejected.
- **Tech note (Claude):** mobile browser can handle roughly 2–5k live simulated balls (instanced rendering + custom sphere solver), not tens of thousands; use tricks (despawn/merge on crush/sell) to sell the "flood".
- **Map structure:** one continuously expanding map (preferred over discrete levels). Must be incremental: balls in each next area are bigger, look more expensive, and are worth much more.
- **Ball source:** each zone starts with a huge pre-placed field of balls; the bulldozer goes through it and fetches as much as it can push. No refill. Each field contains more than enough to clear the zone (it will usually not end up fully empty).
- **Processing:** balls are pushed into a **multiplier crusher** (spiked rollers, x10 — replaces the multiplier gate, see `ad-multiplier-crusher.jpg`), which spits out physical coins. Coins are then pushed across the bridge.
- **Upgrades / spending:** no wallet. Coins are spent by pushing them onto upgrade pads; each pad has a diegetic counter and fill bar; when full the upgrade triggers. Where you push coins = what you buy.
- **Upgrade list (accepted "for now"):** blade width, bulldozer speed, crusher multiplier (x10 → x20 …), bridge width, conveyor belt (auto-carries coins crusher → pads), unlock next zone.
- **Look & feel:** same as the ads (glossy saturated 3D toy diorama, realtime lighting, rich gold material). Driver changed from a zombie to a **cat**.
- **Camera:** high 3/4 3D follow camera, portrait on mobile.
- **Controls:** floating virtual joystick on mobile (touch anywhere + drag); WASD/arrows on desktop plus mouse drag; bulldozer turns toward stick direction.
- **Name & pitch:** **Purrdozer** — "Plow through oceans of gems with your bulldozer, crush them into avalanches of gold, and spend it all to get bigger. Yes, it's the mobile game from the ads — and this time it's real." (Picked over "Meowther Lode" and "Paw & Plow".)
- **Zone ladder (5 zones), each separated by a bridge:**
  1. Dirt quarry — small blue glass marbles — value 1
  2. Lava canyon — purple crystals (user: not cubes, must be round enough to push; physics as spheres) — value 10
  3. Ice field — large silver orbs — value 100
  4. Jungle ruin — emerald chunks — value 1k
  5. Treasure vault — big gold nuggets (hero gold material) — value 10k
- **Ending:** win screen. Final goal in the vault: fill a giant golden cat statue → ending / "you beat the ad" screen. Target ~15–20 min playthrough.
- **Ambience:** pure tactile satisfaction, chill: no fail states, no timers, nothing punishing. Audio carries it: marble clatter on the blade, crusher grind, coin cascade chimes, ka-ching pops as pads fill, upbeat light music loop.
