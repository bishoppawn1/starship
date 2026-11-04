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
- Ship rooms use detailed pixel art with visible floor panels, hull plating, doors, consoles, weapon mounts, engine nozzles, and crew. The assembled ship is rendered as one crisp sprite so its pixel details turn with the hull during flight.
- Modules have distinct functions, such as weapons and engines. Additional systems can be added as the design develops.
- The ship layout affects what the ship can do in combat and how much space it needs in an arena.
- Players can upgrade systems, primarily by spending **metal**.

## Encounters and combat

- Combat can involve the player's ship against one or multiple enemy ships.
- Battles take place in an arena whose size scales with the sizes of the participating ships, leaving room to maneuver.
- Arenas contain randomly generated obstacles such as asteroids. Obstacles should create tactical choices without making the arena unusable.
- Pirate ships and asteroids use pixel sprites that rotate without smoothing, matching the player's ship rather than appearing as simple geometric placeholders.
- Damage to ship systems matters: a damaged weapon, engine, or other module should affect its function until repaired.
- Each weapon fires from a visible mount. Its facing, range, and firing arc determine which targets it can hit. Selecting a weapon shows its art and firing arc.

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

## Open design choices

Longer-term combat balance, additional events and resources, more module types, deeper crew controls, and progression beyond the current sector loop are still to be decided. Develop these incrementally and record new rules here.

## Current playable version

- Combat runs in real time. Pulse cannons have a 130° arc; railguns have a longer range and a 50° arc. Each shot starts at its muzzle and spends ammunition. A gunner at the weapon station improves its fire rate.
- An engineer repairs a damaged module after walking to its station. A loader walks between an ammo source and a weapon to deliver ammunition.
- The starting ship has a command core, two directional ion engines, and a pulse cannon. Engines, cannons, railguns, shield arrays, armor plating, and ammo holds can be added on the hangar grid. Modules must connect by an edge and cannot overlap.
- During construction, a selected module stays in placement mode when the cursor is over an installed room. The preview and click snap to a nearby valid edge position, including below the ship. Without a selected catalog module, clicking a room inspects it.
- Pirate ships are assembled from connected four-cell tetromino modules, with visible core, weapon, engine, and sometimes armor rooms. Arena sizing uses their actual tile count.
- Asteroids are solid to both player and pirate ships. Move orders and pirate pursuit route around each asteroid with clearance for the ship's size; a ship that reaches an obstacle is stopped and steered along it.
- A destroyed command core ends the run. Other destroyed modules stop providing their function until repaired. Metal pays for new modules, upgrades, repairs, and some encounter choices.
- A generated branching map offers connected next sectors. Pirate and freighter destinations lead to arena combat; salvage and trader destinations offer noncombat choices. Resolving a destination advances the route, and a new chart appears after its last column.
- Progress is stored in the browser's local storage. The game is a static site with no account or server dependency.
