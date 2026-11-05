# Starship // Drift

A playable pixel art space adventure about building a modular ship, managing its crew, and surviving unpredictable encounters. [Play Starship // Drift](https://bishoppawn1.github.io/starship/).

Ships, crew, equipment, pirates, and asteroids are drawn as detailed pixel sprites. During combat the assembled ship rotates as a single sprite, keeping its artwork crisp at every heading.

## Play

Open `index.html` in a browser, or serve this directory with any static file server. No build step or dependencies are needed. Progress saves automatically in your browser.

- In the hangar, install modules already in your hold. Rotate with **Q / E** or the on-screen buttons, then click beside the ship; hovering over an existing edge room snaps the preview into nearby free cells. Buy new modules from traders. Metal upgrades and repairs installed systems. Engines need open space behind their external thrusters, and weapon mounts need an exposed hull edge.
- Assign Vega, Moss, and Iris to operate weapons, repair systems, deliver ammo, or stand by. They walk through connected rooms to their stations. Gunners improve a weapon at its console, engineers repair at the damaged room, and loaders carry ammo from the core or an ammo hold to a weapon.
- Open the **Sector Map** and choose any connected beacon. Routes go both ways, so you can revisit explored locations; cleared encounters do not pay out again. Traders retain limited stock on return visits. Reach the exit and choose **Go to Next Sector** when ready. No fleet chases you. Encounters include pirates, freighter distress calls, salvage, anomalies, derelicts, outposts, and traders, with varied scenes and outcomes.
- In combat, **left click your ship** to select it, **scroll** to set its desired arrival angle, and **right click** the arena to move. Q / E and the on-screen buttons also change the desired angle. On touch screens, tap the ship and then tap a destination. The ship takes time to turn: each engine applies force in its mounted direction and torque from its position. Engines fire only when the flight controller needs thrust. The route line bends around asteroids, which block both your ship and enemy ships.
- Select a weapon in the hangar to set its **range limit** (up to 420 for pulse cannons or 580 for railguns). Pulse cannons have two corner mount directions: use **MOUNT** during placement or **TURN MOUNT 90°** in the inspector. Railguns have a fixed barrel direction.
- Weapon overlays and shots stop at your ship’s hull; blocked arcs never resume on the far side. Construction prevents completely obscured weapons, including when adding rooms around an existing weapon. Targets and projectiles must stay within the configured range, and firing consumes ammo.

## Publishing

The [Pages workflow](.github/workflows/pages.yml) deploys the static game when `main` changes. The game uses relative asset paths so it works under the `/starship/` project URL.

- [Game specification](spec.md)
- [Agent guide](agent.md)

## Gameplay checks

Run `node --test tests/*.test.cjs` to verify construction clearance, sector connectivity, trader stock, weapon geometry, hull shadows, targeting, and projectile range. No packages are required.
