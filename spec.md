# Starship game specification

## Concept

Starship is a pixel art space adventure played in the browser. The player builds a ship from functional polyomino modules, travels through space, and responds to random events. Events can include fighting pirates, rescuing a freighter, and other encounters that create choices, rewards, or danger.

The game is hosted from this repository on GitHub Pages, so the playable build must work as a static website.

## Core loop

1. Build or upgrade a ship and prepare its crew.
2. Choose a connected destination on a branching sector map.
3. Resolve the event through combat, rescue, or another appropriate action.
4. Earn or spend resources, repair damage, and continue the journey.

## Ship construction

- Ships are assembled from polyomino-shaped modules on an unbounded integer grid. There is no fixed hull boundary in any direction, including negative coordinates. The shipyard starts with a 12×10-cell viewport. Scrolling the mouse wheel zooms from 40% to 200% around the pointer, changing the visible cell count while preserving world coordinates and placement. Arrow buttons and arrow keys pan the viewport, and **Center Ship** returns to the hull at the current zoom. Art and arena dimensions follow the actual ship bounds; larger ships are not cropped to the viewport. Exterior and firing-clearance checks also work outside the original grid.
- Module shapes and placement determine the ship's layout and overall footprint.
- Each module is primarily walkable floor. One or two cells contain its system equipment or crew interaction station. Connected modules have openings for crew to pass through.
- Ship rooms use detailed pixel art with visible floor panels, hull plating, doors, consoles, weapon mounts, engine nozzles, and crew. The assembled ship is drawn into a high-resolution source sprite so its pixel details rotate with the hull as one continuous piece of artwork. The arena renders at the display’s pixel density with smooth sampling at transformed edges, rather than snapping rotations onto an enlarged pixel grid. The source art retains deliberately placed pixel details.
- Modules have distinct functions, such as weapons and engines. Additional systems can be added as the design develops.
- The ship layout affects what the ship can do in combat and how much space it needs in an arena.
- Players can upgrade systems, primarily by spending **metal**.
- New modules come from limited trader stock and enter the player's hold. The catalog cards, purchases, rotation controls, and installation grid are available while docked at a trader. The normal ship view provides inspection, weapon settings, upgrades, repairs, and navigation without the placement catalog. Installing a held module costs no extra metal; uninstalled parts stay in the hold until the next trader visit.
- While docked, selecting an installed room offers **Move Room**. Moving and rotating a room is free and preserves its identity, health, upgrades, weapon range, and crew. The original stays installed until a valid position is confirmed; **Cancel Move**, Escape, or leaving the trader cancels. The final hull must remain connected and obey clearance rules. Placement previews show the room, its actual weapon mount and direction, and a hull-clipped firing arc (or launch arc for guided missiles); invalid previews are red.
- Weapon rooms can be mirrored before placement with **Flip Weapon** or **F**; Q/E and the rotation buttons still rotate them. Mirroring reflects the footprint, console, muzzle, mount facing, reserved clearance, art, and firing overlay together. While docked, **Flip Weapon · Free** in the inspector starts a move preview with the mirrored room. The installed room stays unchanged until a valid connected placement is confirmed; canceling preserves the original. Health, upgrades, range settings, crew, and saved legacy footprints survive a flip. The mirrored state persists in saved games; older rooms remain unflipped.
- Ion engines mount at the outer hull. Their exhaust side must face connected open space, with a clear strip directly behind the engine and a second clear cell behind its central nozzle. Later construction cannot fill those cells. Weapon mounts also need an exposed outside cell, except proton lances, which can fire safely through the firing ship’s own sections.
- Rooms remain walkable interiors with small control panels. Hull plating and structural ribs occupy a separate border outside the rooms; engine nozzles and weapon barrels sit on that exterior border and rotate with the ship. Weapons use slender barrel silhouettes, charcoal outlines, neutral steel highlights, and muted red receiver panels. Barrel layouts distinguish cannon, rail, laser, rotary, scatter, missile, and energy families. Ship floors and hull plating use muted warm-gray and olive-gray metals; colored lights remain small accents. Trader cards and weapon inspectors show the actual weapon sprite.

## Encounters and combat

- Combat can involve the player's ship against one or multiple enemy ships.
- Battles take place in an arena at least 2,400 units wide and 1,800 units tall, growing further with the ships' sizes. A player-following view shows up to 1,080 × 760 world units at once, so increasing arena size does not shrink the ships. Pointer positions convert through this view to world coordinates for selection and movement.
- Arenas contain randomly generated broken ship wrecks. The route planner uses each ship's collision radius plus an eight-unit navigation margin, allowing destinations near a wreck while keeping the hull clear. Ships that have already entered this margin can route outward after a bump. A direct ram pushes the ship out and makes it rebound without room damage. Wrecks can be destroyed by weapons and then leave the navigation graph.
- Pirate ships and wrecks use detailed source sprites and the same smooth, display-density rotation as the player’s ship. Canvas resizing preserves world dimensions and mouse targeting coordinates.
- Pirate ships have separate command, weapon, engine, and armor rooms. Sector-one room health is 130 for command, 85 for weapons, 80 for engines, and 120 for armor: 415 total for an armored raider, or 295 for a rescue skiff. Every room gains 12% of its base health for each sector beyond the first, rounded to whole health. Swept shots strike the first live room on their path. Destroyed rooms stay visible as dark wreckage but no longer block later shots. Destroying the weapon stops pirate fire, destroying the engine stops its movement, and destroying the core defeats the ship even if other rooms remain.
- Wide shield arrays project a rechargeable strength pool around the whole ship, starting at **100 / 100**. Focused shields start at **160 / 160**, recharge faster, and cover a 105° sector in their facing direction. A hit subtracts its damage from the covering shield; only damage beyond the remaining strength reaches another covering shield or the hull. Even a partially recharged shield can absorb its remaining strength. Strength capacity grows by 35% of the base per room upgrade and stays independent of the room's partial health and power share. Recharge starts 1.7 seconds after a hit, at 10 strength per second for a wide shield or 16 for a focused shield, multiplied by shared power and a 40% bonus for an operator at its console. Disabled shield rooms stop projecting. The inspector, system panel, and HUD show current strength out of maximum.
- Destroyed systems stop providing their function until repaired. Partial room damage does not reduce their power share; room health and system power are separate.
- Each weapon fires from a visible mount. Its facing, range, and firing arc determine which targets it can hit. Selecting a weapon shows its art and firing arc, clipped at the first hull cell in each direction except for the proton lance’s safe passage through its own ship. Hull shadows never resume on the other side of the ship; disabled rooms still block fire.
- In the hangar, each direct-fire weapon has a saved range limit from 30 arena units up to its type’s maximum (220–650 units across the 20 designs; 420 for pulse cannons and 580 for railguns). Targeting, overlays, and projectile travel all respect that limit. Guided missile racks and swarm launchers have unlimited acquisition and flight range, ignore old saved range limits, and show **Unlimited Range** without a range input. Their short directional overlay shows the safe launch arc only.
- Corner-mounted weapons, including pulse cannons, can face either of the two exposed sides of their corner cell, independently of room rotation. Players choose the mount direction before installation or switch it in the installed cannon’s inspector. Railguns and other long-barrel weapons keep their fixed barrel direction.
- Except for proton lances, construction rejects weapons with no unobstructed direction from their firing arc to open space, and rejects additions that completely enclose an installed weapon’s firing arc. A mount cannot be switched into a completely blocked direction. Partially blocked arcs remain usable in their clear directions.

## Ship systems and power

- The command core supplies eight power units initially. Installed small power generators add to this supply. Power is shared automatically and equally between all active weapon, engine, shield, teleporter, and drone-control rooms; each reaches full performance at two units. Any output beyond that stays unused. For example, five active systems sharing eight units each receive 1.6 units and run at 80% performance. Passive rooms, generators, and the command console do not consume this supply.
- **Small Power Generators** are purchasable at every trader, including markets in existing saves, through the normal parts catalog and **Systems** filter. Each costs around 35 metal, occupies two adjacent cells, has 65 base health, and adds two shared power units without requiring crew or consuming power. The normal room upgrades add one output unit per level, up to four at level 3. Multiple installed generators stack with command-core output. Partial damage does not reduce generation; disabling a generator removes its output immediately, and repairing it restores output. Generators can be rotated and moved at traders like other rooms, and persist in the hold, hull, and market stock without restocking sold-out offers. The power panel shows total supply and the command/generator breakdown; the inspector shows each generator’s current output.
- Adding or disabling a system immediately recalculates everyone's equal share. There are no manual allocations or damage-limited power bars. Partial room damage does not change output or allocation; a destroyed system drops out of sharing, and a destroyed command core stops its power supply and ends the run.
- Lower shared power slows weapon reload, reduces engine force and torque, and slows shield recharge. It does not reduce a shield's maximum strength. Weapon, engine, and shield room upgrades improve their normal outputs without demanding additional power.
- **Upgrade Core Power** adds two output units for 40 metal at power level 1, then costs 20 more metal for each further power level. This upgrade belongs to the installed command core and is available outside combat, without a fixed upgrade limit. Existing reactor upgrade levels migrate to that core, and old manual module allocations are discarded.
- A crew member operating an engine boosts that engine's force by 25% after reaching its console. A pilot at the command console enables evasion while engines receive power: 5% base, plus 3% per engine power unit and 5% per staffed engine, capped at 45%. Each approaching enemy projectile rolls once; an evaded shot passes both shields and hull and shows **MISS**. No pilot or no functioning engines means no evasion. Only one crew bonus applies to each engine or shield room.

- Engines come in three sizes. **Compact Ion Engine** uses one cell and produces 110 base thrust for 22 metal; **Standard Ion Engine** keeps the original three-cell column and 270 thrust for 35 metal; **Heavy Ion Engine** uses a 2×3 room and produces 620 thrust for 70 metal. Their base health is 50, 80, and 125. Each consumes the same automatic share of power, reaching full output at two units; upgrades add 20% base thrust per level, and an operator adds 25%. Output applies to both translation and torque; placement and orientation still matter. Single, twin, and triple exhaust nozzles distinguish the sizes. Existing engines remain standard engines with their saved positions, health, and upgrades.
- Traders carry all three engine sizes and show footprint and base thrust on each card. The engine inspector shows actual current force alongside its base output. Older traders gain missing engine offers once, preserving sold offers and prices. Every size reserves its entire rear edge and an extra cell behind its nozzle; new rooms cannot block the exhaust. All sizes support engine crew assignments, evasion, sector jumps, and engine-related encounters.

## Ship movement controls

- Left click the player's ship to select it. Another clear selection method may also be provided.
- With the ship selected, use the mouse wheel to set its desired rotation. Show the intended orientation before the order is issued.
- Right click a point in space to order the ship to move there and arrive at the selected rotation.
- Movement and turning take time. Each engine has a mounted thrust direction and applies force at its position on the ship, producing translation and torque. Engines fire only when commanded thrust is needed. The flight controller must work with the forces the installed engines can actually produce; if only one turning direction is available, it may turn the long way around.
- Prevent the browser's context menu from interrupting right-click orders during play.

## Crew

- Ships have a persistent crew roster that can grow through trading. Each trader offers one or two named recruits for 40–55 metal. **Crew** in the market filters to recruitment cards. Hiring consumes that offer once, places the new crew member at the command console, and preserves their identity, color, position, and later job in saves. There is no fixed three-person crew limit.
- Every crew member can be assigned to pilot, operate engines, weapons or shields, repair systems, deliver ammo, or stand by. Jobs become effective at their system stations; recruits use the same movement and job rules as the starting crew.
- Assigning work reserves an available matching station, including while its operator is walking there. Weapons, engines, shields, and the pilot console each take one operator. Current operators and valid reservations stay in place; new assignments choose the nearest reachable unclaimed station. Extra crew wait at the command room until a station opens. Reassignment, disabled or removed systems, and completed repairs release reservations; saved jobs keep their valid station choices when loading.
- Repair crews spread across different damaged rooms, prioritizing the most damaged unclaimed room. Loaders reserve different ammunition-consuming weapons throughout pickup and delivery; they may share an ammo source. A loader with no available destination waits without generating ammunition.
- Crew assigned to shield operation walk to a shield console and increase its recharge rate when stationed there.
- Crew can perform support tasks, including delivering ammunition to weapons that require it.
- Crew walk along connected floor cells to system stations. An assignment becomes effective when the crew member reaches the relevant station.

## Crew health and direct orders

- Every person has 100 health. A hull hit injures living crew in the struck room for 1.5 times the hull damage, after shields. Enemy crew and your boarding party also take this damage from hits on their room. Crew at zero health die, stop all work, and remain recorded as dead in saves; natural healing does not revive them. New recruits arrive at full health. Older saves gain health without replacing existing crew.
- Living people aboard your own ship regenerate three health per second after five seconds without damage. They do not regenerate while boarding. Health appears on crew cards and wounded sprites. Time stops while an event overlay or the main menu is open.
- Click a person on the ship or their portrait to select them. Right click a reachable floor cell to walk there, in the hangar or on the rotated combat ship. A manual order pauses that person's automatic job and releases their reserved station; **Resume Assigned Job** or changing their assignment restores automatic work. **Escape** or **Select My Ship** leaves crew selection. Empty-space ship movement remains available after selecting the ship.

## Boarding and drones

- Traders sell a four-cell **Crew Teleporter** for about 75 metal and a three-cell **Drone Control** for about 65 metal. Both share reactor power as active systems and reach full performance at two power units. Each market, including older saved markets, adds missing system offers without restocking sold ones.
- Select a living person, then **Board Team (Up to 2)** on a target ship. That person and one nearby available crewmate walk to the teleporter and depart together when both reach the pad. The target must be within 600 units, the pad must be powered, and its 12-second recharge must be complete. Recharge speed follows its shared power. Single-person orders are supported by the same simulation. People away from the ship do not operate their old systems.
- The combat camera follows a selected boarder. Right click enemy floor cells, or use the room buttons, to move around that ship's connected rooms. Boarders deal 10 crew damage per second to a nearby defender; each defender deals eight per second. With no nearby defender, a stationary boarder sabotages the current room for five system damage per second. Sabotage does not hurt its own attacker. Raiders have two 70-health defenders. Defeating every defender with an assault aboard captures the ship and wins the encounter, with 12 extra metal for the intact prize.
- **Recall Crew** returns the selected person when a functioning teleporter is recharged and the target is within range. Surviving crew automatically return when their target is destroyed, the battle ends, or the player exits combat to the main menu. Reloading an interrupted combat save also returns surviving boarders; their saved injuries and deaths remain.
- Drone control comes with four reusable programs: **Combat**, **Defense**, **Repair**, and **Boarding**. New and migrated saves have five drone parts. Every deployment consumes one part. Each bay supports two drones, plus one per room upgrade, up to four. Drones deploy during battle, have 60 health, and expire at battle end; destruction or dismissal never refunds a part. Markets sell two three-part packs for 15 metal per pack and retain sold stock on return visits.
- Combat drones orbit the ship and fire six-damage laser bolts every 1.6 seconds at their selected enemy within 700 units, waiting for a clear line past their own hull. Bolts hit actual rooms and wrecks. Defense drones orbit the ship and intercept one nearby incoming projectile every 0.8 seconds. Repair drones walk to damaged rooms and restore four health per second, including disabled rooms. Boarding drones enter an enemy within 600 units and fight, sabotage, and automatically move to another functional room. Their crew damage and sabotage match a human boarder; they cannot be recalled as crew.
- Shared power scales drone firing/interception cooldowns, repair rate and movement. A disabled or powerless bay pauses its drones, including boarding attacks. Internal drones and boarders take damage from shots on their room; orbiting drones can be struck by enemy projectiles. Drone parts, current deployments, target selection and dismissal appear in **Drones & Boarding**. The design uses FTL-style deployment costs, powered drone control and autonomous roles, with this game's shared-power rules.

## Resources and progression

- **Metal** is the main resource. It is used chiefly for system upgrades and trading.
- Encounters can provide metal, supplies, rescued crew, or intact weapons. Recovered weapons enter the hold for installation at a trader. A hauler mechanic or stranded medic joins the persistent crew after rescue. New runs begin with a spare ion blaster instead of a spare armor room; older saves keep their existing inventory.
- Trading and upgrades should feed back into ship construction and readiness for future events.
- Sector charts are bidirectional networks. Players may revisit beacons, including traders and repair outposts, without replaying one-time rewards. The exit stays in the current chart until the player chooses to advance; there is no pursuing fleet.
- A chart contains one trader, one outpost, and distinct event sites including pirate raids, freighter rescues, salvage, derelicts, anomalies, relays, minefields, and lifeboats. Different scenes offer different costs and outcomes. Lifeboat passengers travel aboard until delivered to an outpost for payment; salvaged ammunition adds six rounds to the next battle; restored relays and gravity lenses open new two-way links. Traders do not pay for uncollected survey data.

## Open design choices

Longer-term combat balance, additional events and resources, more module types, deeper crew controls, and progression beyond the current sector loop are still to be decided. Develop these incrementally and record new rules here.

## Current playable version

- Combat runs in real time with exactly 20 purchasable weapon designs. Weapons differ in range, arc, damage, reload time, ammunition per trigger, projectile speed, and effects. Ion, laser, disruptor, Tesla, and proton weapons use no ammunition and still fire with an empty ammo pool. Cannons, railguns, missile launchers, torpedoes, and the plasma, cryo, and inferno projectors consume their listed ammo cost from the shared battle supply, waiting for loaders when empty. Catalogs and inspectors show the cost. Salvos share one trigger's ammo cost. Shots start at their muzzle. Direct-fire shots respect their configured travel limit; guided missiles have no distance cutoff. Direct fire respects its mounted arc and is blocked by hull cells, with the proton lance exception below.
- Missile racks and swarm launchers automatically acquire enemies anywhere in the arena regardless of distance or target bearing. They launch along a clear direction within their mount’s launch arc, stay straight until they clear the hull’s projected edge, and then home toward their target. Guided missiles keep tracking until they hit a ship or wreck, can turn back from outside the arena boundary, and reacquire the nearest living enemy if their target is destroyed. They still consume ammunition. Torpedoes remain heavy unguided explosives with a finite range; other direct-fire projectile path lengths respect their configured range. Rail and Gauss rounds hit each ship at most once; proton lances pass harmlessly through the firing ship’s own hull and stop at the first enemy or wreck instead of piercing several ships.
- Wrecks have health (twice their radius), take direct and nearby blast damage, and disappear from collision and navigation when destroyed. Explosions at wreck surfaces also damage nearby enemies whose hull intersects the blast radius. Splash hits deal 55% damage to neighboring ships.
- Ion hits halve the efficiency of the system nearest the impact for three seconds: weapon and core hits reduce firing efficiency, while engine hits reduce thrust. Each enemy has independent system status; ion hits do not apply a ship-wide movement debuff. Other slowing effects and burning expire after their stated durations. A gunner at any weapon station improves its fire rate.
- The disruptor is a broad, weaker alternative to the ion blaster: a 155° firing arc, 5 direct damage, and an 80-unit pulse that reduces every live functional system touched by the pulse to 80% efficiency for two seconds. It can affect several rooms on the struck ship and nearby ships, does not slow the entire ship, and does not damage secondary rooms.
- Tesla coils deal 6 damage to the struck system, then arc to up to three other live functional systems on that same ship. Each hop travels at most 110 units between system centers and deals 70% of the previous hit’s damage (4.2, 2.94, 2.058 at level 1). A system is hit at most once per discharge. Bounces skip armor and disabled rooms, stop when the ship is destroyed, and never jump to another ship. Visible arcs follow the ship’s rotated system positions.
- An engineer repairs a damaged module after walking to its station. A loader walks between an ammo source and a weapon to deliver ammunition.
- The starting ship has a command core, two mirrored directional ion engines, and two mirrored pulse cannons facing forward. Its occupied cells and external mounts are symmetric above and below the centerline, and its engine pair has equal opposite turning torque. An untouched legacy starter save gains the mirrored cannon automatically; customized or damaged ships are preserved. It begins with one spare ion blaster in the hold. All 20 weapons, engines, wide and focused shield arrays, small power generators, armor plating, and ammo holds can be bought and installed at traders. Each new trader draws five weapon units with replacement, so it can carry multiple copies of one weapon and omit other weapon designs. Repeated types share a card with their total quantity. It also stocks both shield designs, all three engine sizes, small power generators, and one other support-system type, plus one or two recruits. Returning traders keep their remaining parts, prices, and recruit availability; older markets gain missing shield, engine, generator, and recruit offers without restocking or expanding their saved weapon selection. Modules must connect by an edge and cannot overlap or block reserved exhaust and mount space.
- During construction, a selected module stays in placement mode when the cursor is over an installed room. The preview and click snap to a nearby valid edge position, including below the ship. Without a selected catalog module, clicking a room inspects it. Leaving a trader clears placement mode. A trader at the current beacon can be reopened with **Dock at Trader** from the ship view.
- Pirate ships are assembled from connected four-cell tetromino modules, with visible core, weapon, engine, and sometimes armor rooms. Each room has its own health and function. Arena sizing uses their actual tile count.
- Broken ship wrecks are solid to both player and pirate ships. Move orders and pirate pursuit route around them with the ship's radius plus a small clearance; a moving ship that touches a wreck rebounds.
- A destroyed command core ends the run. Other destroyed modules stop providing their function until repaired. Metal pays traders for new modules and pays for upgrades, repairs, and some encounter choices.
- A generated sector chart has connected, revisitable beacons and a dedicated exit. Pirate and some freighter destinations lead to arena combat; salvage, anomalies, derelicts, minefields, lifeboats, relays, outposts, and traders offer other choices. Completed sites remain on the chart. A new chart appears only when the player chooses **Go to Next Sector** at the exit.
- Progress is stored in the browser's local storage. The game is a static site with no account or server dependency.
- The game opens at a title menu. **Continue Game** loads the local run when its command core is intact; **New Game** replaces it after confirmation. The in-game **Main Menu** action saves and returns to the title screen. **Quit Game** ends the browser session at a closing screen with a path back to the menu; an unfinished battle is abandoned and can be attempted again from its chart beacon.

## Weapon roster

Numeric ranges below are maximum arena units; guided launchers have unlimited range. Corner mounts offer two facing choices; fixed mounts follow room rotation.

| Weapon | Range | Arc | Role |
| --- | ---: | ---: | --- |
| Pulse Cannon | 420 | 130° | General-purpose pulse fire |
| Railgun | 580 | 50° | Pierces two ships; fixed barrel |
| Autocannon | 360 | 110° | Fast accurate shells |
| Gatling Battery | 310 | 100° | Three-round burst |
| Flak Battery | 280 | 150° | Five explosive shells |
| Scatter Cannon | 220 | 140° | Seven close-range pellets |
| Plasma Cannon | 390 | 100° | Slow explosive plasma |
| Ion Blaster | 400 | 120° | Halves the struck system’s efficiency for 3 seconds; no ammo |
| Laser Repeater | 450 | 110° | Rapid high-speed laser bolts |
| Heavy Laser | 540 | 45° | Heavy focused bolt; fixed barrel |
| Missile Rack | Unlimited | 100° launch | Automatic tracking after clearing own hull |
| Swarm Launcher | Unlimited | 140° launch | Four rockets with automatic tracking after launch |
| Torpedo Tube | 650 | 35° | Heavy unguided explosion; fixed barrel |
| Siege Cannon | 600 | 30° | Maximum single-shell damage; fixed barrel |
| Disruptor | 340 | 155° | Wide 80-unit pulse reduces nearby system efficiency by 20% for 2 seconds |
| Tesla Coil | 300 | 150° | Light damage bounces through up to four systems on one ship, weakening each hop |
| Cryo Projector | 260 | 140° | Reduces movement to 40% for 4 seconds |
| Inferno Projector | 230 | 130° | Burns for 5 damage per second over 4 seconds |
| Proton Lance | 620 | 25° | Passes through own hull; stops at first enemy; fixed barrel; no ammo |
| Gauss Repeater | 510 | 55° | Two slugs, each piercing two ships; fixed barrel |

## Weapon fitting and firing patterns

The 20 weapons use ten footprint patterns. Six compact designs occupy only one or two cells. Catalog cards and inspectors show the occupied-cell diagram, cell count, dimensions, and behavior details derived from the combat settings. Rocket pods show recessed loaded rockets, torpedo tubes show a large warhead, and electrical coils and laser emitters have different silhouettes. Projectiles likewise distinguish rockets with exhaust, laser bolts, ion pulses, plasma, and incendiary shots.

Existing installed weapons keep their saved footprint and muzzle location, preserving ship layouts. While docked at a trader, **Refit to New Footprint · Free** previews the new room shape. Only confirming a valid, connected location changes the room; its identity, health, upgrades, range, and crew are preserved. Canceling retains the original room.

Gatling bursts fire three rounds 0.09 seconds apart; Gauss repeaters fire two slugs 0.12 seconds apart; swarm launchers fire four guided rockets 0.10 seconds apart. Later rounds launch from the weapon's current location and track the target between shots. Queued rounds cancel if their weapon is disabled or their target is no longer valid. Trigger ammo is paid once for the complete burst. Flak and scatter salvos fire simultaneously.

| Weapon | Cells | Footprint |
| --- | ---: | --- |
| Pulse Cannon | 3 | L corner |
| Railgun | 4 | Straight row |
| Autocannon | 2 | Domino |
| Gatling Battery | 3 | Straight row |
| Flak Battery | 4 | T |
| Scatter Cannon | 2 | Column |
| Plasma Cannon | 4 | Square |
| Ion Blaster | 1 | Single cell |
| Laser Repeater | 2 | Domino |
| Heavy Laser | 3 | Straight row |
| Missile Rack | 4 | Square |
| Swarm Launcher | 4 | Tall L |
| Torpedo Tube | 3 | Straight row |
| Siege Cannon | 5 | Long L |
| Disruptor | 3 | Column |
| Tesla Coil | 4 | T |
| Cryo Projector | 2 | Domino |
| Inferno Projector | 2 | Column |
| Proton Lance | 4 | Straight row |
| Gauss Repeater | 4 | Zigzag |
