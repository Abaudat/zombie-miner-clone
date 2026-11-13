# Purrdozer — Specification

## Elevator pitch
"Plow through oceans of gems with your bulldozer, crush them into avalanches of gold, and spend it all to get bigger. Yes, it's the mobile game from the ads — and this time it's real."

## Hook
The satisfying "bulldozer pushing balls" mobile ad loop that never actually existed, made real and polished: thousands of simulated physics gems, floods of coins, and nothing else in the way. No extra systems are layered on top of the loop.

## References
- **Gameplay:** the "bulldozer pushing balls" ads for *Zombie Miner* (see `references/`): a bulldozer plowing huge fields of physics balls, multiplier crushers, floor pads, bridges unlocking new areas.
- **Visual:** the same ads — glossy, saturated 3D toy diorama, realtime lighting and shadows, rich reflective gold material.
- Purrdozer is an original game: own name, own character (a cat), own art. It does not reuse any name, character, or asset from the referenced game.

## Ambience
Pure tactile satisfaction, chill and relaxing. No fail states, no timers, nothing punishing. The player should feel the weight and mass of the pile, and the joy of a small push turning into a flood of coins.

## Style & presentation
- 3D, high 3/4 follow camera framing the bulldozer and its surroundings, like the ads.
- Portrait-first on mobile; fully playable on desktop (landscape window shows a wider view).
- Glossy toy look: saturated colors, soft realtime shadows, PBR materials, environment-map reflections; the gold material is the visual centerpiece.
- The driver is a cartoon cat in a chunky toy bulldozer.
- Juice: particle bursts at the crusher, squash-and-stretch on pads and the bulldozer, "+value" popups, coin cascades.

## Controls
- **Mobile:** floating virtual joystick — touch anywhere and drag; the bulldozer steers toward the stick direction and drives proportionally to stick deflection.
- **Desktop:** WASD / arrow keys (direction relative to the screen), or mouse click-and-drag acting as the floating joystick.

## Core loop
1. **Plow:** drive into the zone's field of gems and push as many as the blade can hold.
2. **Crush:** push the gems into the zone's **multiplier crusher** (spiked rollers between two pillars, labeled with its multiplier). Each crushed gem produces coins worth `gem value × crusher multiplier`; the coins spill out of the other side as a pile of physics coins.
3. **Haul:** push the coins across the **bridge** to the zone's pad area.
4. **Spend:** push coins onto an **upgrade pad**. Coins touching a pad are absorbed and added to its counter; the pad shows a counter and a fill bar. When the pad is full, the upgrade triggers and the pad resets to its next level cost (or disappears if maxed).
5. Upgrades make every trip bigger. Filling the **Next Zone** pad builds the bridge to the next zone.

There is no wallet: all money exists physically in the world until it is absorbed by a pad. Where the player pushes coins is how they choose what to buy.

## Map & zones
One continuous map; zones are laid out in sequence, each connected to the next by a bridge built by its Next Zone pad. Each zone contains: a large pre-placed field of gems, a multiplier crusher, a bridge, and a pad area. Fields never refill; each field holds about 1.5× the value required to complete the zone, so it is rarely emptied.

Each zone's gems are bigger, look more expensive, and are worth far more than the previous zone's.

| # | Zone | Ground | Gems | Value per gem |
|---|------|--------|------|---------------|
| 1 | Dirt Quarry | Brown dirt, rock walls | Small blue glass marbles | 1 |
| 2 | Lava Canyon | Dark rock, lava rivers | Purple rounded crystals | 10 |
| 3 | Ice Field | Snow and ice | Large silver orbs | 100 |
| 4 | Jungle Ruin | Mossy stone, foliage | Emerald chunks (rounded) | 1,000 |
| 5 | Treasure Vault | Ornate vault floor | Big gold nuggets | 10,000 |

All gems use sphere collision regardless of their visual shape, so that they roll and pile convincingly.

## Upgrades
Each upgrade is a pad in the world. Upgrade levels are global (they persist across zones); every zone's pad area offers the upgrade pads that are not yet maxed, with costs scaled to that zone's economy.

| Upgrade | Levels | Effect |
|---------|--------|--------|
| Blade Width | 5 | Wider blade, pushes more gems per trip |
| Speed | 5 | Faster bulldozer |
| Crusher Multiplier | x10 → x20 → x30 → x50 | Applies to all crushers |
| Bridge Width | 3 | Wider bridges, more coins per trip |
| Conveyor | 1 per zone | Auto-carries coins from that zone's crusher to an output chute next to its pads |
| Next Zone | 1 per zone | Builds the bridge to the next zone |

## Win condition
In the Treasure Vault, a giant golden cat statue pad replaces the Next Zone pad. Filling it plays a celebratory sequence and shows the ending screen with total gems crushed and play time, plus a Play Again option. Target playthrough: 15–20 minutes.

## Audio
All sound effects are generated procedurally in code:
- Marble/gem clatter on the blade and between gems (density-driven)
- Crusher grinding
- Coin cascade chimes
- "Ka-ching" pop when a pad completes an upgrade
- Engine hum tied to bulldozer speed
- Upbeat, light looping music
A mute toggle is always available.

## UI & flow
- **Title screen:** game title, cat-on-bulldozer key visual, Play button, language selector.
- **In-game HUD:** minimal — mute button, current zone name. No money counter (money lives on the pads).
- **Ending screen:** stats and Play Again.
- Progress (upgrade levels, pad fill amounts, unlocked zones) is auto-saved in the browser; reopening the game continues where the player left off.

## Localization
English, Spanish, French, Japanese, Simplified Chinese, Traditional Chinese. Language is auto-detected from the browser and changeable on the title screen.

## Technical
- Web build with Three.js, hosted on GitHub Pages.
- Instanced meshes for gems and coins; PBR materials with an environment map; realtime directional-light shadows.
- Custom sphere-based physics solver (spatial hash) for gems and coins, colliding with the blade, bulldozer body, walls, crushers, and bridge rails. Active body budget about 3–4k on mobile; bodies are removed when crushed or absorbed by a pad, and gems far from the bulldozer sleep.
- Assets are built procedurally or authored in Blender and exported as glTF.
