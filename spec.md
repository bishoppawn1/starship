# Starship game specification

## Concept

Starship is a pixel art space adventure played in the browser. The player builds a ship from functional polyomino modules, travels through space, and responds to random events. Events can include fighting pirates, rescuing a freighter, and other encounters that create choices, rewards, or danger.

The game is hosted from this repository on GitHub Pages, so the playable build must work as a static website.

## Core loop

1. Build or upgrade a ship and prepare its crew.
2. Travel through space and encounter a random event.
3. Resolve the event through combat, rescue, or another appropriate action.
4. Earn or spend resources, repair damage, and continue the journey.

## Ship construction

- Ships are assembled from polyomino-shaped modules on a grid. Module shapes and placement determine the ship's layout and overall footprint.
- Modules have distinct functions, such as weapons and engines. Additional systems can be added as the design develops.
- The ship layout affects what the ship can do in combat and how much space it needs in an arena.
- Players can upgrade systems, primarily by spending **metal**.

## Encounters and combat

- Combat can involve the player's ship against one or multiple enemy ships.
- Battles take place in an arena whose size scales with the sizes of the participating ships, leaving room to maneuver.
- Arenas contain randomly generated obstacles such as asteroids. Obstacles should create tactical choices without making the arena unusable.
- Damage to ship systems matters: a damaged weapon, engine, or other module should affect its function until repaired.

## Ship movement controls

- Left click the player's ship to select it. Another clear selection method may also be provided.
- With the ship selected, use the mouse wheel to set its desired rotation. Show the intended orientation before the order is issued.
- Right click a point in space to order the ship to move there and arrive at the selected rotation.
- Prevent the browser's context menu from interrupting right-click orders during play.

## Crew

- Ships have crew members who can operate systems to improve their effectiveness.
- Crew can repair damaged systems.
- Crew can perform support tasks, including delivering ammunition to weapons that require it.
- Crew availability and travel within the ship should make assignment choices meaningful.

## Resources and progression

- **Metal** is the main resource. It is used chiefly for system upgrades and trading.
- Encounters can provide opportunities to gain metal, supplies, or other rewards as the game develops.
- Trading and upgrades should feed back into ship construction and readiness for future events.

## Open design choices

Longer-term combat balance, additional events and resources, more module types, deeper crew controls, and progression beyond the current sector loop are still to be decided. Develop these incrementally and record new rules here.

## Current playable version

- Combat runs in real time. Working pulse cannons automatically target nearby enemies and spend ammunition. An assigned gunner improves their fire rate.
- An assigned engineer repairs damaged modules during combat, and an assigned loader restores ammunition. Changing assignments during combat has a short travel delay.
- The starting ship has a command core, ion engine, and pulse cannon. New engines, cannons, shield arrays, armor plating, and ammo holds can be added on the hangar grid. Modules must connect by an edge and cannot overlap.
- A destroyed command core ends the run. Other destroyed modules stop providing their function until repaired. Metal pays for new modules, upgrades, repairs, and some encounter choices.
- Pirate and freighter encounters lead to arena combat; salvage and trader encounters offer noncombat choices. Victories provide metal and advance to the next sector.
- Progress is stored in the browser's local storage. The game is a static site with no account or server dependency.
