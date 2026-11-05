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

- Ships are assembled from polyomino-shaped modules on a grid. Module shapes and placement determine the ship's layout and overall footprint.
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
- Arenas contain randomly generated obstacles such as asteroids. Obstacles should create tactical choices without making the arena unusable.
- Pirate ships and asteroids use detailed source sprites and the same smooth, display-density rotation as the player’s ship. Canvas resizing preserves world dimensions and mouse targeting coordinates.
- Damage to ship systems matters: a damaged weapon, engine, or other module should affect its function until repaired.
- Each weapon fires from a visible mount. Its facing, range, and firing arc determine which targets it can hit. Selecting a weapon shows its art and firing arc, clipped at the first hull cell in each direction except for the proton lance’s safe passage through its own ship. Hull shadows never resume on the other side of the ship; disabled rooms still block fire.
- In the hangar, each weapon has a saved range limit from 30 arena units up to its type’s maximum (220–650 units across the 20 designs; 420 for pulse cannons and 580 for railguns). Targeting, overlays, and projectile travel all respect that limit.
- Corner-mounted weapons, including pulse cannons, can face either of the two exposed sides of their corner cell, independently of room rotation. Players choose the mount direction before installation or switch it in the installed cannon’s inspector. Railguns and other long-barrel weapons keep their fixed barrel direction.
- Except for proton lances, construction rejects weapons with no unobstructed direction from their firing arc to open space, and rejects additions that completely enclose an installed weapon’s firing arc. A mount cannot be switched into a completely blocked direction. Partially blocked arcs remain usable in their clear directions.

## Ship movement controls

- Left click the player's ship to select it. Another clear selection method may also be provided.
- With the ship selected, use the mouse wheel to set its desired rotation. Show the intended orientation before the order is issued.
- Right click a point in space to order the ship to move there and arrive at the selected rotation.
- Movement and turning take time. Each engine has a mounted thrust direction and applies force at its position on the ship, producing translation and torque. Engines fire only when commanded thrust is needed. The flight controller must work with the forces the installed engines can actually produce; if only one turning direction is available, it may turn the long way around.
- Prevent the browser's context menu from interrupting right-click orders during play.

## Crew

- Ships have crew members who can operate systems to improve their effectiveness.
- Crew can repair damaged systems.
- Crew can perform support tasks, including delivering ammunition to weapons that require it.
- Crew walk along connected floor cells to system stations. An assignment becomes effective when the crew member reaches the relevant station.

## Resources and progression

- **Metal** is the main resource. It is used chiefly for system upgrades and trading.
- Encounters can provide opportunities to gain metal, supplies, or other rewards as the game develops.
- Trading and upgrades should feed back into ship construction and readiness for future events.
- Sector charts are bidirectional networks. Players may revisit beacons, including traders and repair outposts, without replaying one-time rewards. The exit stays in the current chart until the player chooses to advance; there is no pursuing fleet.

## Open design choices

Longer-term combat balance, additional events and resources, more module types, deeper crew controls, and progression beyond the current sector loop are still to be decided. Develop these incrementally and record new rules here.

## Current playable version

- Combat runs in real time with exactly 20 purchasable weapon designs. Weapons differ in range, arc, damage, reload time, ammunition per trigger, projectile speed, and effects. Ion, laser, disruptor, Tesla, and proton weapons use no ammunition and still fire with an empty ammo pool. Cannons, railguns, missile launchers, torpedoes, and the plasma, cryo, and inferno projectors consume their listed ammo cost from the shared battle supply, waiting for loaders when empty. Catalogs and inspectors show the cost. Salvos share one trigger's ammo cost. Shots start at their muzzle and respect their configured travel limit. Direct fire respects its mounted arc and is blocked by hull cells, with the proton lance exception below.
- Missile racks and swarm launchers automatically acquire enemies within range regardless of target bearing. They launch along a clear direction within their mount’s launch arc, stay straight until they clear the hull’s projected edge, and then home toward their target. Torpedoes remain heavy unguided explosives. Actual projectile path length respects the configured range. Rail and Gauss rounds hit each ship at most once; proton lances pass harmlessly through the firing ship’s own hull and stop at the first enemy or asteroid instead of piercing several ships.
- Asteroids have health (twice their radius), take direct and nearby blast damage, and disappear from collision and navigation when destroyed. Explosions at asteroid surfaces also damage nearby enemies whose hull intersects the blast radius. Splash hits deal 55% damage to neighboring ships, and Tesla arcs deal 50% to one nearby ship with a clear path.
- Ion hits halve the efficiency of the system nearest the impact for three seconds: weapon and core hits reduce firing efficiency, while engine hits reduce thrust. Each enemy has independent system status; ion hits do not apply a ship-wide movement debuff. Other slowing effects and burning expire after their stated durations. A gunner at any weapon station improves its fire rate.
- An engineer repairs a damaged module after walking to its station. A loader walks between an ammo source and a weapon to deliver ammunition.
- The starting ship has a command core, two mirrored directional ion engines, and two mirrored pulse cannons facing forward. Its occupied cells and external mounts are symmetric above and below the centerline, and its engine pair has equal opposite turning torque. An untouched legacy starter save gains the mirrored cannon automatically; customized or damaged ships are preserved. It begins with one spare armor module. All 20 weapons, engines, shield arrays, armor plating, and ammo holds can be bought and installed at traders. Each new trader stocks five distinct weapons and two support-system types; returning traders keep their remaining stock. Older saved markets gain missing weapon and support offers once, retaining sold-out quantities and original prices. Modules must connect by an edge and cannot overlap or block reserved exhaust and mount space.
- During construction, a selected module stays in placement mode when the cursor is over an installed room. The preview and click snap to a nearby valid edge position, including below the ship. Without a selected catalog module, clicking a room inspects it. Leaving a trader clears placement mode. A trader at the current beacon can be reopened with **Dock at Trader** from the ship view.
- Pirate ships are assembled from connected four-cell tetromino modules, with visible core, weapon, engine, and sometimes armor rooms. Arena sizing uses their actual tile count.
- Asteroids are solid to both player and pirate ships. Move orders and pirate pursuit route around each asteroid with clearance for the ship's size; a ship that reaches an obstacle is stopped and steered along it.
- A destroyed command core ends the run. Other destroyed modules stop providing their function until repaired. Metal pays traders for new modules and pays for upgrades, repairs, and some encounter choices.
- A generated sector chart has connected, revisitable beacons and a dedicated exit. Pirate and freighter destinations lead to arena combat; salvage, anomalies, derelicts, outposts, and traders offer other choices. Completed sites remain on the chart. A new chart appears only when the player chooses **Go to Next Sector** at the exit.
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
| Disruptor | 340 | 125° | Area pulse reduces movement to 30% for 2 seconds |
| Tesla Coil | 300 | 150° | Chains to a nearby enemy |
| Cryo Projector | 260 | 140° | Reduces movement to 40% for 4 seconds |
| Inferno Projector | 230 | 130° | Burns for 5 damage per second over 4 seconds |
| Proton Lance | 620 | 25° | Passes through own hull; stops at first enemy; fixed barrel; no ammo |
| Gauss Repeater | 510 | 55° | Two slugs, each piercing two ships; fixed barrel |
