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

- Ships are assembled from polyomino-shaped modules on an unbounded integer grid. There is no fixed hull boundary in any direction, including negative coordinates. The shipyard shows a 12×10-cell viewport; arrow buttons, arrow keys, and scrolling pan that viewport, Shift-scroll pans horizontally, and **Center Ship** returns to the hull. Art and arena dimensions follow the actual ship bounds; larger ships are not cropped to the viewport. Exterior and firing-clearance checks also work outside the original grid.
- Module shapes and placement determine the ship's layout and overall footprint.
- Each module is primarily walkable floor. One or two cells contain its system equipment or crew interaction station. Connected modules have openings for crew to pass through.
- Ship rooms use detailed pixel art with visible floor panels, hull plating, doors, consoles, weapon mounts, engine nozzles, and crew. The assembled ship is drawn into a high-resolution source sprite so its pixel details rotate with the hull as one continuous piece of artwork. The arena renders at the display’s pixel density with smooth sampling at transformed edges, rather than snapping rotations onto an enlarged pixel grid. The source art retains deliberately placed pixel details.
- Modules have distinct functions, such as weapons and engines. Additional systems can be added as the design develops.
- The ship layout affects what the ship can do in combat and how much space it needs in an arena.
- Players can upgrade systems, primarily by spending **metal**.
- New modules come from limited trader stock and enter the player's hold. The catalog cards, purchases, rotation controls, and installation grid are available while docked at a trader. The normal ship view provides inspection, weapon settings, upgrades, repairs, and navigation without the placement catalog. Installing a held module costs no extra metal; uninstalled parts stay in the hold until the next trader visit.
- While docked, selecting an installed room offers **Move Room**. Moving and rotating a room is free and preserves its identity, health, upgrades, weapon range, and crew. The original stays installed until a valid position is confirmed; **Cancel Move**, Escape, or leaving the trader cancels. The final hull must remain connected and obey clearance rules. Placement previews show the room, its actual weapon mount and direction, and a hull-clipped firing arc (or launch arc for guided missiles); invalid previews are red.
- Ion engines mount at the outer hull. Their exhaust side must face connected open space, with a clear strip directly behind the engine and a second clear cell behind its central nozzle. Later construction cannot fill those cells. Weapon mounts also need an exposed outside cell, except proton lances, which can fire safely through the firing ship’s own sections.
- Rooms remain walkable interiors with small control panels. Hull plating and structural ribs occupy a separate border outside the rooms; engine nozzles and weapon barrels sit on that exterior border and rotate with the ship. Weapons use slender barrel silhouettes, charcoal outlines, neutral steel highlights, and muted red receiver panels. Barrel layouts distinguish cannon, rail, laser, rotary, scatter, missile, and energy families. Ship floors and hull plating use muted warm-gray and olive-gray metals; colored lights remain small accents. Trader cards and weapon inspectors show the actual weapon sprite.

## Encounters and combat

- Combat can involve the player's ship against one or multiple enemy ships.
- Battles take place in an arena whose size scales with the sizes of the participating ships, leaving room to maneuver.
- Arenas contain randomly generated broken ship wrecks. The route planner keeps a wide clearance around them for both player and pirate ships. A ship that directly rams wreckage is pushed out and rebounds; the impact itself causes no room damage. Wrecks can be destroyed by weapons and then leave the navigation graph.
- Pirate ships and wrecks use detailed source sprites and the same smooth, display-density rotation as the player’s ship. Canvas resizing preserves world dimensions and mouse targeting coordinates.
- Pirate ships have separate command, weapon, engine, and armor rooms. Swept shots strike the first live room on their path. Destroyed rooms stay visible as dark wreckage but no longer block later shots. Destroying the weapon stops pirate fire, destroying the engine stops its movement, and destroying the core defeats the ship even if other rooms remain.
- Wide shield arrays project rechargeable hit layers around the whole player ship. Focused shield rooms project faster-recharging layers over a 105° sector in their facing direction. Two usable power bars provide one layer; upgraded rooms can support two or three layers with four or six bars. Each ready layer blocks one complete projectile hit, regardless of damage. An empty layer recharges after a 0.5-second delay: three seconds per wide layer or two per focused layer, accelerated by 40% with an operator at its console. A layer must fully recharge to intercept another shot. Disabled or insufficiently powered rooms stop projecting; switching power off and on does not refill layers.
- Damage to ship systems matters: a damaged weapon, engine, or other module should affect its function until repaired.
- Each weapon fires from a visible mount. Its facing, range, and firing arc determine which targets it can hit. Selecting a weapon shows its art and firing arc, clipped at the first hull cell in each direction except for the proton lance’s safe passage through its own ship. Hull shadows never resume on the other side of the ship; disabled rooms still block fire.
- In the hangar, each weapon has a saved range limit from 30 arena units up to its type’s maximum (220–650 units across the 20 designs; 420 for pulse cannons and 580 for railguns). Targeting, overlays, and projectile travel all respect that limit.
- Corner-mounted weapons, including pulse cannons, can face either of the two exposed sides of their corner cell, independently of room rotation. Players choose the mount direction before installation or switch it in the installed cannon’s inspector. Railguns and other long-barrel weapons keep their fixed barrel direction.
- Except for proton lances, construction rejects weapons with no unobstructed direction from their firing arc to open space, and rejects additions that completely enclose an installed weapon’s firing arc. A mount cannot be switched into a completely blocked direction. Partially blocked arcs remain usable in their clear directions.

## Ship systems and power

- The reactor starts with eight power bars; the starter engines use two each and the cannons one each, leaving two free. **System Power** shows allocation, damage, reactor availability, and evasion. The − / + controls work during fitting and combat. Passives, the command core, armor, and cargo need no allocated power.
- Weapons require one or two bars, depending on their design. Partial power slows reload and zero power prevents firing, including remaining queued burst rounds. Engines start with a two-bar capacity; each room upgrade adds another bar. Their directional force scales with usable bars and upgrades. Shield upgrades add capacity for another two-bar layer.
- Room damage caps usable bars at the ceiling of its maximum bars multiplied by its remaining health fraction. Allocated bars stay reserved until the player reallocates them; repairs restore usable output. Reactor allocation cannot exceed capacity. New installations use available bars and can remain offline if the reactor is full.
- **Upgrade Reactor** adds two bars for 40 metal at level 1, then costs 20 more metal for each further reactor level. Reactor upgrades are available outside combat in the ship view or at a trader, without a fixed upgrade limit. Older saves gain enough reactor capacity to keep their installed systems powered when migrated.
- A crew member operating an engine boosts that engine’s force by 25% after reaching its console. A pilot at the command console enables evasion while engines have usable power: 5% base, plus 3% per engine bar and 5% per staffed engine, capped at 45%. Each approaching enemy projectile rolls once; an evaded shot passes both shields and hull and shows **MISS**. No pilot or no powered engines means no evasion. Only one crew bonus applies to each engine or shield room.

## Ship movement controls

- Left click the player's ship to select it. Another clear selection method may also be provided.
- With the ship selected, use the mouse wheel to set its desired rotation. Show the intended orientation before the order is issued.
- Right click a point in space to order the ship to move there and arrive at the selected rotation.
- Movement and turning take time. Each engine has a mounted thrust direction and applies force at its position on the ship, producing translation and torque. Engines fire only when commanded thrust is needed. The flight controller must work with the forces the installed engines can actually produce; if only one turning direction is available, it may turn the long way around.
- Prevent the browser's context menu from interrupting right-click orders during play.

## Crew

- Ships have a persistent crew roster that can grow through trading. Each trader offers one or two named recruits for 40–55 metal. **Crew** in the market filters to recruitment cards. Hiring consumes that offer once, places the new crew member at the command console, and preserves their identity, color, position, and later job in saves. There is no fixed three-person crew limit.
- Every crew member can be assigned to pilot, operate engines, weapons or shields, repair systems, deliver ammo, or stand by. Jobs become effective at their system stations; recruits use the same movement and job rules as the starting crew.
- Crew can repair damaged systems.
- Crew assigned to shield operation walk to a shield console and increase its recharge rate when stationed there.
- Crew can perform support tasks, including delivering ammunition to weapons that require it.
- Crew walk along connected floor cells to system stations. An assignment becomes effective when the crew member reaches the relevant station.

## Resources and progression

- **Metal** is the main resource. It is used chiefly for system upgrades and trading.
- Encounters can provide opportunities to gain metal, supplies, or other rewards as the game develops.
- Trading and upgrades should feed back into ship construction and readiness for future events.
- Sector charts are bidirectional networks. Players may revisit beacons, including traders and repair outposts, without replaying one-time rewards. The exit stays in the current chart until the player chooses to advance; there is no pursuing fleet.
- A chart contains one trader, one outpost, and distinct event sites including pirate raids, freighter rescues, salvage, derelicts, anomalies, relays, minefields, and lifeboats. Different scenes offer different costs and outcomes. Lifeboat passengers travel aboard until delivered to an outpost for payment; salvaged ammunition adds six rounds to the next battle; restored relays and gravity lenses open new two-way links. Traders do not pay for uncollected survey data.

## Open design choices

Longer-term combat balance, additional events and resources, more module types, deeper crew controls, and progression beyond the current sector loop are still to be decided. Develop these incrementally and record new rules here.

## Current playable version

- Combat runs in real time with exactly 20 purchasable weapon designs. Weapons differ in range, arc, damage, reload time, ammunition per trigger, projectile speed, and effects. Ion, laser, disruptor, Tesla, and proton weapons use no ammunition and still fire with an empty ammo pool. Cannons, railguns, missile launchers, torpedoes, and the plasma, cryo, and inferno projectors consume their listed ammo cost from the shared battle supply, waiting for loaders when empty. Catalogs and inspectors show the cost. Salvos share one trigger's ammo cost. Shots start at their muzzle and respect their configured travel limit. Direct fire respects its mounted arc and is blocked by hull cells, with the proton lance exception below.
- Missile racks and swarm launchers automatically acquire enemies within range regardless of target bearing. They launch along a clear direction within their mount’s launch arc, stay straight until they clear the hull’s projected edge, and then home toward their target. Torpedoes remain heavy unguided explosives. Actual projectile path length respects the configured range. Rail and Gauss rounds hit each ship at most once; proton lances pass harmlessly through the firing ship’s own hull and stop at the first enemy or wreck instead of piercing several ships.
- Wrecks have health (twice their radius), take direct and nearby blast damage, and disappear from collision and navigation when destroyed. Explosions at wreck surfaces also damage nearby enemies whose hull intersects the blast radius. Splash hits deal 55% damage to neighboring ships.
- Ion hits halve the efficiency of the system nearest the impact for three seconds: weapon and core hits reduce firing efficiency, while engine hits reduce thrust. Each enemy has independent system status; ion hits do not apply a ship-wide movement debuff. Other slowing effects and burning expire after their stated durations. A gunner at any weapon station improves its fire rate.
- The disruptor is a broad, weaker alternative to the ion blaster: a 155° firing arc, 5 direct damage, and an 80-unit pulse that reduces every live functional system touched by the pulse to 80% efficiency for two seconds. It can affect several rooms on the struck ship and nearby ships, does not slow the entire ship, and does not damage secondary rooms.
- Tesla coils deal 6 damage to the struck system, then arc to up to three other live functional systems on that same ship. Each hop travels at most 110 units between system centers and deals 70% of the previous hit’s damage (4.2, 2.94, 2.058 at level 1). A system is hit at most once per discharge. Bounces skip armor and disabled rooms, stop when the ship is destroyed, and never jump to another ship. Visible arcs follow the ship’s rotated system positions.
- An engineer repairs a damaged module after walking to its station. A loader walks between an ammo source and a weapon to deliver ammunition.
- The starting ship has a command core, two mirrored directional ion engines, and two mirrored pulse cannons facing forward. Its occupied cells and external mounts are symmetric above and below the centerline, and its engine pair has equal opposite turning torque. An untouched legacy starter save gains the mirrored cannon automatically; customized or damaged ships are preserved. It begins with one spare armor module. All 20 weapons, engines, wide and focused shield arrays, armor plating, and ammo holds can be bought and installed at traders. Each new trader draws five weapon units with replacement, so it can carry multiple copies of one weapon and omit other weapon designs. Repeated types share a card with their total quantity. It also stocks both shield designs and one other support-system type, plus one or two recruits. Returning traders keep their remaining parts, prices, and recruit availability; older markets gain missing shield and recruit offers without restocking or expanding their saved weapon selection. Modules must connect by an edge and cannot overlap or block reserved exhaust and mount space.
- During construction, a selected module stays in placement mode when the cursor is over an installed room. The preview and click snap to a nearby valid edge position, including below the ship. Without a selected catalog module, clicking a room inspects it. Leaving a trader clears placement mode. A trader at the current beacon can be reopened with **Dock at Trader** from the ship view.
- Pirate ships are assembled from connected four-cell tetromino modules, with visible core, weapon, engine, and sometimes armor rooms. Each room has its own health and function. Arena sizing uses their actual tile count.
- Broken ship wrecks are solid to both player and pirate ships. Move orders and pirate pursuit route around them with the ship's radius plus a wide berth; a moving ship that touches a wreck rebounds.
- A destroyed command core ends the run. Other destroyed modules stop providing their function until repaired. Metal pays traders for new modules and pays for upgrades, repairs, and some encounter choices.
- A generated sector chart has connected, revisitable beacons and a dedicated exit. Pirate and some freighter destinations lead to arena combat; salvage, anomalies, derelicts, minefields, lifeboats, relays, outposts, and traders offer other choices. Completed sites remain on the chart. A new chart appears only when the player chooses **Go to Next Sector** at the exit.
- Progress is stored in the browser's local storage. The game is a static site with no account or server dependency.
- The game opens at a title menu. **Continue Game** loads the local run when its command core is intact; **New Game** replaces it after confirmation. The in-game **Main Menu** action saves and returns to the title screen. **Quit Game** ends the browser session at a closing screen with a path back to the menu; an unfinished battle is abandoned and can be attempted again from its chart beacon.

## Weapon roster

All ranges below are maximum arena units. Corner mounts offer two facing choices; fixed mounts follow room rotation.

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
| Missile Rack | 560 | 100° launch | Automatic tracking after clearing own hull |
| Swarm Launcher | 440 | 140° launch | Four rockets with automatic tracking after launch |
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
