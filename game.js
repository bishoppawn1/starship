(() => {
  'use strict';

  const GRID_W = 12;
  const GRID_H = 10;
  const SAVE_KEY = 'starship-drift-save-v1';
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => min + Math.random() * (max - min);

  const MODULES = {
    core: { name: 'Command Core', short: 'C', color: '#79dce9', shape: [[0,0],[1,0],[0,1],[1,1]], hp: 170, cost: 0, description: 'Your ship is lost if the core fails.' },
    engine: { name: 'Ion Engine', short: 'E', color: '#83d8b0', shape: [[0,0],[0,1],[0,2]], hp: 80, cost: 35, description: 'Adds thrust and keeps your ship mobile.' },
    weapon: { name: 'Pulse Cannon', short: 'W', color: '#f0ad70', shape: [[0,0],[1,0],[1,1]], hp: 75, cost: 45, description: 'Automatically fires at nearby hostiles. Uses ammo.' },
    shield: { name: 'Shield Array', short: 'S', color: '#b6a0ee', shape: [[0,0],[1,0],[0,1],[1,1]], hp: 85, cost: 50, description: 'Reduces incoming damage while powered.' },
    armor: { name: 'Armor Plating', short: 'A', color: '#8c9eb9', shape: [[0,0],[1,0],[0,1]], hp: 115, cost: 20, description: 'Adds durable structure to absorb hits.' },
    cargo: { name: 'Ammo Hold', short: 'M', color: '#e5c37c', shape: [[0,0],[1,0],[2,0]], hp: 65, cost: 25, description: 'Expands ammunition capacity.' }
  };
  const BUYABLE = ['engine','weapon','shield','armor','cargo'];
  const CREW = [
    { id: 'vega', name: 'VEGA', initial: 'V', color: '#f2bd73', task: 'gun' },
    { id: 'moss', name: 'MOSS', initial: 'M', color: '#8fdab5', task: 'repair' },
    { id: 'iris', name: 'IRIS', initial: 'I', color: '#bba7ef', task: 'load' }
  ];
  const TASKS = { gun: 'Operate weapons', repair: 'Repair systems', load: 'Deliver ammo', idle: 'Stand by' };

  function newSave() {
    return {
      metal: 80, sector: 1, wins: 0, nextId: 4,
      modules: [
        { id: 1, type: 'core', x: 5, y: 4, rotation: 0, hp: 170, level: 1 },
        { id: 2, type: 'engine', x: 4, y: 4, rotation: 0, hp: 80, level: 1 },
        { id: 3, type: 'weapon', x: 6, y: 3, rotation: 0, hp: 75, level: 1 }
      ],
      crew: CREW.map((person) => ({ id: person.id, task: person.task }))
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return newSave();
      const data = JSON.parse(raw);
      if (!Array.isArray(data.modules) || !Array.isArray(data.crew) || !Number.isFinite(data.metal)) return newSave();
      if (!data.modules.some((m) => m.type === 'core')) return newSave();
      return data;
    } catch (_) { return newSave(); }
  }

  let save = loadSave();
  let mode = 'hangar';
  let selectedCatalog = null;
  let buildRotation = 0;
  let hoverCell = null;
  let selectedModuleId = 1;
  let battle = null;
  let eventOpen = false;
  let toastTimer = null;
  let lastFrame = performance.now();
  let lastHudRefresh = 0;
  const logEntries = [];
  const gridButtons = [];
  const canvas = $('combatCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) { /* The game remains playable without storage. */ }
  }
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function log(message) {
    logEntries.unshift({ sector: save.sector, message });
    logEntries.length = Math.min(logEntries.length, 6);
    $('captainsLog').innerHTML = logEntries.map((entry) => `<div class="log-entry"><strong>S${String(entry.sector).padStart(2,'0')}</strong> ${entry.message}</div>`).join('');
  }

  function rotatedShape(type, rotation) {
    let points = MODULES[type].shape.map(([x,y]) => [x,y]);
    for (let i = 0; i < rotation; i++) points = points.map(([x,y]) => [-y,x]);
    const minX = Math.min(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    return points.map(([x,y]) => [x-minX,y-minY]);
  }
  function moduleCells(module) {
    return rotatedShape(module.type, module.rotation).map(([dx,dy]) => [module.x+dx,module.y+dy]);
  }
  function occupancy() {
    const occupied = new Map();
    for (const module of save.modules) for (const [x,y] of moduleCells(module)) occupied.set(`${x},${y}`, module);
    return occupied;
  }
  function canPlace(type, x, y, rotation) {
    const occupied = occupancy();
    const cells = rotatedShape(type, rotation).map(([dx,dy]) => [x+dx,y+dy]);
    if (cells.some(([cx,cy]) => cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H || occupied.has(`${cx},${cy}`))) return false;
    return cells.some(([cx,cy]) => [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => occupied.has(`${cx+dx},${cy+dy}`)));
  }
  function maxHp(module) { return MODULES[module.type].hp + (module.level-1) * 25; }
  function selectedModule() { return save.modules.find((m) => m.id === selectedModuleId) || null; }
  function activeModules(type) { return save.modules.filter((m) => m.type === type && m.hp > 0); }
  function hullRatio() {
    const current = save.modules.reduce((sum,m) => sum + m.hp, 0);
    const total = save.modules.reduce((sum,m) => sum + maxHp(m), 0);
    return total ? current / total : 0;
  }
  function repairAll(amount) {
    let remaining = amount;
    for (const module of [...save.modules].sort((a,b) => (a.hp/maxHp(a)) - (b.hp/maxHp(b)))) {
      const used = Math.min(remaining, maxHp(module)-module.hp);
      module.hp += used;
      remaining -= used;
      if (remaining <= 0) break;
    }
    persist(); renderAll();
  }

  function createGrid() {
    const grid = $('buildGrid');
    for (let y=0; y<GRID_H; y++) for (let x=0; x<GRID_W; x++) {
      const cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'grid-cell'; cell.setAttribute('role','gridcell');
      cell.dataset.x = x; cell.dataset.y = y;
      cell.addEventListener('mouseenter', () => { hoverCell = {x,y}; renderGrid(); });
      cell.addEventListener('focus', () => { hoverCell = {x,y}; renderGrid(); });
      cell.addEventListener('click', () => onGridClick(x,y));
      grid.append(cell); gridButtons.push(cell);
    }
    grid.addEventListener('mouseleave', () => { hoverCell = null; renderGrid(); });
  }
  function miniShape(type) {
    return `<span class="mini-shape" style="--module-color:${MODULES[type].color}">${rotatedShape(type,0).map(([x,y]) => `<i style="left:${x*10}px;top:${y*10}px"></i>`).join('')}</span>`;
  }
  function renderCatalog() {
    $('catalog').innerHTML = BUYABLE.map((type) => {
      const def = MODULES[type];
      return `<button type="button" class="catalog-item ${selectedCatalog===type?'active':''}" data-type="${type}" ${save.metal<def.cost?'disabled':''} aria-pressed="${selectedCatalog===type}">${miniShape(type)}<span><strong>${def.name.toUpperCase()}</strong><small>${def.description}</small></span><span class="price">◆ ${def.cost}</span></button>`;
    }).join('');
    $('catalog').querySelectorAll('[data-type]').forEach((button) => button.addEventListener('click', () => {
      selectedCatalog = selectedCatalog === button.dataset.type ? null : button.dataset.type;
      selectedModuleId = null;
      renderAll();
    }));
  }
  function renderGrid() {
    const occupied = occupancy();
    const ghost = new Set();
    let valid = false;
    if (selectedCatalog && hoverCell) {
      valid = canPlace(selectedCatalog,hoverCell.x,hoverCell.y,buildRotation);
      for (const [dx,dy] of rotatedShape(selectedCatalog,buildRotation)) ghost.add(`${hoverCell.x+dx},${hoverCell.y+dy}`);
    }
    for (const cell of gridButtons) {
      const x = Number(cell.dataset.x), y = Number(cell.dataset.y), key = `${x},${y}`;
      const module = occupied.get(key);
      cell.className = 'grid-cell';
      cell.style.removeProperty('--module-color');
      cell.textContent = '';
      if (module) {
        cell.classList.add('occupied');
        if (module.id === selectedModuleId) cell.classList.add('selected');
        cell.style.setProperty('--module-color', MODULES[module.type].color);
        cell.innerHTML = `<span>${MODULES[module.type].short}</span>`;
        cell.setAttribute('aria-label', `${MODULES[module.type].name}, level ${module.level}, ${Math.ceil(module.hp)} health`);
      } else if (ghost.has(key)) {
        cell.classList.add('ghost');
        if (!valid) cell.classList.add('invalid');
        cell.style.setProperty('--module-color', MODULES[selectedCatalog].color);
        cell.setAttribute('aria-label', `${MODULES[selectedCatalog].name} placement ${valid?'valid':'invalid'}`);
      } else cell.setAttribute('aria-label', `Empty cell ${x+1}, ${y+1}`);
    }
    if (selectedCatalog) $('placementHint').textContent = hoverCell ? (valid ? 'CLICK TO PLACE MODULE' : 'PLACE BESIDE YOUR SHIP IN FREE CELLS') : 'HOVER OVER THE GRID TO PLACE MODULE';
    else $('placementHint').textContent = 'SELECT A MODULE TO EXPAND YOUR SHIP';
  }
  function onGridClick(x,y) {
    const existing = occupancy().get(`${x},${y}`);
    if (existing) { selectedModuleId = existing.id; selectedCatalog = null; renderAll(); return; }
    if (!selectedCatalog) { toast('Select a module from the bay first.'); return; }
    if (!canPlace(selectedCatalog,x,y,buildRotation)) { toast('Modules must fit and connect by an edge.'); return; }
    const def = MODULES[selectedCatalog];
    if (save.metal < def.cost) { toast('Not enough metal.'); return; }
    const module = { id: save.nextId++, type: selectedCatalog, x, y, rotation: buildRotation, hp: def.hp, level: 1 };
    save.modules.push(module); save.metal -= def.cost; selectedModuleId = module.id; selectedCatalog = null;
    persist(); log(`${def.name} installed.`); toast(`${def.name} installed · −${def.cost} metal`); renderAll();
  }
  function rotateBuild(step) {
    buildRotation = (buildRotation + step + 4) % 4;
    $('buildRotationLabel').textContent = `${buildRotation*90}°`;
    renderGrid();
  }
  function renderInspector() {
    const module = selectedModule();
    if (!module) { $('moduleInspector').innerHTML = '<div class="empty-inspector">Click a ship module to inspect, upgrade, or repair it.</div>'; return; }
    const def = MODULES[module.type], maximum = maxHp(module), ratio = module.hp / maximum;
    const upgradeCost = 25 * module.level + (module.type === 'core' ? 10 : 0);
    const repairCost = Math.ceil((maximum-module.hp)/10)*3;
    $('moduleInspector').innerHTML = `<div class="inspector-head"><span class="inspector-swatch" style="--module-color:${def.color}"></span><strong>${def.name.toUpperCase()} · LV ${module.level}</strong></div><div class="inspector-sub">${def.description} <span style="float:right">${Math.ceil(module.hp)}/${maximum}</span></div><div class="meter ${ratio<.35?'low':''}"><span style="width:${Math.round(ratio*100)}%"></span></div><div class="inspector-actions"><button id="upgradeModule" type="button" ${module.level>=3||save.metal<upgradeCost||mode==='combat'?'disabled':''}>UPGRADE<br>◆ ${upgradeCost}</button><button id="repairModule" type="button" ${repairCost===0||save.metal<repairCost||mode==='combat'?'disabled':''}>REPAIR<br>◆ ${repairCost}</button></div>`;
    $('upgradeModule').addEventListener('click', () => {
      if (module.level >= 3 || save.metal < upgradeCost || mode === 'combat') return;
      save.metal -= upgradeCost; module.level++; module.hp += 25;
      persist(); log(`${def.name} upgraded to level ${module.level}.`); toast(`${def.name} upgraded`); renderAll();
    });
    $('repairModule').addEventListener('click', () => {
      if (repairCost === 0 || save.metal < repairCost || mode === 'combat') return;
      save.metal -= repairCost; module.hp = maximum;
      persist(); log(`${def.name} repaired.`); toast(`${def.name} repaired`); renderAll();
    });
  }
  function renderCrew() {
    $('crewList').innerHTML = CREW.map((person) => {
      const assigned = save.crew.find((c) => c.id===person.id);
      const transit = battle?.crewTransit?.[person.id] || 0;
      return `<div class="crew-card"><div class="crew-top"><span class="crew-avatar" style="--crew-color:${person.color}">${person.initial}</span><strong>${person.name}</strong><small>${transit>0?'MOVING '+transit.toFixed(1)+'s':'ON STATION'}</small></div><select data-crew="${person.id}" aria-label="${person.name} assignment">${Object.entries(TASKS).map(([value,label]) => `<option value="${value}" ${assigned?.task===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
    }).join('');
    $('crewList').querySelectorAll('select').forEach((select) => select.addEventListener('change', () => {
      const assignment = save.crew.find((c) => c.id === select.dataset.crew);
      assignment.task = select.value;
      if (battle) battle.crewTransit[select.dataset.crew] = 2.5;
      persist(); log(`${CREW.find((c) => c.id===select.dataset.crew).name} assigned to ${TASKS[select.value].toLowerCase()}.`); renderCrew();
    }));
  }
  function renderHud() {
    $('sectorDisplay').textContent = String(save.sector).padStart(2,'0');
    $('metalDisplay').textContent = save.metal;
    $('hullDisplay').textContent = `${Math.round(hullRatio()*100)}%`;
    $('jumpButton').disabled = mode==='combat' || eventOpen || activeModules('engine').length===0;
    $('jumpButton').textContent = mode==='combat' ? 'IN COMBAT' : 'JUMP TO NEXT SIGNAL ↗';
    const shipCells = save.modules.reduce((sum,m) => sum+moduleCells(m).length,0);
    $('shipStats').innerHTML = `<div class="stat-card"><span>HULL INTEGRITY</span><strong class="${hullRatio()<.35?'bad':'good'}">${Math.round(hullRatio()*100)}%</strong></div><div class="stat-card"><span>MODULES</span><strong>${save.modules.length} <small style="font-size:9px;color:var(--muted)">/ ${shipCells} CELLS</small></strong></div><div class="stat-card"><span>WEAPONS</span><strong class="${activeModules('weapon').length?'good':'bad'}">${activeModules('weapon').length} ACTIVE</strong></div><div class="stat-card"><span>AMMUNITION</span><strong class="${mode==='combat'&&battle&&battle.ammo<=2?'warn':''}">${battle?Math.floor(battle.ammo)+' / '+battle.maxAmmo:'READY'}</strong></div>`;
    $('leftStatus').textContent = mode==='combat' ? `ENGAGED // ${battle?.enemies.filter((e)=>e.hp>0).length||0} HOSTILES` : activeModules('engine').length ? 'DOCKED // SYSTEMS READY' : 'DOCKED // ENGINE OFFLINE';
    $('footerStatus').textContent = mode==='combat' ? 'WEAPONS FREE // CREW AT STATIONS' : 'A LONG WAY FROM HOME';
    if (battle) $('enemyCountLabel').textContent = `${battle.enemies.filter((e)=>e.hp>0).length} HOSTILE${battle.enemies.filter((e)=>e.hp>0).length===1?'':'S'}`;
  }
  function renderAll() { renderCatalog(); renderGrid(); renderInspector(); renderCrew(); renderHud(); }

  function showEvent({ type, icon, title, body, choices }) {
    eventOpen = true;
    $('eventType').textContent = type;
    $('eventVisual').innerHTML = `<span>${icon}</span>`;
    $('eventTitle').textContent = title;
    $('eventBody').textContent = body;
    $('eventChoices').replaceChildren();
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = choice.label; button.disabled = !!choice.disabled;
      button.addEventListener('click', choice.action);
      $('eventChoices').append(button);
    }
    $('eventOverlay').hidden = false;
    renderHud();
  }
  function hideEvent() { eventOpen = false; $('eventOverlay').hidden = true; renderHud(); }
  function concludeEvent(title, body, icon='✦') {
    save.sector++; persist(); renderAll();
    showEvent({ type: 'TRANSMISSION COMPLETE', icon, title, body, choices: [{ label: 'RETURN TO HANGAR →', action: hideEvent }] });
  }
  function nextSignal() {
    if (mode==='combat' || eventOpen) return;
    if (!activeModules('engine').length) { toast('Repair or install an engine before jumping.'); return; }
    const roll = Math.random();
    if (roll < .34) {
      showEvent({ type: 'HOSTILE SIGNAL // PIRATES', icon: '⚔', title: 'PIRATE INTERCEPT', body: 'A raider cuts across your route and demands cargo. Their weapons are already charging.', choices: [
        { label: 'ENGAGE THE PIRATES →', action: () => startBattle('pirate') },
        { label: 'PAY 18 METAL TO PASS', disabled: save.metal<18, action: () => { save.metal-=18; log('Pirates paid off.'); concludeEvent('SAFE PASSAGE', 'The raider takes your metal and clears the lane. The crew is not pleased.', '◆'); } }
      ]});
    } else if (roll < .59) {
      showEvent({ type: 'DISTRESS SIGNAL // FREIGHTER', icon: '◇', title: 'FREIGHTER IN PERIL', body: 'A damaged freighter is pinned down by two pirate skiffs. Its captain asks for help.', choices: [
        { label: 'DEFEND THE FREIGHTER →', action: () => startBattle('rescue') },
        { label: 'SEND REPAIR SUPPLIES · −12 METAL', disabled: save.metal<12, action: () => { save.metal-=12; log('Freighter assisted with supplies.'); concludeEvent('AID DELIVERED', 'The freighter escapes while your crew transfers spare material. Its captain promises to remember you.', '◇'); } },
        { label: 'CONTINUE ON YOUR ROUTE', action: () => { log('Freighter signal left behind.'); concludeEvent('SIGNAL FADES', 'The freighter vanishes from the scope as you leave the sector.', '·'); } }
      ]});
    } else if (roll < .81) {
      showEvent({ type: 'ANOMALY // SALVAGE', icon: '✧', title: 'DRIFTING WRECKAGE', body: 'A quiet debris field contains useful metal. A sealed hold deeper inside might contain even more.', choices: [
        { label: 'COLLECT SAFE SALVAGE · +18 METAL', action: () => { save.metal+=18; log('18 metal recovered from wreckage.'); concludeEvent('SALVAGE SECURED', 'The crew stows the metal and marks the field on the chart.', '◆'); } },
        { label: 'OPEN THE SEALED HOLD', action: () => { if (Math.random()<.6) { save.metal+=38; log('38 metal found in a sealed hold.'); concludeEvent('HIDDEN CACHE', 'The hold is packed with alloy plates. Your cargo bay feels heavier.', '◆'); } else { const target=save.modules[Math.floor(Math.random()*save.modules.length)]; target.hp=Math.max(1,target.hp-25); log(`${MODULES[target.type].name} damaged by salvage trap.`); concludeEvent('TRAP SPRUNG', `A defense charge detonates. Your ${MODULES[target.type].name.toLowerCase()} takes 25 damage.`, '⚠'); } } }
      ]});
    } else {
      showEvent({ type: 'NEUTRAL SIGNAL // TRADER', icon: '◆', title: 'WAYFARER TRADER', body: 'A small trade ship offers a field repair service. Its pilot also has survey data to exchange.', choices: [
        { label: 'FIELD REPAIRS · −15 METAL', disabled: save.metal<15 || hullRatio()>=.999, action: () => { save.metal-=15; repairAll(55); log('Field repairs purchased.'); concludeEvent('REPAIRS COMPLETE', 'The trader patches the worst damage before continuing on their route.', '✚'); } },
        { label: 'SELL SURVEY DATA · +12 METAL', action: () => { save.metal+=12; log('Survey data traded for 12 metal.'); concludeEvent('TRADE COMPLETE', 'Your crew transmits recent route data and receives a crate of metal.', '◆'); } }
      ]});
    }
  }

  function newRunPrompt() {
    if (mode==='combat') { toast('Finish the encounter before starting a new run.'); return; }
    showEvent({ type: 'COMMAND // NEW RUN', icon: '↺', title: 'RESET THE JOURNEY?', body: 'This will replace your current ship, metal, sector progress, and crew assignments.', choices: [
      { label: 'START A NEW RUN', action: () => { save=newSave(); selectedModuleId=1; selectedCatalog=null; battle=null; mode='hangar'; persist(); logEntries.length=0; log('New journey initiated.'); hideEvent(); renderAll(); toast('New run started'); } },
      { label: 'KEEP CURRENT RUN', action: hideEvent }
    ]});
  }

  function activeCrew(task) {
    if (!battle) return 0;
    return save.crew.filter((c) => c.task===task && (battle.crewTransit[c.id]||0)<=0).length;
  }
  function shipRadius() {
    const cells = save.modules.flatMap(moduleCells);
    const xs = cells.map((c)=>c[0]), ys=cells.map((c)=>c[1]);
    return Math.max(25, Math.hypot(Math.max(...xs)-Math.min(...xs)+1, Math.max(...ys)-Math.min(...ys)+1)*9);
  }
  function makeAsteroids(world, count, spawnX, spawnY, enemies) {
    const rocks=[];
    for (let i=0; i<count*12 && rocks.length<count; i++) {
      const rock={x:rand(90,world.w-90),y:rand(75,world.h-75),r:rand(18,38),spin:rand(0,TAU),points:[]};
      if (Math.hypot(rock.x-spawnX,rock.y-spawnY)<135 || enemies.some((e)=>Math.hypot(rock.x-e.x,rock.y-e.y)<125)) continue;
      for (let p=0;p<9;p++) rock.points.push(rand(.72,1.16));
      rocks.push(rock);
    }
    return rocks;
  }
  function startBattle(kind) {
    hideEvent();
    mode='combat';
    const count=kind==='rescue'?2:save.sector>3&&Math.random()<.35?2:1;
    const moduleCount=save.modules.reduce((n,m)=>n+moduleCells(m).length,0);
    const enemyCellCount=count*(kind==='rescue'?6:8);
    const worldW=960+Math.min(420,moduleCount*12+enemyCellCount*6);
    const world={w:worldW,h:worldW*0.625};
    const enemies=[];
    for (let i=0;i<count;i++) enemies.push({x:world.w*.76+i*40,y:world.h*(count===1?.5:i===0?.31:.69),angle:Math.PI,hp:kind==='rescue'?68:92+save.sector*7,maxHp:kind==='rescue'?68:92+save.sector*7,r:kind==='rescue'?25:30,cooldown:rand(.6,1.6),speed:kind==='rescue'?53:43,phase:rand(0,TAU),name:kind==='rescue'?'PIRATE SKIFF':'RAIDER'});
    battle={kind,world,player:{x:world.w*.22,y:world.h*.5,angle:0,targetAngle:0,dest:null,selected:false,r:shipRadius()},enemies,asteroids:makeAsteroids(world,3+Math.ceil(moduleCount/7)+count,world.w*.22,world.h*.5,enemies),projectiles:[],stars:Array.from({length:125},()=>({x:rand(0,world.w),y:rand(0,world.h),s:Math.random()<.16?2:1})),crewTransit:{},ammo:12+activeModules('cargo').length*6,maxAmmo:12+activeModules('cargo').length*6,loaderTick:0,shake:0};
    for (const m of save.modules) m.cooldown=rand(.15,.8);
    $('hangarScreen').hidden=true; $('combatScreen').hidden=false; $('hangarTools').hidden=true; $('combatTools').hidden=false;
    $('leftTitle').textContent='TACTICAL CONTROL'; $('stageEyebrow').textContent='LIVE ENCOUNTER // COMBAT'; $('stageTitle').textContent=kind==='rescue'?'FREIGHTER DEFENSE':'PIRATE INTERCEPT';
    $('stageTag').textContent=`${count} HOSTILE${count===1?'':'S'}`; $('combatWaveLabel').textContent=kind==='rescue'?'DEFEND THE FREIGHTER':'HOSTILE CONTACT';
    $('arenaSizeLabel').textContent=`ARENA ${Math.round(world.w)} × ${Math.round(world.h)}`;
    $('combatHint').textContent='SELECT YOUR SHIP TO GIVE A MOVE ORDER';
    $('combatRotationLabel').textContent='0°';
    log(`${count} hostile ${count===1?'ship':'ships'} engaged.`); renderAll();
  }

  function finishBattle(victory) {
    if (!battle) return;
    const kind=battle.kind;
    battle=null; mode='hangar';
    $('hangarScreen').hidden=false; $('combatScreen').hidden=true; $('hangarTools').hidden=false; $('combatTools').hidden=true;
    $('leftTitle').textContent='MODULE BAY'; $('stageEyebrow').textContent='HANGAR // SHIPYARD'; $('stageTitle').textContent='BUILD YOUR SHIP'; $('stageTag').textContent='GRID 12 × 10';
    for (const module of save.modules) delete module.cooldown;
    if (victory) {
      const reward=(kind==='rescue'?48:30)+save.sector*4;
      save.metal+=reward; save.wins++;
      log(`${kind==='rescue'?'Freighter rescued':'Pirates defeated'}; ${reward} metal earned.`);
      concludeEvent(kind==='rescue'?'FREIGHTER SAVED':'PIRATES DEFEATED', kind==='rescue'?`The freighter escapes safely and transfers ${reward} metal in thanks. Repair your ship and prepare for the next jump.`:`The raider breaks apart. Your crew recovers ${reward} metal from the wreck. Repair your ship and prepare for the next jump.`, kind==='rescue'?'◇':'✦');
    } else {
      log('Command core destroyed.');
      showEvent({type:'MISSION LOST // CORE FAILURE',icon:'✕',title:'SHIP LOST',body:'Your command core was destroyed. Start a new run to build another ship and try again.',choices:[{label:'START A NEW RUN →',action:()=>{save=newSave();selectedModuleId=1;selectedCatalog=null;persist();hideEvent();logEntries.length=0;log('New journey initiated.');renderAll();}}]});
    }
    persist(); renderAll();
  }

  function angleDifference(a,b) { return Math.atan2(Math.sin(b-a),Math.cos(b-a)); }
  function approachAngle(a,b,amount) { return a+clamp(angleDifference(a,b),-amount,amount); }
  function avoidRocks(ship, vx, vy) {
    for (const rock of battle.asteroids) {
      const dx=rock.x-ship.x, dy=rock.y-ship.y, distance=Math.hypot(dx,dy)||1;
      const clearance=rock.r+ship.r+18;
      const ahead=(vx*dx+vy*dy)/distance;
      if (ahead>0 && distance<clearance+75) {
        const cross=vx*dy-vy*dx;
        const side=cross>=0?-1:1;
        const strength=(clearance+75-distance)/(clearance+75)*1.6;
        vx+=side*(-dy/distance)*strength;
        vy+=side*(dx/distance)*strength;
      }
      if (distance<clearance) {
        const strength=(clearance-distance)/clearance*1.8;
        vx-=dx/distance*strength;
        vy-=dy/distance*strength;
      }
    }
    const length=Math.hypot(vx,vy)||1;
    return [vx/length,vy/length];
  }
  function fireProjectile(owner,x,y,target,damage,speed) {
    const angle=Math.atan2(target.y-y,target.x-x);
    battle.projectiles.push({owner,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage,life:2.1});
  }
  function damagePlayer(amount) {
    const live=save.modules.filter((m)=>m.hp>0);
    if (!live.length) return;
    const shields=activeModules('shield').length;
    const final=amount*(shields?Math.max(.55,1-.2*shields):1);
    const weights=live.map((m)=>m.type==='core'?1:2);
    let roll=rand(0,weights.reduce((a,b)=>a+b,0)), target=live[0];
    for (let i=0;i<live.length;i++) { roll-=weights[i]; if (roll<=0) {target=live[i];break;} }
    target.hp=Math.max(0,target.hp-final);
    battle.shake=.12;
    if (target.hp===0) { log(`${MODULES[target.type].name} disabled!`); toast(`${MODULES[target.type].name} disabled!`); }
    if (save.modules.find((m)=>m.type==='core').hp<=0) finishBattle(false);
  }
  function updateBattle(dt, time) {
    if (!battle) return;
    const b=battle, p=b.player;
    b.shake=Math.max(0,b.shake-dt);
    for (const id of Object.keys(b.crewTransit)) b.crewTransit[id]=Math.max(0,b.crewTransit[id]-dt);
    const repairers=activeCrew('repair');
    if (repairers) {
      const target=save.modules.filter((m)=>m.hp>0 && m.hp<maxHp(m)).sort((a,c)=>a.hp/maxHp(a)-c.hp/maxHp(c))[0];
      if (target) target.hp=Math.min(maxHp(target),target.hp+dt*5*repairers);
    }
    const loaders=activeCrew('load');
    b.loaderTick+=dt*loaders*.95;
    while (b.loaderTick>=1 && b.ammo<b.maxAmmo) {b.ammo++;b.loaderTick--;}
    if (b.ammo>=b.maxAmmo) b.loaderTick=Math.min(b.loaderTick,1);

    if (p.dest && activeModules('engine').length) {
      const dx=p.dest.x-p.x,dy=p.dest.y-p.y,dist=Math.hypot(dx,dy);
      if (dist<5) p.dest=null;
      else {
        const [vx,vy]=avoidRocks(p,dx/dist,dy/dist);
        const thrust=82+activeModules('engine').reduce((n,m)=>n+12*m.level,0);
        p.x=clamp(p.x+vx*thrust*dt,p.r+5,b.world.w-p.r-5);
        p.y=clamp(p.y+vy*thrust*dt,p.r+5,b.world.h-p.r-5);
      }
    }
    p.angle=approachAngle(p.angle,p.targetAngle,dt*2.3);
    const closest=b.enemies.filter((e)=>e.hp>0).sort((a,c)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(c.x-p.x,c.y-p.y))[0];
    if (closest) for (const weapon of activeModules('weapon')) {
      weapon.cooldown-=dt;
      if (weapon.cooldown<=0 && b.ammo>=1 && Math.hypot(closest.x-p.x,closest.y-p.y)<430) {
        b.ammo--; weapon.cooldown=Math.max(.42,1.25/(1+activeCrew('gun')*.35)/(1+(weapon.level-1)*.22));
        fireProjectile('player',p.x+Math.cos(p.angle)*p.r*.5,p.y+Math.sin(p.angle)*p.r*.5,closest,14+(weapon.level-1)*5,390);
      }
    }
    for (const enemy of b.enemies) {
      if (enemy.hp<=0) continue;
      const dx=p.x-enemy.x,dy=p.y-enemy.y,dist=Math.hypot(dx,dy)||1;
      if (dist>210) {
        const [vx,vy]=avoidRocks(enemy,dx/dist,dy/dist);
        enemy.x=clamp(enemy.x+vx*enemy.speed*dt,enemy.r+5,b.world.w-enemy.r-5);
        enemy.y=clamp(enemy.y+vy*enemy.speed*dt,enemy.r+5,b.world.h-enemy.r-5);
      } else {
        enemy.x=clamp(enemy.x+Math.cos(time*.001+enemy.phase)*enemy.speed*.32*dt,enemy.r+5,b.world.w-enemy.r-5);
        enemy.y=clamp(enemy.y+Math.sin(time*.001+enemy.phase)*enemy.speed*.32*dt,enemy.r+5,b.world.h-enemy.r-5);
      }
      enemy.angle=approachAngle(enemy.angle,Math.atan2(dy,dx),dt*2);
      enemy.cooldown-=dt;
      if (enemy.cooldown<=0 && dist<470) { enemy.cooldown=rand(1.7,2.3); fireProjectile('enemy',enemy.x+Math.cos(enemy.angle)*enemy.r*.5,enemy.y+Math.sin(enemy.angle)*enemy.r*.5,p,7+save.sector*.65,270); }
    }
    for (let i=b.projectiles.length-1;i>=0;i--) {
      const shot=b.projectiles[i]; shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
      let hit=shot.life<=0 || shot.x<0 || shot.x>b.world.w || shot.y<0 || shot.y>b.world.h;
      if (!hit) hit=b.asteroids.some((rock)=>Math.hypot(shot.x-rock.x,shot.y-rock.y)<rock.r*.87);
      if (!hit && shot.owner==='player') {
        const target=b.enemies.find((e)=>e.hp>0 && Math.hypot(shot.x-e.x,shot.y-e.y)<e.r);
        if (target) {target.hp=Math.max(0,target.hp-shot.damage);hit=true;if(target.hp===0){log(`${target.name} destroyed.`);toast(`${target.name} destroyed`);}}
      } else if (!hit && shot.owner==='enemy' && Math.hypot(shot.x-p.x,shot.y-p.y)<p.r*.82) {hit=true;damagePlayer(shot.damage);if(!battle)return;}
      if (hit) b.projectiles.splice(i,1);
    }
    if (b.enemies.every((e)=>e.hp<=0)) {finishBattle(true);return;}
    if (time-lastHudRefresh>260) {lastHudRefresh=time;renderHud();renderInspector();renderCrew();}
  }

  function drawPixelShip(x,y,angle,enemy=false,object=null) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    if (enemy) {
      const r=object.r;
      ctx.fillStyle='#44283b';ctx.fillRect(-r,-r*.65,r*1.4,r*1.3);
      ctx.fillStyle='#e5737d';ctx.fillRect(-r*.5,-r*.45,r*1.35,r*.9);
      ctx.fillStyle='#f4a48d';ctx.fillRect(r*.25,-r*.25,r*.75,r*.5);
      ctx.fillStyle='#a44e66';ctx.fillRect(-r*.65,-r,r*.45,r*.45);ctx.fillRect(-r*.65,r*.55,r*.45,r*.45);
      ctx.fillStyle='#f7cf9b';ctx.fillRect(r*.65,-3,6,6);
      ctx.fillStyle='#7b9aa7';ctx.fillRect(-r-5,-5,6,10);
    } else {
      const cells=save.modules.flatMap(moduleCells),minX=Math.min(...cells.map((c)=>c[0])),maxX=Math.max(...cells.map((c)=>c[0])),minY=Math.min(...cells.map((c)=>c[1])),maxY=Math.max(...cells.map((c)=>c[1]));
      const midX=(minX+maxX)/2,midY=(minY+maxY)/2,size=18;
      for (const module of save.modules) for (const [cx,cy] of moduleCells(module)) {
        const px=Math.round((cx-midX)*size-size/2),py=Math.round((cy-midY)*size-size/2);
        ctx.fillStyle=module.hp>0?MODULES[module.type].color:'#4c5964';ctx.fillRect(px,py,size-1,size-1);
        ctx.fillStyle='#ffffff55';ctx.fillRect(px+2,py+2,size-6,2);
        ctx.fillStyle='#091a28aa';ctx.fillRect(px+size-5,py+4,2,size-7);
        if (module.type==='core') {ctx.fillStyle='#e7f9f4';ctx.fillRect(px+6,py+6,5,5);}
        if (module.type==='weapon') {ctx.fillStyle='#fff0bd';ctx.fillRect(px+size-6,py+6,5,5);}
        if (module.type==='engine' && battle && Math.random()<.65) {ctx.fillStyle='#93ecf3';ctx.fillRect(px-8,py+6,8+Math.random()*5,5);}
      }
    }
    ctx.restore();
  }
  function drawArena(time) {
    if (!battle) return;
    const b=battle,w=b.world.w,h=b.world.h,p=b.player;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.scale(canvas.width/w,canvas.height/h);
    ctx.fillStyle='#071522';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#21364c';ctx.lineWidth=1;
    for(let x=0;x<w;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<h;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(const star of b.stars){ctx.fillStyle=star.s===2?'#7da8b1':'#496a80';ctx.fillRect(star.x,star.y,star.s,star.s);}
    ctx.strokeStyle='#46718a';ctx.lineWidth=3;ctx.strokeRect(4,4,w-8,h-8);
    for (const rock of b.asteroids) {
      ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.spin);
      ctx.beginPath();for(let i=0;i<rock.points.length;i++){const a=i/rock.points.length*TAU,rad=rock.r*rock.points[i];if(i===0)ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);else ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fillStyle='#52647b';ctx.fill();ctx.strokeStyle='#8194a3';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='#303e56';ctx.fillRect(-rock.r*.32,-rock.r*.2,rock.r*.38,rock.r*.28);ctx.fillRect(rock.r*.25,rock.r*.13,rock.r*.25,rock.r*.2);ctx.restore();
    }
    if(p.dest){ctx.setLineDash([8,8]);ctx.strokeStyle='#73d6df88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.dest.x,p.dest.y);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#73d6df';ctx.strokeRect(p.dest.x-8,p.dest.y-8,16,16);ctx.beginPath();ctx.moveTo(p.dest.x,p.dest.y);ctx.lineTo(p.dest.x+Math.cos(p.targetAngle)*24,p.dest.y+Math.sin(p.targetAngle)*24);ctx.stroke();}
    for(const enemy of b.enemies){if(enemy.hp<=0)continue;drawPixelShip(enemy.x,enemy.y,enemy.angle,true,enemy);ctx.fillStyle='#0a1824';ctx.fillRect(enemy.x-25,enemy.y-enemy.r-17,50,5);ctx.fillStyle='#e47982';ctx.fillRect(enemy.x-25,enemy.y-enemy.r-17,50*enemy.hp/enemy.maxHp,5);}
    if(p.selected){ctx.strokeStyle='#86e5e6';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+13,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#86e5e6';ctx.beginPath();ctx.moveTo(p.x+Math.cos(p.targetAngle)*(p.r+13),p.y+Math.sin(p.targetAngle)*(p.r+13));ctx.lineTo(p.x+Math.cos(p.targetAngle)*(p.r+31),p.y+Math.sin(p.targetAngle)*(p.r+31));ctx.stroke();}
    if(b.shake>0){ctx.save();ctx.translate(rand(-2,2),rand(-2,2));}
    drawPixelShip(p.x,p.y,p.angle);
    if(b.shake>0)ctx.restore();
    for(const shot of b.projectiles){ctx.fillStyle=shot.owner==='player'?'#ffdb8b':'#fc8086';ctx.fillRect(shot.x-3,shot.y-3,6,6);ctx.fillStyle=shot.owner==='player'?'#e7a75f77':'#df697377';ctx.fillRect(shot.x-shot.vx*.025,shot.y-shot.vy*.025,3,3);}
    ctx.fillStyle='#a9c5cd';ctx.font='11px monospace';ctx.fillText(`SECTOR ${String(save.sector).padStart(2,'0')}   //   ${Math.round(hullRatio()*100)}% HULL`,20,h-20);
  }

  function canvasPoint(event) {
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width*battle.world.w,y:(event.clientY-rect.top)/rect.height*battle.world.h};
  }
  function selectPlayer() {if(!battle)return;battle.player.selected=true;$('combatHint').textContent='SCROLL TO ROTATE · RIGHT CLICK TO MOVE';toast('Ship selected');}
  function orderMove(point) {
    if(!battle)return;
    if(!battle.player.selected){toast('Select your ship first.');return;}
    battle.player.dest={x:clamp(point.x,battle.player.r+8,battle.world.w-battle.player.r-8),y:clamp(point.y,battle.player.r+8,battle.world.h-battle.player.r-8)};
    $('combatHint').textContent='MOVING TO WAYPOINT · RIGHT CLICK TO REDIRECT';
  }
  function rotateArrival(step) {
    if(!battle)return;
    if(!battle.player.selected){toast('Select your ship first.');return;}
    battle.player.targetAngle+=step*Math.PI/12;
    const degrees=((Math.round(battle.player.targetAngle*180/Math.PI)%360)+360)%360;
    $('combatRotationLabel').textContent=`${degrees}°`;
  }
  function frame(time) {
    const dt=Math.min(.05,(time-lastFrame)/1000||0);lastFrame=time;
    if(mode==='combat'&&battle){updateBattle(dt,time);drawArena(time);}
    requestAnimationFrame(frame);
  }

  function init() {
    createGrid();
    $('buildRotateLeft').addEventListener('click',()=>rotateBuild(-1));
    $('buildRotateRight').addEventListener('click',()=>rotateBuild(1));
    $('combatRotateLeft').addEventListener('click',()=>rotateArrival(-1));
    $('combatRotateRight').addEventListener('click',()=>rotateArrival(1));
    $('selectShipButton').addEventListener('click',selectPlayer);
    $('jumpButton').addEventListener('click',nextSignal);
    $('resetButton').addEventListener('click',newRunPrompt);
    canvas.addEventListener('contextmenu',(event)=>event.preventDefault());
    canvas.addEventListener('wheel',(event)=>{event.preventDefault();rotateArrival(event.deltaY>0?1:-1);},{passive:false});
    canvas.addEventListener('pointerdown',(event)=>{
      if(!battle)return;
      const point=canvasPoint(event);
      if(event.button===2){event.preventDefault();orderMove(point);return;}
      if(event.button!==0)return;
      if(Math.hypot(point.x-battle.player.x,point.y-battle.player.y)<battle.player.r+14) selectPlayer();
      else if(event.pointerType==='touch') orderMove(point);
    });
    document.addEventListener('keydown',(event)=>{
      if(event.target instanceof HTMLSelectElement)return;
      if(event.key.toLowerCase()==='q'){if(mode==='combat')rotateArrival(-1);else rotateBuild(-1);}
      if(event.key.toLowerCase()==='e'){if(mode==='combat')rotateArrival(1);else rotateBuild(1);}
      if(event.key==='Escape'&&mode==='hangar'&&!eventOpen){selectedCatalog=null;renderAll();}
    });
    log('Ship systems online. Choose your course.');
    renderAll();requestAnimationFrame(frame);
  }
  init();
})();
