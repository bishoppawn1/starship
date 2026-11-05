# Starship // Drift

A playable pixel art space adventure about building a modular ship, managing its crew, and surviving unpredictable encounters. [Play Starship // Drift](https://bishoppawn1.github.io/starship/).

Ships, crew, equipment, pirates, and broken ship wrecks are drawn as detailed pixel sprites. Weapons use slim steel barrels and red receiver panels, and ship interiors use muted metal tones. During combat, high-resolution artwork rotates as a single image on a display-density canvas, keeping the pixel details intact without coarse stepping at different headings.

## Play

Open `index.html` in a browser, or serve this directory with any static file server. No build step or dependencies are needed. Progress saves automatically in your browser.

- The main menu offers **New Game**, **Continue Game** when a local save exists, and **Quit Game**. Starting over asks before replacing a saved run. **Main Menu** in the game saves progress and returns to the title screen; leaving during combat abandons that unresolved encounter. In a browser, Quit Game displays a closing screen because the tab itself remains under your control.
- The starter ship has mirrored engines and two forward-facing pulse cannons. In the normal ship view, click rooms to inspect, upgrade, repair, or adjust weapons. The module-placement catalog appears only while trading.
- At a trader, browse the familiar module cards, filter **Weapons** or **Systems**, and **Buy** a part. Rotate with **Q / E**, then click beside your ship to install it; hovering over an edge room snaps the preview to nearby free cells. **Install Held** uses a stored part. Uninstalled purchases remain in your hold. **Dock at Trader** reopens a trader at your current beacon. The hover preview shows the weapon mount and firing arc. Select an installed room and use **Move Room** to move or rotate it for free; upgrades, damage, and crew are preserved. **Escape** cancels. The ship must stay connected, with clear exhaust and weapon arcs.
- Assign Vega, Moss, and Iris to operate weapons or shields, repair systems, deliver ammo, or stand by. They walk through connected rooms to their stations. Gunners improve a weapon at its console, shield operators speed barrier recharge, engineers repair at the damaged room, and loaders carry ammo from the core or an ammo hold to a weapon.
- Open the **Sector Map** and choose any connected beacon. Routes go both ways, so you can revisit explored locations; cleared encounters do not pay out again. Traders retain limited stock on return visits. Reach the exit and choose **Go to Next Sector** when ready. No fleet chases you. Beacons include pirate encounters, freighter rescues, salvage, derelicts, ion storms, relays, minefields, lifeboats, and outposts. Lifeboat survivors earn a reward when delivered to an outpost; ammo crates supply the next battle; restored relays add two-way shortcuts. Traders no longer pay for survey data you have not gathered.
- In combat, **left click your ship** to select it, **scroll** to set its desired arrival angle, and **right click** the arena to move. Q / E and the on-screen buttons also change the desired angle. On touch screens, tap the ship and then tap a destination. The ship takes time to turn: each engine applies force in its mounted direction and torque from its position. Engines fire only when the flight controller needs thrust. Routes leave a wide berth around broken ship wrecks; ramming one makes the moving ship bounce away without taking collision damage.
- Pirate ships have separate command, weapon, engine, and armor rooms. Projectiles damage the room they hit. A destroyed weapon stops firing, a destroyed engine stops moving, and a destroyed command core defeats the ship.
- Wide shield arrays form a visible, rechargeable shell around the whole ship. Focused shields have more charge and faster recovery, but protect only a 105° arc in the direction the room faces. Traders offer both designs among their three support systems.
- There are **20 weapon types**, including cannons, lasers, railguns, guided missiles, torpedoes, and weapons that slow, burn, explode, chain, or pierce. Traders stock five different weapons and three support systems per new market. See the [full weapon roster](spec.md#weapon-roster).
- Select any weapon to set its **range limit**. Corner-mounted guns have two mount directions: use **MOUNT** at the trader or **TURN MOUNT 90°** in the inspector. Long-barrel guns stay fixed along the room direction.
- Except for proton lances, weapon overlays and shots stop at your ship’s hull; blocked arcs never resume on the far side. Construction prevents completely obscured conventional weapons, including when adding rooms around an existing weapon. Targets and projectiles must stay within the configured range. The proton lance passes harmlessly through your own sections and stops at the first enemy. Cannons and missiles consume ammo; lasers, ion blasters, and other electrical weapons are ammo-free. Ammo cost appears on weapon cards and in the inspector. Guided missiles automatically acquire targets, launch clear of your hull before tracking, and explode against destructible wrecks. Ion hits temporarily halve the struck system’s efficiency. Disruptors apply a wider, weaker 20% efficiency penalty to nearby systems. Tesla coils lightly damage up to four systems on one ship, losing 30% damage at each bounce.

## Publishing

The [Pages workflow](.github/workflows/pages.yml) deploys the static game when `main` changes. The game uses relative asset paths so it works under the `/starship/` project URL.

- [Game specification](spec.md)
- [Agent guide](agent.md)

## Gameplay checks

Run `node --test tests/*.test.cjs` to verify starter symmetry and save migration, trader-only purchases and installation, all 20 weapons, encounter map connectivity, pirate room damage, shield interception, wide wreck clearance and collision bounce, projectile range, rendering, trader room moves, safe missile launches, wreck destruction, and weapon effects. No packages are required.

Weapons now have varied packing shapes: six fit in one or two cells, while launchers, magazines, coils, and long accelerators use larger rooms. The trader shows each footprint beside its gun sprite. Existing ships keep their old room shapes; **Refit to New Footprint · Free** at a trader adopts a new layout after you confirm a valid position. Gatling, Gauss, and swarm weapons use timed bursts; scatter and flak salvos fire together. Behavior details on cards and inspectors come directly from the combat settings.
