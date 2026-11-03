# Starship // Drift

A playable pixel art space adventure about building a modular ship, managing its crew, and surviving unpredictable encounters. Play it at [bishoppawn1.github.io/starship](https://bishoppawn1.github.io/starship/) once GitHub Pages is enabled for the repository.

## Play

Open `index.html` in a browser, or serve this directory with any static file server. No build step or dependencies are needed. Progress saves automatically in your browser.

- In the hangar, select a polyomino module from the bay. Rotate with **Q / E** or the on-screen buttons, then click a free grid cell beside the ship to place it. Click an installed module to inspect, upgrade, or repair it using metal.
- Assign Vega, Moss, and Iris to operate weapons, repair systems, deliver ammo, or stand by. Assignments take a short time to become active during combat.
- Select **Jump to Next Signal** to find a random encounter. You may fight pirates, defend a freighter, salvage wreckage, or trade.
- In combat, **left click your ship** to select it, **scroll** to set its arrival angle, and **right click** the arena to move. Q / E and the on-screen buttons also rotate the arrival angle. On touch screens, tap the ship and then tap a destination. Weapons fire automatically when hostiles are in range and ammunition is available.

## Publishing

The [Pages workflow](.github/workflows/pages.yml) deploys the static game when `main` changes. In the repository's **Settings → Pages**, choose **GitHub Actions** as the publishing source to enable it. The game uses relative asset paths so it works under the `/starship/` project URL.

- [Game specification](spec.md)
- [Agent guide](agent.md)
