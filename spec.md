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

The exact combat pacing, event structure, additional resources, module roster, crew controls, and progression rules are still to be decided. Implement these incrementally without treating an early prototype choice as a permanent rule unless it is documented here.
