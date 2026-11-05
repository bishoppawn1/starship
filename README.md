# Starship // Drift

A playable pixel art space adventure about building a modular ship, managing its crew, and surviving unpredictable encounters. [Play Starship // Drift](https://bishoppawn1.github.io/starship/).

Ships, crew, equipment, pirates, and asteroids are drawn as detailed pixel sprites. During combat the assembled ship rotates as a single sprite, keeping its artwork crisp at every heading.

## Play

Open `index.html` in a browser, or serve this directory with any static file server. No build step or dependencies are needed. Progress saves automatically in your browser.

- In the hangar, select a polyomino room from the bay. Rotate with **Q / E** or the on-screen buttons, then click beside the ship to place it. While placing, hovering over an existing edge room snaps the preview into nearby free cells; click to build at that preview. With no room selected from the bay, click an installed room to inspect, upgrade, or repair it using metal. Selecting a weapon displays its mount and firing arc.
- Assign Vega, Moss, and Iris to operate weapons, repair systems, deliver ammo, or stand by. They walk through connected rooms to their stations. Gunners improve a weapon at its console, engineers repair at the damaged room, and loaders carry ammo from the core or an ammo hold to a weapon.
- Open the **Sector Map** and choose one of the connected destinations. Routes branch through pirate, freighter distress, salvage, and trader encounters. The chart refreshes after its final column.
- In combat, **left click your ship** to select it, **scroll** to set its desired arrival angle, and **right click** the arena to move. Q / E and the on-screen buttons also change the desired angle. On touch screens, tap the ship and then tap a destination. The ship takes time to turn: each engine applies force in its mounted direction and torque from its position. Engines fire only when the flight controller needs thrust. The route line bends around asteroids, which block both your ship and enemy ships.
- Select a weapon in the hangar to set its **range limit** (up to 420 for pulse cannons or 580 for railguns). Pulse cannons have two corner mount directions: use **MOUNT** during placement or **TURN MOUNT 90°** in the inspector. Railguns have a fixed barrel direction.
- Weapon overlays and shots stop at your ship’s hull; blocked arcs never resume on the far side. Construction prevents completely obscured weapons, including when adding rooms around an existing weapon. Targets and projectiles must stay within the configured range, and firing consumes ammo.

## Publishing

The [Pages workflow](.github/workflows/pages.yml) deploys the static game when `main` changes. The game uses relative asset paths so it works under the `/starship/` project URL.

- [Game specification](spec.md)
- [Agent guide](agent.md)

## Gameplay checks

Run `node --test tests/weapons.test.cjs` to verify weapon geometry, hull shadows, placement, mount directions, targeting, and projectile range. No packages are required.
