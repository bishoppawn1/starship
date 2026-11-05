# Starship // Drift

A playable pixel art space adventure about building a modular ship, managing its crew, and surviving unpredictable encounters. [Play Starship // Drift](https://bishoppawn1.github.io/starship/).

Ships, crew, equipment, pirates, and asteroids are drawn as detailed pixel sprites. During combat the assembled ship rotates as a single sprite, keeping its artwork crisp at every heading.

## Play

Open `index.html` in a browser, or serve this directory with any static file server. No build step or dependencies are needed. Progress saves automatically in your browser.

- The main menu offers **New Game**, **Continue Game** when a local save exists, and **Quit Game**. Starting over asks before replacing a saved run. **Main Menu** in the game saves progress and returns to the title screen; leaving during combat abandons that unresolved encounter. In a browser, Quit Game displays a closing screen because the tab itself remains under your control.
- The starter ship has mirrored engines and two forward-facing pulse cannons. In the normal ship view, click rooms to inspect, upgrade, repair, or adjust weapons. The module-placement catalog appears only while trading.
- At a trader, browse the familiar module cards, filter **Weapons** or **Systems**, and **Buy** a part. Rotate with **Q / E**, then click beside your ship to install it; hovering over an edge room snaps the preview to nearby free cells. **Install Held** uses a stored part. Uninstalled purchases remain in your hold. **Dock at Trader** reopens a trader at your current beacon. Engines and weapon mounts still need open hull space.
- Assign Vega, Moss, and Iris to operate weapons, repair systems, deliver ammo, or stand by. They walk through connected rooms to their stations. Gunners improve a weapon at its console, engineers repair at the damaged room, and loaders carry ammo from the core or an ammo hold to a weapon.
- Open the **Sector Map** and choose any connected beacon. Routes go both ways, so you can revisit explored locations; cleared encounters do not pay out again. Traders retain limited stock on return visits. Reach the exit and choose **Go to Next Sector** when ready. No fleet chases you. Encounters include pirates, freighter distress calls, salvage, anomalies, derelicts, outposts, and traders, with varied scenes and outcomes.
- In combat, **left click your ship** to select it, **scroll** to set its desired arrival angle, and **right click** the arena to move. Q / E and the on-screen buttons also change the desired angle. On touch screens, tap the ship and then tap a destination. The ship takes time to turn: each engine applies force in its mounted direction and torque from its position. Engines fire only when the flight controller needs thrust. The route line bends around asteroids, which block both your ship and enemy ships.
- There are **20 weapon types**, including cannons, lasers, railguns, guided missiles, torpedoes, and weapons that slow, burn, explode, chain, or pierce. Traders stock five different weapons and two support systems per new market. See the [full weapon roster](spec.md#weapon-roster).
- Select any weapon to set its **range limit**. Corner-mounted guns have two mount directions: use **MOUNT** at the trader or **TURN MOUNT 90°** in the inspector. Long-barrel guns stay fixed along the room direction.
- Weapon overlays and shots stop at your ship’s hull; blocked arcs never resume on the far side. Construction prevents completely obscured weapons, including when adding rooms around an existing weapon. Targets and projectiles must stay within the configured range, and firing consumes ammo.

## Publishing

The [Pages workflow](.github/workflows/pages.yml) deploys the static game when `main` changes. The game uses relative asset paths so it works under the `/starship/` project URL.

- [Game specification](spec.md)
- [Agent guide](agent.md)

## Gameplay checks

Run `node --test tests/*.test.cjs` to verify starter symmetry and save migration, trader-only purchases and installation, all 20 weapons, combat effects, construction clearance, sector connectivity, hull shadows, and projectile range. No packages are required.
