(() => {
  'use strict';

  const GRID_W = 12, GRID_H = 10, TILE = 24, COMBAT_TILE = 30, ENEMY_TILE = 22, SAVE_KEY = 'starship-drift-save-v1';
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const C = {
    core: '#78dbea', engine: '#8cd7b0', weapon: '#f4b878', railgun: '#f29490',
    shield: '#bfa6f1', armor: '#9aadc0', cargo: '#e5ca84'
  };
  const MODULES = {
    core: { name: 'Command Core', short: 'C', color: C.core, shape: [[0,0],[1,0],[0,1],[1,1]], station: [0,0], hp: 170, cost: 0, description: 'A walkable bridge with one command console.' },
    engine: { name: 'Ion Engine', short: 'E', color: C.engine, shape: [[0,0],[0,1],[0,2]], station: [0,1], hp: 80, cost: 35, thrust: 270, description: 'Hull-mounted engine. Keep two exterior cells clear behind its nozzle.' },
    weapon: { name: 'Pulse Cannon', short: 'W', color: C.weapon, shape: [[0,0],[1,0],[1,1]], station: [1,1], mount: [1,0], muzzle: [2,.5], hp: 75, cost: 45, range: 420, arc: 130, damage: 14, reload: 1.2, ammo: 1, description: 'A crewed pulse cannon with a 130° forward firing arc.' },
    railgun: { name: 'Railgun', short: 'R', color: C.railgun, shape: [[0,0],[1,0],[2,0],[3,0]], station: [1,0], mount: [3,0], muzzle: [4,.5], hp: 90, cost: 70, range: 580, arc: 50, damage: 30, reload: 2.4, ammo: 2, description: 'Long-range damage through a narrow 50° firing arc.' },
    shield: { name: 'Shield Array', short: 'S', color: C.shield, shape: [[0,0],[1,0],[0,1],[1,1]], station: [0,0], hp: 85, cost: 50, description: 'A walkable room with one shield console.' },
    armor: { name: 'Armor Plating', short: 'A', color: C.armor, shape: [[0,0],[1,0],[0,1]], station: null, hp: 115, cost: 20, description: 'Open, durable floor that can absorb damage.' },
    cargo: { name: 'Ammo Hold', short: 'M', color: C.cargo, shape: [[0,0],[1,0],[2,0]], station: [1,0], hp: 65, cost: 25, description: 'Adds ammo capacity and a loading point for crew.' }
  };
  const BUYABLE = ['engine','weapon','railgun','shield','armor','cargo'];
  const CREW = [
    { id: 'vega', name: 'VEGA', initial: 'V', color: '#f4bd77', task: 'gun', x: 5.5, y: 4.5 },
    { id: 'moss', name: 'MOSS', initial: 'M', color: '#8fddb5', task: 'repair', x: 6.5, y: 4.5 },
    { id: 'iris', name: 'IRIS', initial: 'I', color: '#c4acf1', task: 'load', x: 5.5, y: 5.5 }
  ];
  const TASKS = { gun: 'Operate weapons', repair: 'Repair systems', load: 'Deliver ammo', idle: 'Stand by' };
  const EVENT_TYPES = {
    pirate: { name: 'PIRATES', icon: '⚔' }, rescue: { name: 'DISTRESS', icon: '◇' },
    salvage: { name: 'SALVAGE', icon: '✧' }, trader: { name: 'TRADER', icon: '◆' },
    anomaly: { name: 'ANOMALY', icon: '◈' }, derelict: { name: 'DERELICT', icon: '▣' },
    outpost: { name: 'OUTPOST', icon: '⌂' }, exit: { name: 'NEXT SECTOR', icon: '➜' }
  };

  function traderStock(){
    return [...BUYABLE].sort(()=>Math.random()-.5).slice(0,3).map((type)=>({type,qty:1+Number(Math.random()<.25),price:MODULES[type].cost+Math.floor(rand(-5,11))}));
  }
  function makeMap(base) {
    const types=['pirate','rescue','salvage','trader','anomaly','derelict','outpost'];
    const nodes=[{id:'0-1',col:0,row:1,mapX:80,mapY:300,type:'start',links:[]}];
    for(let col=1;col<=4;col++)for(let row=0;row<3;row++){
      const type=col===2&&row===1?'trader':types[Math.floor(Math.random()*types.length)];
      nodes.push({id:`${col}-${row}`,col,row,mapX:80+col*168+rand(-16,16),mapY:110+row*190+rand(-31,31),type,variant:Math.floor(Math.random()*3),links:[],stock:type==='trader'?traderStock():undefined});
    }
    nodes.push({id:'5-1',col:5,row:1,mapX:920,mapY:300,type:'exit',links:[]});
    const byId=new Map(nodes.map((node)=>[node.id,node]));
    const connect=(a,b)=>{if(!byId.get(a).links.includes(b))byId.get(a).links.push(b);if(!byId.get(b).links.includes(a))byId.get(b).links.push(a);};
    for(let row=0;row<3;row++)connect('0-1',`1-${row}`);
    for(let col=1;col<4;col++)for(let row=0;row<3;row++){
      connect(`${col}-${row}`,`${col+1}-${row}`);
      if(Math.random()<.65)connect(`${col}-${row}`,`${col+1}-${clamp(row+(Math.random()<.5?-1:1),0,2)}`);
    }
    for(let row=0;row<3;row++)connect(`4-${row}`,'5-1');
    for(let col=1;col<=4;col++)for(let row=0;row<2;row++)if(Math.random()<.55)connect(`${col}-${row}`,`${col}-${row+1}`);
    return {version:2,base,nodes,current:'0-1',visited:['0-1'],resolved:['0-1']};
  }
  function newSave() {
    return {
      metal: 90, sector: 1, wins: 0, nextId: 5, inventory:{armor:1},
      modules: [
        { id: 1, type: 'core', x: 5, y: 4, rotation: 0, hp: 170, level: 1 },
        { id: 2, type: 'engine', x: 4, y: 2, rotation: 0, hp: 80, level: 1 },
        { id: 3, type: 'engine', x: 4, y: 5, rotation: 0, hp: 80, level: 1 },
        { id: 4, type: 'weapon', x: 6, y: 3, rotation: 0, hp: 75, level: 1 }
      ],
      crew: CREW.map(({id,task,x,y}) => ({id,task,x,y})),
      map: makeMap(1)
    };
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.modules) || !Array.isArray(data.crew) || !Number.isFinite(data.metal)) return null;
      if (!data.modules.some((module) => module.type === 'core')) return null;
      if (data.map?.version!==2) data.map = makeMap(data.sector || 1);
      if(!data.inventory||typeof data.inventory!=='object')data.inventory={};
      for (const template of CREW) {
        let person = data.crew.find((member) => member.id === template.id);
        if (!person) { person = { id: template.id, task: template.task }; data.crew.push(person); }
        if (!Number.isFinite(person.x)) person.x = template.x;
        if (!Number.isFinite(person.y)) person.y = template.y;
      }
      data.nextId = Math.max(data.nextId || 1, ...data.modules.map((module) => module.id + 1));
      return data;
    } catch (_) { return null; }
  }

  const storedSave = loadSave();
  let save = storedSave || newSave(), hasSave = !!storedSave, screen = 'menu', mode = 'hangar', selectedCatalog = null, selectedModuleId = 1;
  let buildRotation = 0, buildWeaponFacing = 0, hoverCell = null, battle = null, eventOpen = false, pendingNodeId = null;
  let toastTimer = null, lastFrame = performance.now(), lastHudRefresh = 0;
  const logEntries = [], gridButtons = [], crewRoutes = {};
  const canvas = $('combatCanvas'), ctx = canvas.getContext('2d');
  const hangarCanvas = $('hangarArt'), hangarCtx = hangarCanvas.getContext('2d');
  const shipSprite = document.createElement('canvas'); shipSprite.width = GRID_W*TILE; shipSprite.height = GRID_H*TILE;
  const spriteCtx = shipSprite.getContext('2d');
  const enemySprites = new Map();
  ctx.imageSmoothingEnabled = false; hangarCtx.imageSmoothingEnabled = false; spriteCtx.imageSmoothingEnabled = false;

  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); hasSave = true; } catch (_) {} }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function log(message) {
    logEntries.unshift({ sector: save.sector, message }); logEntries.length = Math.min(logEntries.length, 6);
    $('captainsLog').innerHTML = logEntries.map((entry) => `<div class="log-entry"><strong>S${String(entry.sector).padStart(2,'0')}</strong> ${entry.message}</div>`).join('');
  }
  function rotateRaw(x, y, rotation) {
    for (let i=0; i<rotation; i++) [x,y] = [-y,x];
    return [x,y];
  }
  function rotatedGeometry(type, rotation) {
    const def = MODULES[type], raw = def.shape.map(([x,y]) => rotateRaw(x,y,rotation));
    const minX = Math.min(...raw.map(([x]) => x)), minY = Math.min(...raw.map(([,y]) => y));
    const turn = ([x,y]) => { const [rx,ry] = rotateRaw(x,y,rotation); return [rx-minX,ry-minY]; };
    // Cell indices rotate about their centers; muzzle coordinates lie on cell edges.
    const turnPoint = ([x,y]) => { const [rx,ry] = rotateRaw(x-.5,y-.5,rotation); return [rx+.5-minX,ry+.5-minY]; };
    return { cells: raw.map(([x,y]) => [x-minX,y-minY]), station: def.station && turn(def.station), mount: def.mount && turn(def.mount), muzzle: def.muzzle && turnPoint(def.muzzle) };
  }
  function weaponRange(module) {
    const maximum=MODULES[module.type].range;
    return Number.isFinite(module.range)?clamp(module.range,30,maximum):maximum;
  }
  function weaponGeometry(module) {
    const geometry=rotatedGeometry(module.type,module.rotation),facing=module.type==='weapon'&&module.weaponFacing===1?-1:0;
    const direction=(module.rotation+facing)*Math.PI/2;
    const [mx,my]=geometry.mount;
    return {x:module.x+mx+.5+Math.cos(direction)*.5,y:module.y+my+.5+Math.sin(direction)*.5,direction};
  }
  // Slab intersection: ignore the cell behind an edge-mounted muzzle, but stop
  // at the first cell entered. Damaged and disabled rooms still have solid hull.
  function hullRay(origin,angle,cells,limit) {
    const dx=Math.cos(angle),dy=Math.sin(angle),epsilon=1e-8;
    let nearest=limit;
    for(const [x,y] of cells){
      let enter=-Infinity,exit=Infinity;
      for(const [start,delta,min] of [[origin.x,dx,x],[origin.y,dy,y]]){
        if(Math.abs(delta)<epsilon){if(start<min||start>min+1){exit=-Infinity;break;}}
        else {const a=(min-start)/delta,b=(min+1-start)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
      }
      if(exit>epsilon&&exit>=Math.max(0,enter)&&enter<nearest)nearest=Math.max(0,enter);
    }
    return nearest;
  }
  function weaponAngles(module,cells,smooth=false) {
    const mount=weaponGeometry(module),half=MODULES[module.type].arc*Math.PI/360;
    const angles=[-half,0,half];
    // Hull corners partition every possible shadow, including very narrow gaps.
    for(const [x,y] of cells)for(const [cx,cy] of [[x,y],[x+1,y],[x,y+1],[x+1,y+1]]){
      const angle=angleDifference(mount.direction,Math.atan2(cy-mount.y,cx-mount.x));
      if(Math.abs(angle)<=half)angles.push(clamp(angle-1e-7,-half,half),angle,clamp(angle+1e-7,-half,half));
    }
    if(smooth)for(let a=-half;a<half;a+=Math.PI/360)angles.push(a);
    angles.sort((a,b)=>a-b);
    const edges=[...new Set(angles)],result=[...edges];
    for(let i=1;i<edges.length;i++)result.push((edges[i-1]+edges[i])/2);
    return result.sort((a,b)=>a-b).map((angle)=>angle+mount.direction);
  }
  function weaponHasEscape(module,cells) {
    const mount=weaponGeometry(module),limit=Math.hypot(GRID_W,GRID_H)+2;
    return weaponAngles(module,cells).some((angle)=>hullRay(mount,angle,cells,limit)>=limit);
  }
  function weaponsHaveClearArc(modules) {
    const cells=modules.flatMap(moduleCells);
    return modules.filter((module)=>MODULES[module.type].muzzle).every((module)=>weaponHasEscape(module,cells));
  }
  function canPlace(type,x,y,rotation) {
    if(!canPlaceFootprint(type,x,y,rotation))return false;
    return weaponsHaveClearArc([...save.modules,{type,x,y,rotation,weaponFacing:buildWeaponFacing}]);
  }
  function moduleCells(module) { return rotatedGeometry(module.type,module.rotation).cells.map(([x,y]) => [x+module.x,y+module.y]); }
  function moduleStation(module) {
    const geometry = rotatedGeometry(module.type,module.rotation);
    const [x,y] = geometry.station || geometry.cells[0];
    return {x:module.x+x+.5,y:module.y+y+.5};
  }
  function occupancy() {
    const occupied = new Map();
    for (const module of save.modules) for (const [x,y] of moduleCells(module)) occupied.set(`${x},${y}`,module);
    return occupied;
  }
  function shipBounds() {
    const cells = save.modules.flatMap(moduleCells), xs=cells.map(([x])=>x), ys=cells.map(([,y])=>y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    return {minX,maxX,minY,maxY,cx:(minX+maxX+1)/2,cy:(minY+maxY+1)/2};
  }
  function moduleClearance(module){
    if(module.type==='engine'){
      const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][module.rotation],cells=moduleCells(module);
      const own=new Set(cells.map(([x,y])=>`${x},${y}`));
      const rear=cells.filter(([x,y])=>!own.has(`${x-dx},${y-dy}`)).map(([x,y])=>[x-dx,y-dy]);
      const station=rotatedGeometry('engine',module.rotation).station;
      rear.push([module.x+station[0]-2*dx,module.y+station[1]-2*dy]);
      return rear;
    }
    if(MODULES[module.type].muzzle){
      const mount=weaponGeometry(module);
      return [[Math.floor(mount.x+Math.cos(mount.direction)*1e-7),Math.floor(mount.y+Math.sin(mount.direction)*1e-7)]];
    }
    return [];
  }
  function exteriorCells(blocked){
    const outside=new Set(),queue=[];
    for(let y=0;y<GRID_H;y++)for(let x=0;x<GRID_W;x++){
      if(x!==0&&y!==0&&x!==GRID_W-1&&y!==GRID_H-1)continue;
      const key=`${x},${y}`;if(!blocked.has(key)){outside.add(key);queue.push([x,y]);}
    }
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
        if(nx<0||nx>=GRID_W||ny<0||ny>=GRID_H||outside.has(key)||blocked.has(key))continue;
        outside.add(key);queue.push([nx,ny]);
      }
    }
    return outside;
  }
  function hasClearMount(module){
    const occupied=occupancy(),reserved=new Set(save.modules.filter((other)=>other.id!==module.id).flatMap(moduleClearance).map(([x,y])=>`${x},${y}`));
    const outside=exteriorCells(new Set(occupied.keys()));
    return moduleClearance(module).every(([x,y])=>x>=0&&x<GRID_W&&y>=0&&y<GRID_H&&!occupied.has(`${x},${y}`)&&!reserved.has(`${x},${y}`)&&outside.has(`${x},${y}`));
  }
  function canPlaceFootprint(type,x,y,rotation) {
    const occupied=occupancy(),candidate={type,x,y,rotation,weaponFacing:buildWeaponFacing},cells=moduleCells(candidate);
    if(cells.some(([cx,cy])=>cx<0||cx>=GRID_W||cy<0||cy>=GRID_H||occupied.has(`${cx},${cy}`)))return false;
    const reserved=new Set(save.modules.flatMap(moduleClearance).map(([cx,cy])=>`${cx},${cy}`));
    if(cells.some(([cx,cy])=>reserved.has(`${cx},${cy}`)))return false;
    if(!cells.some(([cx,cy])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>occupied.has(`${cx+dx},${cy+dy}`))))return false;
    const blocked=new Set([...occupied.keys(),...cells.map(([cx,cy])=>`${cx},${cy}`)]);
    const clearance=moduleClearance(candidate);
    if(clearance.some(([cx,cy])=>cx<0||cx>=GRID_W||cy<0||cy>=GRID_H||blocked.has(`${cx},${cy}`)))return false;
    const outside=exteriorCells(blocked);
    return clearance.every(([cx,cy])=>outside.has(`${cx},${cy}`));
  }
  function placementAt(type,x,y,rotation) {
    if(canPlace(type,x,y,rotation))return {x,y,valid:true};
    const occupied=occupancy();
    if(!occupied.has(`${x},${y}`))return {x,y,valid:false};
    const shape=rotatedGeometry(type,rotation).cells,bounds=shipBounds();
    const outwardX=x+.5-bounds.cx,outwardY=y+.5-bounds.cy;
    let best=null,bestScore=Infinity;
    for(let cy=0;cy<GRID_H;cy++)for(let cx=0;cx<GRID_W;cx++){
      if(!canPlace(type,cx,cy,rotation))continue;
      const cells=shape.map(([dx,dy])=>[cx+dx,cy+dy]);
      const nearest=Math.min(...cells.map(([px,py])=>Math.abs(px-x)+Math.abs(py-y)));
      if(nearest!==1)continue;
      const centerX=cells.reduce((sum,[px])=>sum+px+.5,0)/cells.length;
      const centerY=cells.reduce((sum,[,py])=>sum+py+.5,0)/cells.length;
      const direction=(centerX-x-.5)*outwardX+(centerY-y-.5)*outwardY;
      const score=Math.hypot(centerX-x-.5,centerY-y-.5)-direction*.05;
      if(score<bestScore){bestScore=score;best={x:cx,y:cy,valid:true};}
    }
    return best||{x,y,valid:false};
  }
  function maxHp(module) { return MODULES[module.type].hp+(module.level-1)*25; }
  function selectedModule() { return save.modules.find((module)=>module.id===selectedModuleId) || null; }
  function activeModules(...types) { return save.modules.filter((module)=>types.includes(module.type)&&module.hp>0); }
  function hullRatio() { return save.modules.reduce((sum,module)=>sum+module.hp,0)/save.modules.reduce((sum,module)=>sum+maxHp(module),0); }
  function currentMapNode() { return save.map.nodes.find((node)=>node.id===save.map.current); }
  function availableNodes() { return currentMapNode()?.links || []; }
  function repairAll(amount) {
    let remaining=amount;
    for(const module of [...save.modules].sort((a,b)=>a.hp/maxHp(a)-b.hp/maxHp(b))) {
      const used=Math.min(remaining,maxHp(module)-module.hp); module.hp+=used;remaining-=used;if(remaining<=0)break;
    }
    persist();renderAll();
  }

  function createGrid() {
    const grid=$('buildGrid');
    for(let y=0;y<GRID_H;y++) for(let x=0;x<GRID_W;x++) {
      const cell=document.createElement('button');cell.type='button';cell.className='grid-cell';cell.setAttribute('role','gridcell');
      cell.dataset.x=x;cell.dataset.y=y;
      cell.addEventListener('mouseenter',()=>{hoverCell={x,y};renderGrid();});
      cell.addEventListener('focus',()=>{hoverCell={x,y};renderGrid();});
      cell.addEventListener('click',()=>onGridClick(x,y));
      grid.append(cell);gridButtons.push(cell);
    }
    grid.addEventListener('mouseleave',()=>{hoverCell=null;renderGrid();});
  }
  function miniShape(type) {
    return `<span class="mini-shape" style="--module-color:${MODULES[type].color}">${rotatedGeometry(type,0).cells.map(([x,y])=>`<i style="left:${x*9}px;top:${y*9}px"></i>`).join('')}</span>`;
  }
  function renderCatalog() {
    $('catalog').innerHTML=BUYABLE.map((type)=>{
      const def=MODULES[type],count=save.inventory[type]||0;
      return `<button type="button" class="catalog-item ${selectedCatalog===type?'active':''}" data-type="${type}" ${count<1?'disabled':''} aria-pressed="${selectedCatalog===type}">${miniShape(type)}<span><strong>${def.name.toUpperCase()}</strong><small>${def.description}</small></span><span class="price">${count?`IN HOLD ×${count}`:'TRADER ONLY'}</span></button>`;
    }).join('');
    $('catalog').querySelectorAll('[data-type]').forEach((button)=>button.addEventListener('click',()=>{
      selectedCatalog=selectedCatalog===button.dataset.type?null:button.dataset.type;selectedModuleId=null;renderAll();
    }));
  }
  function renderGrid() {
    const occupied=occupancy(),ghost=new Set(),reserved=new Map();let valid=false;
    for(const module of save.modules)for(const [rx,ry] of moduleClearance(module))reserved.set(`${rx},${ry}`,module.type);
    if(selectedCatalog&&hoverCell){const place=placementAt(selectedCatalog,hoverCell.x,hoverCell.y,buildRotation);valid=place.valid;for(const [dx,dy] of rotatedGeometry(selectedCatalog,buildRotation).cells)ghost.add(`${place.x+dx},${place.y+dy}`);}
    for(const cell of gridButtons){
      const x=+cell.dataset.x,y=+cell.dataset.y,key=`${x},${y}`,module=occupied.get(key);
      cell.className='grid-cell';cell.style.removeProperty('--module-color');cell.textContent='';
      if(module){cell.classList.add('occupied');if(module.id===selectedModuleId)cell.classList.add('selected');cell.style.setProperty('--module-color',MODULES[module.type].color);cell.setAttribute('aria-label',`${MODULES[module.type].name}, level ${module.level}, ${Math.ceil(module.hp)} health`);}
      else if(ghost.has(key)){cell.classList.add('ghost');if(!valid)cell.classList.add('invalid');cell.style.setProperty('--module-color',MODULES[selectedCatalog].color);cell.setAttribute('aria-label',`${MODULES[selectedCatalog].name} placement ${valid?'valid':'invalid'}`);}
      else if(reserved.has(key)){cell.classList.add('reserved');cell.setAttribute('aria-label',`${reserved.get(key)==='engine'?'Engine exhaust':'Weapon mount'} clearance, keep empty`);}
      else cell.setAttribute('aria-label',`Empty cell ${x+1}, ${y+1}`);
    }
    $('placementHint').textContent=selectedCatalog?(hoverCell?(valid?'CLICK TO INSTALL HELD MODULE':'ROOMS NEED OPEN HULL SPACE AND CLEAR EXHAUST'):'HOVER OVER THE GRID TO INSTALL MODULE'):'INSTALL STORED PARTS · UPGRADE SYSTEMS WITH METAL';
    $('buildWeaponFacing').hidden=selectedCatalog!=='weapon';
    $('buildWeaponFacing').textContent=`MOUNT: ${['RIGHT','DOWN','LEFT','UP'][(buildRotation+(buildWeaponFacing?3:0))%4]} ↻`;
    drawHangar();
  }
  function onGridClick(x,y) {
    const existing=occupancy().get(`${x},${y}`);
    if(existing&&!selectedCatalog){selectedModuleId=existing.id;renderAll();return;}
    if(!selectedCatalog){toast('Select a stored module from the bay first.');return;}
    const place=placementAt(selectedCatalog,x,y,buildRotation);
    if(!place.valid){toast('Connect rooms and keep exhaust and a weapon arc clear to space.');return;}
    const def=MODULES[selectedCatalog];if((save.inventory[selectedCatalog]||0)<1){toast('Buy this module from a trader first.');return;}
    const module={id:save.nextId++,type:selectedCatalog,x:place.x,y:place.y,rotation:buildRotation,weaponFacing:buildWeaponFacing,hp:def.hp,level:1};
    save.modules.push(module);save.inventory[selectedCatalog]--;selectedModuleId=module.id;selectedCatalog=null;
    persist();log(`${def.name} installed from the hold.`);toast(`${def.name} installed`);renderAll();
  }
  function rotateBuild(step){buildRotation=(buildRotation+step+4)%4;$('buildRotationLabel').textContent=`${buildRotation*90}°`;renderGrid();}
  function renderInspector(){
    const module=selectedModule();
    if(!module){$('moduleInspector').innerHTML='<div class="empty-inspector">Click a ship room to inspect its station, firing arc, upgrade, or repair it.</div>';return;}
    const def=MODULES[module.type],maximum=maxHp(module),ratio=module.hp/maximum,upgradeCost=25*module.level+(module.type==='core'?10:0),repairCost=Math.ceil((maximum-module.hp)/10)*3;
    const direction=['RIGHT','DOWN','LEFT','UP'][(module.rotation+(module.type==='weapon'&&module.weaponFacing===1?3:0))%4];
    const detail=def.range?`<div class="inspector-detail">FIRING ARC ${def.arc}° · RANGE ${weaponRange(module)} · ${direction}</div>`:def.thrust?`<div class="inspector-detail">THRUST → ${direction} · ${Math.round(def.thrust*(1+.2*(module.level-1)))} FORCE</div>`:def.station?'<div class="inspector-detail">WALKABLE FLOOR · 1 SYSTEM STATION</div>':'<div class="inspector-detail">OPEN WALKABLE FLOOR · NO STATION</div>';
    const rangeControl=def.range?`<label class="weapon-range" for="weaponRange">RANGE LIMIT <input id="weaponRange" type="number" min="30" max="${def.range}" step="1" value="${weaponRange(module)}" ${mode!=='hangar'?'disabled':''}><span>MAX ${def.range}</span></label>${module.type==='weapon'?`<button id="rotateWeapon" class="outline-button full-width" type="button" ${mode!=='hangar'?'disabled':''}>TURN MOUNT 90° ↻</button>`:''}`:'';
    $('moduleInspector').innerHTML=`<div class="inspector-head"><span class="inspector-swatch" style="--module-color:${def.color}"></span><strong>${def.name.toUpperCase()} · LV ${module.level}</strong></div><div class="inspector-sub"><span>${def.description}</span><span>${Math.ceil(module.hp)}/${maximum}</span></div>${detail}${rangeControl}<div class="meter ${ratio<.35?'low':''}"><span style="width:${Math.round(ratio*100)}%"></span></div><div class="inspector-actions"><button id="upgradeModule" type="button" ${module.level>=3||save.metal<upgradeCost||mode==='combat'?'disabled':''}>UPGRADE<br>◆ ${upgradeCost}</button><button id="repairModule" type="button" ${repairCost===0||save.metal<repairCost||mode==='combat'?'disabled':''}>REPAIR<br>◆ ${repairCost}</button></div>`;
    if(def.range)$('weaponRange').addEventListener('change',(event)=>{
      if(mode!=='hangar')return;
      const value=event.target.valueAsNumber;
      if(Number.isFinite(value))module.range=Math.round(clamp(value,30,def.range));
      persist();renderInspector();drawHangar();
    });
    if(module.type==='weapon')$('rotateWeapon').addEventListener('click',()=>{
      if(mode!=='hangar')return;
      const candidate={...module,weaponFacing:module.weaponFacing===1?0:1};
      if(!hasClearMount(candidate)||!weaponHasEscape(candidate,save.modules.flatMap(moduleCells))){toast('That mount direction needs open space outside the hull.');return;}
      module.weaponFacing=candidate.weaponFacing;persist();renderAll();
    });
    $('upgradeModule').addEventListener('click',()=>{if(module.level>=3||save.metal<upgradeCost||mode==='combat')return;save.metal-=upgradeCost;module.level++;module.hp+=25;persist();log(`${def.name} upgraded to level ${module.level}.`);toast(`${def.name} upgraded`);renderAll();});
    $('repairModule').addEventListener('click',()=>{if(repairCost===0||save.metal<repairCost||mode==='combat')return;save.metal-=repairCost;module.hp=maximum;persist();log(`${def.name} repaired.`);toast(`${def.name} repaired`);renderAll();});
  }
  function renderCrew(){
    $('crewList').innerHTML=CREW.map((template)=>{
      const person=save.crew.find((member)=>member.id===template.id),route=crewRoutes[person.id];
      const moving=route?.path?.length&&distance(person,route.path[0])>.08;
      return `<div class="crew-card"><div class="crew-top"><span class="crew-avatar" style="--crew-color:${template.color}">${template.initial}</span><strong>${template.name}</strong><small>${moving?'WALKING':'AT STATION'}</small></div><select data-crew="${person.id}" aria-label="${template.name} assignment">${Object.entries(TASKS).map(([value,label])=>`<option value="${value}" ${person.task===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
    }).join('');
    $('crewList').querySelectorAll('select').forEach((select)=>select.addEventListener('change',()=>{
      const person=save.crew.find((member)=>member.id===select.dataset.crew);person.task=select.value;delete crewRoutes[person.id];
      persist();log(`${CREW.find((member)=>member.id===person.id).name} assigned to ${TASKS[person.task].toLowerCase()}.`);renderCrew();
    }));
  }
  function renderHud(){
    $('sectorDisplay').textContent=String(save.sector).padStart(2,'0');$('metalDisplay').textContent=save.metal;$('hullDisplay').textContent=`${Math.round(hullRatio()*100)}%`;
    $('jumpButton').disabled=mode==='combat'||eventOpen;
    $('jumpButton').textContent=mode==='combat'?'IN COMBAT':mode==='map'?'RETURN TO SHIPYARD':'OPEN SECTOR MAP ↗';
    const cells=save.modules.reduce((sum,module)=>sum+moduleCells(module).length,0),weapons=activeModules('weapon','railgun').length;
    $('shipStats').innerHTML=`<div class="stat-card"><span>HULL INTEGRITY</span><strong class="${hullRatio()<.35?'bad':'good'}">${Math.round(hullRatio()*100)}%</strong></div><div class="stat-card"><span>MODULES</span><strong>${save.modules.length} <small style="font-size:9px;color:var(--muted)">/ ${cells} CELLS</small></strong></div><div class="stat-card"><span>WEAPONS</span><strong class="${weapons?'good':'bad'}">${weapons} ACTIVE</strong></div><div class="stat-card"><span>AMMUNITION</span><strong class="${mode==='combat'&&battle&&battle.ammo<=2?'warn':''}">${battle?Math.floor(battle.ammo)+' / '+battle.maxAmmo:'READY'}</strong></div>`;
    $('leftStatus').textContent=mode==='combat'?`ENGAGED // ${battle?.enemies.filter((enemy)=>enemy.hp>0).length||0} HOSTILES`:mode==='map'?`CHARTED // SECTOR ${String(save.sector).padStart(2,'0')}`:activeModules('engine').length?'DOCKED // SYSTEMS READY':'DOCKED // ENGINE OFFLINE';
    $('footerStatus').textContent=mode==='combat'?'THRUSTERS ACTIVE ONLY ON DEMAND':mode==='map'?'CHOOSE YOUR NEXT JUMP':'A LONG WAY FROM HOME';
    if(battle){
      const p=battle.player,heading=((Math.round(p.angle*180/Math.PI)%360)+360)%360;
      const firing=Object.values(p.thrusters).filter((throttle)=>throttle>.08).length;
      $('flightTelemetry').innerHTML=`HEADING ${heading}°<br>SPEED ${Math.round(Math.hypot(p.vx,p.vy))} · ${firing} THRUSTER${firing===1?'':'S'} FIRING`;
      $('enemyCountLabel').textContent=`${battle.enemies.filter((enemy)=>enemy.hp>0).length} HOSTILE${battle.enemies.filter((enemy)=>enemy.hp>0).length===1?'':'S'}`;
    }
  }
  function renderAll(){renderCatalog();renderGrid();renderInspector();renderCrew();renderHud();if(mode==='map')renderMap();}

  let arcCache=null;
  function drawWeaponArc(g,module,tile,color) {
    const key=JSON.stringify([module.type,module.x,module.y,module.rotation,module.weaponFacing,weaponRange(module),save.modules.map(({type,x,y,rotation})=>[type,x,y,rotation])]);
    if(arcCache?.key!==key){
      const cells=save.modules.flatMap(moduleCells),mount=weaponGeometry(module),limit=weaponRange(module)/COMBAT_TILE;
      const points=weaponAngles(module,cells,true).map((angle)=>{
        const radius=hullRay(mount,angle,cells,limit);
        return {x:mount.x+Math.cos(angle)*radius,y:mount.y+Math.sin(angle)*radius};
      });
      arcCache={key,mount,points};
    }
    const {mount,points}=arcCache;
    g.fillStyle=color;g.strokeStyle=color.replace(/,[^,]*\)$/ , ', .85)');g.lineWidth=1;
    g.beginPath();g.moveTo(mount.x*tile,mount.y*tile);
    for(const point of points)g.lineTo(point.x*tile,point.y*tile);
    g.closePath();g.fill();g.stroke();
  }
  function drawCrewSprite(g,person,size=TILE){
    const template=CREW.find((member)=>member.id===person.id),x=Math.round(person.x*size),y=Math.round(person.y*size);
    g.fillStyle='#091421';g.fillRect(x-5,y-7,10,13);
    g.fillStyle='#53677c';g.fillRect(x-4,y-6,8,4);
    g.fillStyle=template.color;g.fillRect(x-3,y-6,6,3);g.fillRect(x-4,y-2,8,6);
    g.fillStyle='#f2fbec';g.fillRect(x-2,y-5,4,1);
    g.fillStyle='#294358';g.fillRect(x-2,y,2,3);g.fillRect(x+1,y,2,3);
    g.fillStyle='#101b2b';g.fillRect(x-4,y+4,3,3);g.fillRect(x+1,y+4,3,3);
    g.fillStyle='#fff1c6';g.fillRect(x+4,y,1,2);
  }
  function drawStation(g,module,throttle=0){
    const def=MODULES[module.type],geom=rotatedGeometry(module.type,module.rotation),station=geom.station;
    if(station){
      const px=(module.x+station[0])*TILE,py=(module.y+station[1])*TILE;
      g.fillStyle='#091a27';g.fillRect(px+5,py+5,14,14);
      g.fillStyle='#51697b';g.fillRect(px+6,py+6,12,12);
      g.fillStyle='#142d3b';g.fillRect(px+7,py+7,10,10);
      g.fillStyle=def.color;g.fillRect(px+8,py+8,8,2);
      g.fillStyle='#9eb8c5';g.fillRect(px+7,py+17,2,2);g.fillRect(px+15,py+17,2,2);
      if(module.type==='core'){
        g.fillStyle='#7fe0e7';g.fillRect(px+8,py+8,8,5);
        g.fillStyle='#e8fff2';g.fillRect(px+9,py+9,3,1);g.fillRect(px+13,py+11,2,1);
        g.fillStyle='#ecb970';g.fillRect(px+8,py+15,2,1);g.fillRect(px+12,py+15,4,1);
        g.fillStyle='#4e7184';g.fillRect(px+3,py+9,2,6);g.fillRect(px+19,py+9,2,6);
      }
      if(module.type==='shield'){
        g.fillStyle='#8c6bc4';g.fillRect(px+8,py+7,8,10);
        g.fillStyle='#e9d6ff';g.fillRect(px+11,py+8,2,8);g.fillRect(px+8,py+11,8,2);
        g.fillStyle='#ab8ded';g.fillRect(px+3,py+10,2,4);g.fillRect(px+19,py+10,2,4);
      }
      if(module.type==='cargo'){
        g.fillStyle='#865e42';g.fillRect(px+7,py+7,10,10);
        g.fillStyle='#e9ca83';g.fillRect(px+8,py+8,8,2);g.fillRect(px+11,py+8,2,8);
        g.fillStyle='#543d35';g.fillRect(px+8,py+13,2,2);g.fillRect(px+14,py+13,2,2);
      }
      if(module.type==='engine'){
        g.fillStyle='#0d2731';g.fillRect(px+7,py+7,10,10);
        g.fillStyle='#71c9a6';g.fillRect(px+8,py+8,8,4);
        g.fillStyle='#e6fff0';g.fillRect(px+9,py+9,3,1);
        g.fillStyle='#345b65';g.fillRect(px+8,py+14,2,2);g.fillRect(px+12,py+14,4,2);
      }
      if(module.type==='weapon'||module.type==='railgun'){
        g.fillStyle='#15283a';g.fillRect(px+7,py+7,10,9);
        g.fillStyle=module.type==='railgun'?'#e99085':'#f1b66c';g.fillRect(px+8,py+8,8,4);
        g.fillStyle='#fff0c7';g.fillRect(px+9,py+9,3,1);
        g.fillStyle='#6b8390';g.fillRect(px+8,py+14,2,2);g.fillRect(px+13,py+14,3,2);
      }
    }
  }
  function drawHullShell(g,occupied){
    for(const key of occupied.keys()){
      const [x,y]=key.split(',').map(Number),px=x*TILE,py=y*TILE;
      for(const [dx,dy,side] of [[-1,0,'left'],[1,0,'right'],[0,-1,'top'],[0,1,'bottom']]){
        if(occupied.has(`${x+dx},${y+dy}`))continue;
        g.fillStyle='#122637';
        if(side==='left'||side==='right'){
          const sx=side==='left'?px-8:px+24;g.fillRect(sx,py,8,24);
          g.fillStyle='#536f80';g.fillRect(sx+(side==='left'?2:0),py+2,6,20);
          g.fillStyle='#8ca8b0';g.fillRect(sx+(side==='left'?6:0),py+4,2,16);
          g.fillStyle='#d3d9cf';g.fillRect(sx+3,py+5,2,2);g.fillRect(sx+3,py+17,2,2);
          g.fillStyle='#304b5d';g.fillRect(sx+1,py+11,6,2);
        }else{
          const sy=side==='top'?py-8:py+24;g.fillRect(px,sy,24,8);
          g.fillStyle='#536f80';g.fillRect(px+2,sy+(side==='top'?2:0),20,6);
          g.fillStyle='#8ca8b0';g.fillRect(px+4,sy+(side==='top'?6:0),16,2);
          g.fillStyle='#d3d9cf';g.fillRect(px+5,sy+3,2,2);g.fillRect(px+17,sy+3,2,2);
          g.fillStyle='#304b5d';g.fillRect(px+11,sy+1,2,6);
        }
      }
    }
  }
  function drawExteriorHardware(g,module,throttle=0){
    if(module.type==='engine'){
      const station=rotatedGeometry('engine',module.rotation).station;
      const cx=(module.x+station[0]+.5)*TILE,cy=(module.y+station[1]+.5)*TILE;
      g.save();g.translate(cx,cy);g.rotate(module.rotation*Math.PI/2);
      g.fillStyle='#162735';g.fillRect(-23,-13,12,26);
      g.fillStyle='#7897a2';g.fillRect(-21,-12,8,24);
      g.fillStyle='#c7d8d5';g.fillRect(-20,-10,2,20);
      for(const offset of [-7,7]){
        g.fillStyle='#243847';g.fillRect(-28,offset-5,12,10);
        g.fillStyle='#a7c4c9';g.fillRect(-27,offset-4,4,8);
        g.fillStyle='#44b9ce';g.fillRect(-31,offset-4,5,8);
        g.fillStyle='#b6f5ee';g.fillRect(-31,offset-2,2,4);
        if(throttle>.08){const length=5+Math.round(throttle*13);g.fillStyle='#3ad8ed';g.fillRect(-29-length,offset-3,length,6);g.fillStyle='#fff0ae';g.fillRect(-29-length,offset-1,Math.max(3,length-3),2);}
      }
      g.restore();
    }
    if(MODULES[module.type].muzzle){
      const mount=weaponGeometry(module),cx=mount.x*TILE,cy=mount.y*TILE;
      g.save();g.translate(cx,cy);g.rotate(mount.direction);
      g.fillStyle='#142636';g.fillRect(-7,-11,21,22);
      g.fillStyle='#758b99';g.fillRect(-5,-9,17,18);
      g.fillStyle=MODULES[module.type].color;g.fillRect(-3,-7,15,14);
      g.fillStyle='#263d50';g.fillRect(1,-5,11,10);
      if(module.type==='railgun'){
        g.fillStyle='#9d4d58';g.fillRect(8,-9,16,4);g.fillRect(8,5,16,4);
        g.fillStyle='#d5bbc0';g.fillRect(11,-4,12,8);g.fillStyle='#172331';g.fillRect(12,-2,12,4);
      }else{
        g.fillStyle='#e4b379';g.fillRect(9,-5,11,10);g.fillStyle='#182b38';g.fillRect(12,-3,9,6);
        g.fillStyle='#fbe5b7';g.fillRect(19,-1,3,2);
      }
      g.restore();
    }
  }
  function drawInterior(g,showSelection=false,thrusters={}){
    g.clearRect(0,0,GRID_W*TILE,GRID_H*TILE);
    const occupied=occupancy();
    drawHullShell(g,occupied);
    if(showSelection){
      const selected=selectedModule();
      if(selected&&MODULES[selected.type].muzzle){
        drawWeaponArc(g,selected,TILE,'rgba(248,183,103,.23)');
      }
    }
    for(const module of save.modules){
      const def=MODULES[module.type];
      for(const [x,y] of moduleCells(module)){
        const px=x*TILE,py=y*TILE;
        g.fillStyle='#0a1723';g.fillRect(px,py,TILE,TILE);
        g.fillStyle=module.hp>0?'#203b4b':'#343b43';g.fillRect(px+2,py+2,20,20);
        g.fillStyle=module.hp>0?'#315366':'#4a4c50';g.fillRect(px+3,py+3,18,18);
        g.fillStyle='#29485a';g.fillRect(px+5,py+5,14,14);
        g.fillStyle='#395d6d';g.fillRect(px+6,py+6,12,1);g.fillRect(px+6,py+17,12,1);
        g.fillStyle='#172f40';g.fillRect(px+9,py+8,6,8);
        g.fillStyle='#486b7b';g.fillRect(px+10,py+8,1,8);g.fillRect(px+13,py+8,1,8);
        g.fillStyle=def.color;g.fillRect(px+3,py+3,4,1);g.fillRect(px+17,py+20,4,1);
        g.fillStyle='#a6bfcb';g.fillRect(px+3,py+3,1,1);g.fillRect(px+20,py+20,1,1);
        if(module.type==='armor'){
          g.fillStyle='#718898';g.fillRect(px+6,py+6,12,11);g.fillStyle='#a8bcc8';g.fillRect(px+7,py+6,10,2);
          g.fillStyle='#465f70';g.fillRect(px+8,py+10,8,5);g.fillStyle='#d7e5e5';g.fillRect(px+8,py+9,2,1);g.fillRect(px+15,py+14,2,1);
        }
        const edges=[[-1,0,'left'],[1,0,'right'],[0,-1,'top'],[0,1,'bottom']];
        for(const [dx,dy,side] of edges){
          const neighbor=occupied.get(`${x+dx},${y+dy}`);
          if(neighbor?.id===module.id)continue;
          const outer=!neighbor,metal=outer?'#9db7c2':'#7894a0';
          g.fillStyle='#111f2d';
          if(side==='left'||side==='right'){
            const sx=side==='left'?px:px+21;g.fillRect(sx,py,3,24);
            g.fillStyle=metal;g.fillRect(sx,py+2,1,outer?20:7);if(!outer)g.fillRect(sx,py+15,1,7);
            g.fillStyle='#d2e0df';g.fillRect(sx+1,py+3,1,2);g.fillRect(sx+1,py+19,1,2);
          }else{
            const sy=side==='top'?py:py+21;g.fillRect(px,sy,24,3);
            g.fillStyle=metal;g.fillRect(px+2,sy,outer?20:7,1);if(!outer)g.fillRect(px+15,sy,7,1);
            g.fillStyle='#d2e0df';g.fillRect(px+3,sy+1,2,1);g.fillRect(px+19,sy+1,2,1);
          }
        }
      }
      drawStation(g,module,thrusters[module.id]||0);
    }
    for(const module of save.modules)drawExteriorHardware(g,module,thrusters[module.id]||0);
    for(const person of save.crew)drawCrewSprite(g,person);
    if(showSelection){
      const selected=selectedModule();
      if(selected){
        g.fillStyle='#fff1b7';
        for(const [x,y] of moduleCells(selected)){const px=x*TILE,py=y*TILE;g.fillRect(px,py,4,1);g.fillRect(px,py,1,4);g.fillRect(px+20,py,4,1);g.fillRect(px+23,py,1,4);g.fillRect(px,py+23,4,1);g.fillRect(px,py+20,1,4);g.fillRect(px+20,py+23,4,1);g.fillRect(px+23,py+20,1,4);}
      }
    }
  }
  function drawHangar(){drawInterior(hangarCtx,true);}

  function walkPath(start,end){
    const occupied=occupancy(),from=`${Math.floor(start.x)},${Math.floor(start.y)}`,to=`${Math.floor(end.x)},${Math.floor(end.y)}`;
    if(from===to)return[];
    const queue=[from],seen=new Set([from]),previous=new Map();
    while(queue.length){
      const key=queue.shift();if(key===to)break;const [x,y]=key.split(',').map(Number);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const next=`${x+dx},${y+dy}`;if(occupied.has(next)&&!seen.has(next)){seen.add(next);previous.set(next,key);queue.push(next);}
      }
    }
    if(!seen.has(to))return[];
    const path=[];let key=to;while(key!==from){const [x,y]=key.split(',').map(Number);path.unshift({x:x+.5,y:y+.5});key=previous.get(key);}
    return path;
  }
  function crewGoal(person,route){
    const core=save.modules.find((module)=>module.type==='core');
    if(person.task==='gun'){
      const weapons=activeModules('weapon','railgun');
      if(!weapons.length)return {module:core,point:moduleStation(core)};
      const module=weapons.reduce((best,candidate)=>distance(person,moduleStation(candidate))<distance(person,moduleStation(best))?candidate:best,weapons[0]);
      return {module,point:moduleStation(module)};
    }
    if(person.task==='repair'){
      const damaged=save.modules.filter((module)=>module.hp>0&&module.hp<maxHp(module)).sort((a,b)=>a.hp/maxHp(a)-b.hp/maxHp(b));
      const module=damaged[0]||core;return {module,point:moduleStation(module)};
    }
    if(person.task==='load'&&battle){
      const pickup=activeModules('cargo')[0]||core,weapon=activeModules('weapon','railgun')[0];
      const module=route.phase==='drop'&&weapon?weapon:pickup;
      return {module,point:moduleStation(module)};
    }
    const module=person.task==='load'?(activeModules('cargo')[0]||core):core;
    return {module,point:moduleStation(module)};
  }
  function updateCrew(dt){
    for(const person of save.crew){
      let route=crewRoutes[person.id];
      if(!route){route={path:[],target:'',phase:'pickup'};crewRoutes[person.id]=route;}
      const goal=crewGoal(person,route),target=`${person.task}:${goal.module.id}:${route.phase}`;
      if(route.target!==target){route.path=walkPath(person,goal.point);route.target=target;}
      let travel=dt*2.4;
      while(route.path.length&&travel>0){
        const next=route.path[0],d=distance(person,next);
        if(d<=travel){person.x=next.x;person.y=next.y;travel-=d;route.path.shift();}
        else {person.x+=(next.x-person.x)/d*travel;person.y+=(next.y-person.y)/d*travel;travel=0;}
      }
      if(person.task==='load'&&battle&&!route.path.length&&distance(person,goal.point)<.12){
        if(route.phase==='drop'){battle.ammo=Math.min(battle.maxAmmo,battle.ammo+2);route.phase='pickup';}
        else route.phase='drop';
        route.target='';
      }
    }
  }
  function crewAtStation(task,module){
    const point=moduleStation(module);
    return save.crew.filter((person)=>person.task===task&&distance(person,point)<.16).length;
  }

  function setMode(next){
    mode=next;
    $('hangarScreen').hidden=next!=='hangar';$('combatScreen').hidden=next!=='combat';$('mapScreen').hidden=next!=='map';
    $('hangarTools').hidden=next!=='hangar';$('combatTools').hidden=next!=='combat';$('mapTools').hidden=next!=='map';
    $('leftTitle').textContent=next==='hangar'?'MODULE BAY':next==='combat'?'TACTICAL CONTROL':'NAVIGATION';
    $('stageEyebrow').textContent=next==='hangar'?'HANGAR // SHIPYARD':next==='combat'?'LIVE ENCOUNTER // COMBAT':'NAVIGATION // ROUTE CHART';
    $('stageTitle').textContent=next==='hangar'?'BUILD YOUR SHIP':next==='combat'?(battle?.kind==='rescue'?'FREIGHTER DEFENSE':'PIRATE INTERCEPT'):'CHOOSE YOUR COURSE';
    $('stageTag').textContent=next==='hangar'?'GRID 12 × 10':next==='combat'?`${battle?.enemies.length||0} HOSTILES`:`SECTOR ${String(save.sector).padStart(2,'0')}`;
    renderHud();if(next==='map')renderMap();if(next==='hangar')drawHangar();if(next==='combat')fitArenaCanvas();
  }
  function renderMap(){
    const map=save.map,current=currentMapNode(),available=new Set(availableNodes());
    const svg=$('mapLinks'),container=$('sectorMap');
    svg.innerHTML=map.nodes.flatMap((node)=>node.links.map((id)=>{
      const target=map.nodes.find((item)=>item.id===id);if(!target||node.id>id)return'';
      const cls=(node.id===current.id||id===current.id)?'active':map.visited.includes(node.id)&&map.visited.includes(id)?'visited':'';
      return `<line class="${cls}" x1="${node.mapX??80+node.col*168}" y1="${node.mapY??110+node.row*190}" x2="${target.mapX??80+target.col*168}" y2="${target.mapY??110+target.row*190}" />`;
    })).join('');
    container.innerHTML=map.nodes.map((node)=>{
      const isCurrent=node.id===current.id,isAvailable=available.has(node.id),visited=map.visited.includes(node.id);
      const info=EVENT_TYPES[node.type]||{name:'CURRENT',icon:'✦'};
      const cls=isCurrent?'current':isAvailable?`available${visited?' revisited':''}`:visited?'visited':'future';
      return `<button type="button" class="map-node ${cls} type-${node.type}" data-node="${node.id}" style="left:${(node.mapX??80+node.col*168)/10}%;top:${(node.mapY??110+node.row*190)/6}%" ${!isAvailable||!activeModules('engine').length?'disabled':''} aria-label="Sector ${String(save.sector).padStart(2,'0')} ${info.name}${visited?', visited':''}${isAvailable?', available next':''}"><span>${info.icon}</span><strong>${info.name}</strong><small>${isCurrent?'YOU ARE HERE':visited?'VISITED':`BEACON ${node.col}${node.row+1}`}</small></button>`;
    }).join('');
    container.querySelectorAll('.map-node.available').forEach((button)=>button.addEventListener('click',()=>openMapEvent(button.dataset.node)));
    $('nextSectorButton').hidden=current.type!=='exit';
    $('mapHint').textContent=activeModules('engine').length?(innerWidth<=720?'TAP CONNECTED BEACONS · SWIPE TO PAN':'EXPLORE AND REVISIT CONNECTED BEACONS'):'ENGINE OFFLINE · REPAIR IN SHIPYARD';
  }
  function openMap(){setMode('map');}
  function openHangar(){setMode('hangar');renderAll();}
  function toggleMap(){if(mode==='combat'||eventOpen)return;if(mode==='map')openHangar();else openMap();}
  function advanceRoute(){
    if(!pendingNodeId)return;
    const node=save.map.nodes.find((item)=>item.id===pendingNodeId);save.map.current=node.id;
    if(!save.map.visited.includes(node.id))save.map.visited.push(node.id);
    if(!save.map.resolved.includes(node.id))save.map.resolved.push(node.id);
    pendingNodeId=null;persist();
  }
  function goNextSector(){
    if(currentMapNode()?.type!=='exit'||!activeModules('engine').length)return;
    save.sector++;save.map=makeMap(save.sector);pendingNodeId=null;persist();
    log(`Entered sector ${String(save.sector).padStart(2,'0')}.`);toast(`Sector ${String(save.sector).padStart(2,'0')} charted`);openMap();renderAll();
  }
  function showEvent({type,icon,title,body,choices}){
    eventOpen=true;$('eventType').textContent=type;$('eventVisual').innerHTML=`<span>${icon}</span>`;
    $('eventTitle').textContent=title;$('eventBody').textContent=body;$('eventChoices').replaceChildren();
    for(const choice of choices){const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.disabled=!!choice.disabled;button.addEventListener('click',choice.action);$('eventChoices').append(button);}
    $('eventOverlay').hidden=false;renderHud();
  }
  function hideEvent(){eventOpen=false;$('eventOverlay').hidden=true;renderHud();}
  function concludeEvent(title,body,icon='✦'){
    advanceRoute();persist();renderAll();
    showEvent({type:'TRANSMISSION COMPLETE',icon,title,body,choices:[
      {label:'VIEW SECTOR MAP →',action:()=>{hideEvent();openMap();}},
      {label:'RETURN TO SHIPYARD',action:()=>{hideEvent();openHangar();}}
    ]});
  }
  function damageRandomModule(amount){
    const live=save.modules.filter((module)=>module.hp>0),target=live[Math.floor(Math.random()*live.length)];
    target.hp=Math.max(1,target.hp-amount);return target;
  }
  function openTrader(node){
    const stock=node.stock||[],available=stock.filter((item)=>item.qty>0);
    const choices=available.map((item)=>({
      label:`BUY ${MODULES[item.type].name.toUpperCase()} · ◆ ${item.price} · ${item.qty} LEFT`,disabled:save.metal<item.price,
      action:()=>{save.metal-=item.price;item.qty--;save.inventory[item.type]=(save.inventory[item.type]||0)+1;persist();
        log(`${MODULES[item.type].name} purchased at a trader.`);renderAll();openTrader(node);toast(`${MODULES[item.type].name} added to your hold`);}
    }));
    choices.push({label:'FIELD REPAIRS · ◆ 15',disabled:save.metal<15||hullRatio()>=.999,action:()=>{
      save.metal-=15;repairAll(55);log('Field repairs purchased.');openTrader(node);
    }});
    if(!node.surveySold)choices.push({label:'SELL SURVEY DATA · +12 METAL',action:()=>{
      node.surveySold=true;save.metal+=12;persist();log('Survey data sold to a trader.');renderAll();openTrader(node);
    }});
    choices.push({label:'LEAVE TRADER →',action:()=>{hideEvent();openMap();}});
    showEvent({type:'NEUTRAL SIGNAL // TRADER',icon:'◆',title:'WAYFARER TRADER',
      body:`Buy a complete module for your hold, then install it in the shipyard. ${available.length?`${available.length} types in stock.`:'This trader is sold out.'} Metal also pays for repairs and system upgrades.`,choices});
  }
  function openOutpost(node,firstVisit){
    const choices=[{label:'DOCK FOR REPAIRS · ◆ 12',disabled:save.metal<12||hullRatio()>=.999,action:()=>{
      save.metal-=12;repairAll(40);log('Outpost crew patched the hull.');
      if(firstVisit)concludeEvent('HULL PATCHED','The outpost technicians repair the worst damage.','⌂');else{persist();openOutpost(node,false);}
    }}];
    if(firstVisit)choices.push({label:'TRADE CHART DATA · +15 METAL',action:()=>{
      save.metal+=15;log('Outpost bought your navigation data.');concludeEvent('CHARTS EXCHANGED','Your maps help the outpost chart safer routes.','⌂');
    }});
    choices.push({label:'LEAVE OUTPOST',action:()=>{if(firstVisit){log('Outpost charted.');concludeEvent('OUTPOST CHARTED','The station remains on your map for future repairs.','⌂');}else{hideEvent();openMap();}}});
    showEvent({type:'CIVILIAN SIGNAL // OUTPOST',icon:'⌂',title:'FRINGE OUTPOST',
      body:firstVisit?'A small station offers hull work and asks for recent navigation charts.':'The station is still open for repairs.',choices});
  }
  function openMapEvent(id){
    if(!availableNodes().includes(id)||!activeModules('engine').length)return;
    pendingNodeId=id;const node=save.map.nodes.find((item)=>item.id===id);
    const firstVisit=!save.map.resolved.includes(id);
    if(!firstVisit||node.type==='trader'||node.type==='exit'){
      advanceRoute();renderAll();
      if(node.type==='trader'){openTrader(node);return;}
      if(node.type==='outpost'){openOutpost(node,false);return;}
      if(node.type==='exit'){toast('Exit reached · choose NEXT SECTOR or keep exploring');return;}
      toast(`${EVENT_TYPES[node.type]?.name||'BEACON'} revisited`);return;
    }
    const variant=node.variant||0;
    if(node.type==='pirate')showEvent({type:'HOSTILE SIGNAL // PIRATES',icon:'⚔',title:['PIRATE INTERCEPT','SMUGGLER AMBUSH','RAIDER TOLL'][variant],body:[
      'A raider cuts across your route and demands cargo. Their weapons are already charging.',
      'A smuggler ship emerges from behind debris and locks weapons on your hull.',
      'A pirate captain blocks the lane and demands metal for passage.'
    ][variant],choices:[
      {label:'ENGAGE THE PIRATES →',action:()=>startBattle('pirate')},
      {label:'PAY 18 METAL TO PASS',disabled:save.metal<18,action:()=>{save.metal-=18;log('Pirates paid off.');concludeEvent('SAFE PASSAGE','The raider takes your metal and clears the lane.','◆');}}
    ]});
    if(node.type==='rescue')showEvent({type:'DISTRESS SIGNAL // FREIGHTER',icon:'◇',title:['FREIGHTER IN PERIL','BROKEN CONVOY','SOS IN THE DUST'][variant],body:[
      'A damaged freighter is pinned down by two pirate skiffs. Its captain asks for help.',
      'An ore convoy has lost its escort. Two skiffs close on the last transport.',
      'A freighter transmits a faint distress call from an asteroid field.'
    ][variant],choices:[
      {label:'DEFEND THE FREIGHTER →',action:()=>startBattle('rescue')},
      {label:'SEND REPAIR SUPPLIES · −12 METAL',disabled:save.metal<12,action:()=>{save.metal-=12;log('Freighter assisted with supplies.');concludeEvent('AID DELIVERED','The freighter escapes while your crew transfers spare material.','◇');}},
      {label:'CONTINUE ON YOUR ROUTE',action:()=>{log('Freighter signal left behind.');concludeEvent('SIGNAL FADES','The freighter vanishes from the scope as you leave the sector.','·');}}
    ]});
    if(node.type==='salvage')showEvent({type:'ANOMALY // SALVAGE',icon:'✧',title:['DRIFTING WRECKAGE','LOST CARGO PODS','QUIET DEBRIS FIELD'][variant],body:[
      'A quiet debris field contains useful metal. A sealed hold deeper inside might contain even more.',
      'Cargo pods drift between shattered hull plates. One pod still has power.',
      'Your scanners find alloy in an old battle site and a sealed compartment deeper in.'
    ][variant],choices:[
      {label:'COLLECT SAFE SALVAGE · +18 METAL',action:()=>{save.metal+=18;log('18 metal recovered from wreckage.');concludeEvent('SALVAGE SECURED','The crew stows the metal and marks the field on the chart.','◆');}},
      {label:'OPEN THE SEALED HOLD',action:()=>{if(Math.random()<.6){save.metal+=38;log('38 metal found in a sealed hold.');concludeEvent('HIDDEN CACHE','The hold is packed with alloy plates.','◆');}else{const target=damageRandomModule(25);log(`${MODULES[target.type].name} damaged by salvage trap.`);concludeEvent('TRAP SPRUNG',`A defense charge detonates. Your ${MODULES[target.type].name.toLowerCase()} takes 25 damage.`,'⚠');}}}
    ]});
    if(node.type==='anomaly')showEvent({type:'UNUSUAL SIGNAL // ANOMALY',icon:'◈',title:['PULSING NEBULA','SILENT RELAY','BLUE GRAVITY WELL'][variant],body:[
      'A blue cloud pulses with weak energy signatures. The crew can scan it at close range.',
      'An abandoned relay still broadcasts encrypted star charts.',
      'A small gravity well has trapped valuable metallic fragments.'
    ][variant],choices:[
      {label:'INVESTIGATE THE SIGNAL',action:()=>{if(Math.random()<.6){save.metal+=24;log('Anomaly yielded 24 metal.');concludeEvent('ANOMALY MAPPED','The crew recovers rare alloy from the strange signal.','◈');}else{const target=damageRandomModule(18);log(`${MODULES[target.type].name} strained by anomaly.`);concludeEvent('FIELD SURGE',`A sudden pulse damages your ${MODULES[target.type].name.toLowerCase()}.`,'⚠');}}},
      {label:'CHART A SAFE COURSE',action:()=>{log('Anomaly safely charted.');concludeEvent('SAFE PASSAGE','The crew records the signal and keeps a safe distance.','◈');}}
    ]});
    if(node.type==='derelict')showEvent({type:'UNKNOWN CONTACT // DERELICT',icon:'▣',title:['DARK SCIENCE SHIP','ABANDONED MINER','GHOST TRANSPORT'][variant],body:[
      'A research vessel drifts without power. Its cargo bay might still contain parts.',
      'An empty mining ship sits among slowly spinning ore containers.',
      'A silent transport holds a sealed store of valuable metal.'
    ][variant],choices:[
      {label:'RECOVER EXPOSED METAL · +22',action:()=>{save.metal+=22;log('22 metal recovered from derelict.');concludeEvent('CARGO RECOVERED','The crew brings the accessible alloy aboard.','▣');}},
      {label:'BOARD THE DARK HULL',action:()=>{if(Math.random()<.55){save.metal+=42;log('42 metal recovered from sealed hold.');concludeEvent('HOLD OPENED','A long sealed hold contains reusable machinery.','▣');}else{const target=damageRandomModule(28);log(`${MODULES[target.type].name} damaged near derelict.`);concludeEvent('HIDDEN CHARGE',`An old defense charge hits your ${MODULES[target.type].name.toLowerCase()}.`,'⚠');}}},
      {label:'LEAVE IT DRIFTING',action:()=>concludeEvent('DERELICT MARKED','Its coordinates remain on your map.','▣')}
    ]});
    if(node.type==='outpost')openOutpost(node,true);
  }
  function canContinue(){return hasSave&&save.modules.some((module)=>module.type==='core'&&module.hp>0);}
  function renderMainMenu(){
    const available=canContinue();
    $('menuContinue').disabled=!available;
    $('menuSaveStatus').textContent=available?`SAVED GAME // SECTOR ${String(save.sector).padStart(2,'0')} · ${save.metal} METAL`:hasSave?'LAST SHIP LOST // START A NEW GAME':'NO SAVED GAME // BEGIN A NEW JOURNEY';
    const g=$('menuShip').getContext('2d');g.imageSmoothingEnabled=false;drawInterior(g);
  }
  function showMainMenu(){
    screen='menu';$('appShell').hidden=true;$('quitScreen').hidden=true;$('mainMenu').hidden=false;
    $('menuConfirm').hidden=true;renderMainMenu();
  }
  function showGame(){
    screen='playing';$('mainMenu').hidden=true;$('quitScreen').hidden=true;$('appShell').hidden=false;
    setMode('hangar');renderAll();
  }
  function startNewGame(){
    save=newSave();battle=null;pendingNodeId=null;eventOpen=false;$('eventOverlay').hidden=true;
    selectedModuleId=1;selectedCatalog=null;buildRotation=0;buildWeaponFacing=0;hoverCell=null;
    for(const id of Object.keys(crewRoutes))delete crewRoutes[id];
    logEntries.length=0;persist();log('New journey initiated.');showGame();
  }
  function returnToMainMenu(){
    if(screen!=='playing')return;
    if(battle){battle=null;for(const module of save.modules)delete module.cooldown;}
    pendingNodeId=null;eventOpen=false;$('eventOverlay').hidden=true;
    persist();showMainMenu();
  }
  function quitGame(){
    screen='quit';$('mainMenu').hidden=true;$('appShell').hidden=true;$('quitScreen').hidden=false;
    $('quitMessage').textContent=hasSave?'Your progress is saved in this browser. You can close this tab now.':'You can close this tab now.';
  }

  function shipRadius(){const b=shipBounds();return Math.max(38,Math.hypot(b.maxX-b.minX+1,b.maxY-b.minY+1)*COMBAT_TILE*.54);}
  function asteroidSprite(rock){
    const sprite=document.createElement('canvas'),size=Math.ceil((rock.r+10)*2/4)*4;
    sprite.width=size;sprite.height=size;
    const g=sprite.getContext('2d'),half=size/2,seed=Math.floor(rock.spin*100);
    for(let py=0;py<size;py+=4)for(let px=0;px<size;px+=4){
      const x=px+2-half,y=py+2-half,angle=(Math.atan2(y,x)+TAU)%TAU;
      const sector=Math.floor(angle/TAU*rock.points.length)%rock.points.length;
      const edge=rock.r*rock.points[sector],d=Math.hypot(x,y);
      if(d>edge)continue;
      const noise=Math.abs((px*13+py*29+seed*7)%17);
      g.fillStyle=d>edge-5?'#34475a':x+y<-rock.r*.35?'#9aaab0':x-y>rock.r*.45?'#4e6577':'#708695';
      g.fillRect(px,py,4,4);
      if(noise===3&&d<edge-8){g.fillStyle='#c5c9bd';g.fillRect(px,py,2,1);}
    }
    g.fillStyle='#35495b';g.fillRect(Math.round(half-rock.r*.35),Math.round(half-rock.r*.13),8,5);g.fillRect(Math.round(half+rock.r*.16),Math.round(half+rock.r*.2),6,4);
    g.fillStyle='#b0bcc0';g.fillRect(Math.round(half-rock.r*.37),Math.round(half-rock.r*.15),5,1);
    return sprite;
  }
  const ENEMY_TETROMINOES = {
    core: [[-1,-1],[0,-1],[-1,0],[0,0]],
    weapon: [[1,-1],[2,-1],[3,-1],[2,0]],
    engine: [[-2,-1],[-2,0],[-2,1],[-2,2]],
    armor: [[-1,1],[0,1],[-1,2],[0,2]]
  };
  function enemyLayout(heavy){
    const types=heavy?['core','weapon','engine','armor']:['core','weapon','engine'];
    const modules=types.map((type)=>({type,cells:ENEMY_TETROMINOES[type]}));
    const cells=modules.flatMap((module)=>module.cells);
    const r=Math.ceil(Math.max(...cells.map(([x,y])=>Math.hypot((x+.5)*ENEMY_TILE,(y+.5)*ENEMY_TILE)))+9);
    return {modules,r,cells:cells.length};
  }
  function makeAsteroids(world,count,spawn,enemies){
    const rocks=[];
    for(let i=0;i<count*15&&rocks.length<count;i++){
      const rock={x:rand(85,world.w-85),y:rand(75,world.h-75),r:rand(18,38),spin:rand(0,TAU),points:Array.from({length:9},()=>rand(.72,1.17))};
      if(distance(rock,spawn)<rock.r+spawn.r+35||enemies.some((enemy)=>distance(rock,enemy)<rock.r+enemy.r+30))continue;
      if(rocks.some((other)=>distance(rock,other)<rock.r+other.r+25))continue;
      rock.sprite=asteroidSprite(rock);rocks.push(rock);
    }
    return rocks;
  }
  function startBattle(kind){
    hideEvent();
    const count=kind==='rescue'?2:save.sector>3&&Math.random()<.35?2:1;
    const cellCount=save.modules.reduce((sum,module)=>sum+moduleCells(module).length,0),layout=enemyLayout(kind!=='rescue'),enemyCells=count*layout.cells;
    const width=960+Math.min(420,cellCount*12+enemyCells*6),world={w:width,h:width*5/6};
    const enemies=[];
    for(let i=0;i<count;i++)enemies.push({x:world.w*.77+i*40,y:world.h*(count===1?.5:i===0?.31:.69),angle:Math.PI,hp:kind==='rescue'?70:94+save.sector*7,maxHp:kind==='rescue'?70:94+save.sector*7,r:layout.r,modules:layout.modules,path:[],pathTimer:0,cooldown:rand(.7,1.5),speed:kind==='rescue'?48:40,phase:rand(0,TAU),name:kind==='rescue'?'PIRATE SKIFF':'RAIDER'});
    const player={x:world.w*.22,y:world.h*.5,vx:0,vy:0,angle:0,omega:0,targetAngle:0,dest:null,path:[],selected:false,r:shipRadius(),thrusters:{}};
    battle={kind,world,player,enemies,asteroids:makeAsteroids(world,3+Math.ceil(cellCount/7)+count,player,enemies),projectiles:[],stars:Array.from({length:125},()=>({x:rand(0,world.w),y:rand(0,world.h),s:Math.random()<.17?2:1})),ammo:12+activeModules('cargo').length*6,maxAmmo:12+activeModules('cargo').length*6,shake:0};
    for(const module of save.modules)module.cooldown=rand(.25,.8);
    setMode('combat');$('combatWaveLabel').textContent=kind==='rescue'?'DEFEND THE FREIGHTER':'HOSTILE CONTACT';
    $('arenaSizeLabel').textContent=`ARENA ${Math.round(world.w)} × ${Math.round(world.h)}`;
    $('combatHint').textContent='SELECT YOUR SHIP TO GIVE A MOVE ORDER';$('combatRotationLabel').textContent='0°';
    log(`${count} hostile ${count===1?'ship':'ships'} engaged.`);renderAll();
  }
  function finishBattle(victory){
    if(!battle)return;const kind=battle.kind;battle=null;setMode('hangar');
    for(const module of save.modules)delete module.cooldown;
    if(victory){
      const reward=(kind==='rescue'?48:30)+save.sector*4;save.metal+=reward;save.wins++;
      log(`${kind==='rescue'?'Freighter rescued':'Pirates defeated'}; ${reward} metal earned.`);
      concludeEvent(kind==='rescue'?'FREIGHTER SAVED':'PIRATES DEFEATED',kind==='rescue'?`The freighter escapes and transfers ${reward} metal in thanks. Repair your ship before the next jump.`:`The raider breaks apart. Your crew recovers ${reward} metal from the wreck. Repair your ship before the next jump.`,kind==='rescue'?'◇':'✦');
    }else{
      pendingNodeId=null;log('Command core destroyed.');
      showEvent({type:'MISSION LOST // CORE FAILURE',icon:'✕',title:'SHIP LOST',body:'Your command core was destroyed. Start a new run to build another ship and try again.',choices:[{label:'START A NEW RUN →',action:()=>{save=newSave();selectedModuleId=1;selectedCatalog=null;for(const id of Object.keys(crewRoutes))delete crewRoutes[id];persist();hideEvent();logEntries.length=0;log('New journey initiated.');openHangar();}}]});
    }
    persist();renderAll();
  }
  function angleDifference(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
  function clearSegment(a,b,radius,rocks){
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    return rocks.every((rock)=>{
      const t=clamp(((rock.x-a.x)*dx+(rock.y-a.y)*dy)/(length||1),0,1);
      return Math.hypot(a.x+dx*t-rock.x,a.y+dy*t-rock.y)>=rock.r+radius+5;
    });
  }
  function safePoint(point,radius,rocks,world){
    const result={x:clamp(point.x,radius+8,world.w-radius-8),y:clamp(point.y,radius+8,world.h-radius-8)};
    for(let pass=0;pass<3;pass++)for(const rock of rocks){
      const dx=result.x-rock.x,dy=result.y-rock.y,d=Math.hypot(dx,dy)||1,min=rock.r+radius+18;
      if(d<min){result.x=clamp(rock.x+dx/d*min,radius+8,world.w-radius-8);result.y=clamp(rock.y+dy/d*min,radius+8,world.h-radius-8);}
    }
    return result;
  }
  function routeAroundRocks(start,goal,radius,rocks,world){
    if(clearSegment(start,goal,radius,rocks))return [goal];
    const nodes=[start,goal];
    for(const rock of rocks)for(let i=0;i<16;i++){
      const angle=i*TAU/16,clearance=rock.r+radius+22;
      const point={x:rock.x+Math.cos(angle)*clearance,y:rock.y+Math.sin(angle)*clearance};
      if(point.x<radius+8||point.x>world.w-radius-8||point.y<radius+8||point.y>world.h-radius-8)continue;
      if(rocks.some((other)=>other!==rock&&distance(point,other)<other.r+radius+7))continue;
      nodes.push(point);
    }
    const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();costs[0]=0;
    while(visited.size<nodes.length){
      let current=-1;
      for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||costs[i]<costs[current]))current=i;
      if(current<0||!Number.isFinite(costs[current])||current===1)break;
      visited.add(current);
      for(let i=0;i<nodes.length;i++){
        if(i===current||visited.has(i)||!clearSegment(nodes[current],nodes[i],radius,rocks))continue;
        const cost=costs[current]+distance(nodes[current],nodes[i]);
        if(cost<costs[i]){costs[i]=cost;previous[i]=current;}
      }
    }
    if(!Number.isFinite(costs[1]))return [];
    const path=[];for(let i=1;i!==0;i=previous[i])path.unshift(nodes[i]);
    return path;
  }
  function resolveRockCollision(ship,rocks,world){
    let collided=false;
    for(let pass=0;pass<6;pass++)for(const rock of rocks){
      let dx=ship.x-rock.x,dy=ship.y-rock.y,d=Math.hypot(dx,dy),min=rock.r+ship.r+5;
      if(d<.001){dx=1;dy=0;d=1;}
      if(d>=min)continue;
      const nx=dx/d,ny=dy/d;ship.x=rock.x+nx*min;ship.y=rock.y+ny*min;collided=true;
      if(Number.isFinite(ship.vx)){
        const inward=ship.vx*nx+ship.vy*ny;
        if(inward<0){ship.vx-=inward*nx;ship.vy-=inward*ny;}
      }
    }
    ship.x=clamp(ship.x,ship.r+5,world.w-ship.r-5);ship.y=clamp(ship.y,ship.r+5,world.h-ship.r-5);
    return collided;
  }
  function engineThrusters(){
    const bounds=shipBounds();
    return activeModules('engine').map((module)=>{
      const cells=moduleCells(module),cx=cells.reduce((sum,[x])=>sum+x+.5,0)/cells.length,cy=cells.reduce((sum,[,y])=>sum+y+.5,0)/cells.length;
      const direction=module.rotation*Math.PI/2,force=MODULES.engine.thrust*(1+.2*(module.level-1));
      const rx=(cx-bounds.cx)*COMBAT_TILE,ry=(cy-bounds.cy)*COMBAT_TILE;
      return {module,rx,ry,direction,force,torque:(rx*Math.sin(direction)-ry*Math.cos(direction))*force};
    });
  }
  function angleForAvailableTorque(player,heading,thrusters){
    let diff=angleDifference(player.angle,heading);
    const positive=thrusters.some((engine)=>engine.torque>5),negative=thrusters.some((engine)=>engine.torque<-5);
    if(diff<0&&!negative&&positive)diff+=TAU;
    if(diff>0&&!positive&&negative)diff-=TAU;
    return diff;
  }
  function navigatePlayer(dt){
    const p=battle.player,engines=engineThrusters(),cellCount=save.modules.reduce((sum,module)=>sum+moduleCells(module).length,0);
    const mass=Math.max(2,cellCount*.3),inertia=mass*p.r*p.r*.42,lever=Math.max(20,p.r*.58);
    let desiredX=-p.vx*1.6,desiredY=-p.vy*1.6,heading=p.targetAngle;
    if(p.dest){
      if(p.path.length>1&&distance(p,p.path[0])<34)p.path.shift();
      const waypoint=p.path[0]||p.dest;
      const dx=waypoint.x-p.x,dy=waypoint.y-p.y,dist=Math.hypot(dx,dy),speed=Math.hypot(p.vx,p.vy);
      if(p.path.length<=1&&dist<22&&speed<12){p.dest=null;p.path=[];}
      else{
        desiredX=clamp(dx*.38-p.vx*2.4,-55,55);desiredY=clamp(dy*.38-p.vy*2.4,-55,55);
        const magnitude=Math.hypot(desiredX,desiredY),factor=Math.min(1,55/(magnitude||1));desiredX*=factor;desiredY*=factor;
        for(const rock of battle.asteroids){
          const rx=p.x-rock.x,ry=p.y-rock.y,d=Math.hypot(rx,ry)||1,clearance=rock.r+p.r+35;
          if(d<clearance){const strength=(clearance-d)/clearance*105;desiredX+=rx/d*strength;desiredY+=ry/d*strength;}
        }
        if(dist>34&&Math.hypot(desiredX,desiredY)>9){
          let thrustX=0,thrustY=0;for(const engine of engines){thrustX+=Math.cos(engine.direction)*engine.force;thrustY+=Math.sin(engine.direction)*engine.force;}
          const bodyThrustAngle=Math.atan2(thrustY,thrustX);
          heading=Math.atan2(desiredY,desiredX)-bodyThrustAngle;
        }
      }
    }
    const desiredTorque=clamp(inertia*(angleForAvailableTorque(p,heading,engines)*2-p.omega*3.6),-22000,22000);
    const desired=[mass*desiredX,mass*desiredY,desiredTorque/lever*1.25],coeff=engines.map((engine)=>{
      const direction=p.angle+engine.direction;
      return [Math.cos(direction)*engine.force,Math.sin(direction)*engine.force,engine.torque/lever*1.25];
    });
    const throttles=engines.map(()=>0);
    for(let pass=0;pass<12;pass++)for(let i=0;i<engines.length;i++){
      const vector=coeff[i],other=[0,0,0];
      for(let j=0;j<engines.length;j++)if(j!==i)for(let k=0;k<3;k++)other[k]+=coeff[j][k]*throttles[j];
      const numerator=vector.reduce((sum,value,k)=>sum+value*(desired[k]-other[k]),0);
      const denominator=vector.reduce((sum,value)=>sum+value*value,0);
      throttles[i]=clamp(numerator/(denominator||1),0,1);
    }
    let fx=0,fy=0,torque=0;p.thrusters={};
    for(let i=0;i<engines.length;i++){
      const throttle=throttles[i],engine=engines[i],direction=p.angle+engine.direction;
      fx+=Math.cos(direction)*engine.force*throttle;fy+=Math.sin(direction)*engine.force*throttle;
      torque+=engine.torque*throttle;p.thrusters[engine.module.id]=throttle;
    }
    p.vx=clamp((p.vx+fx/mass*dt)*Math.exp(-.16*dt),-85,85);
    p.vy=clamp((p.vy+fy/mass*dt)*Math.exp(-.16*dt),-85,85);
    p.omega=clamp((p.omega+torque/inertia*dt)*Math.exp(-.7*dt),-1.45,1.45);
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.omega*dt;
    if(p.x<p.r+5){p.x=p.r+5;p.vx=Math.max(0,p.vx);}if(p.x>battle.world.w-p.r-5){p.x=battle.world.w-p.r-5;p.vx=Math.min(0,p.vx);}
    if(p.y<p.r+5){p.y=p.r+5;p.vy=Math.max(0,p.vy);}if(p.y>battle.world.h-p.r-5){p.y=battle.world.h-p.r-5;p.vy=Math.min(0,p.vy);}
    if(resolveRockCollision(p,battle.asteroids,battle.world)&&p.dest){
      const route=routeAroundRocks(p,p.dest,p.r,battle.asteroids,battle.world);
      if(route.length)p.path=route;
    }
  }
  function weaponWorld(module,player){
    const mount=weaponGeometry(module),bounds=shipBounds();
    const lx=(mount.x-bounds.cx)*COMBAT_TILE,ly=(mount.y-bounds.cy)*COMBAT_TILE,cos=Math.cos(player.angle),sin=Math.sin(player.angle);
    return {x:player.x+lx*cos-ly*sin,y:player.y+lx*sin+ly*cos,direction:player.angle+mount.direction};
  }
  function weaponCanTarget(weapon,player,target) {
    const mount=weaponWorld(weapon,player),aim=Math.atan2(target.y-mount.y,target.x-mount.x),dist=distance(target,mount);
    return dist<=weaponRange(weapon)&&Math.abs(angleDifference(mount.direction,aim))<=MODULES[weapon.type].arc*Math.PI/360
      &&hullRay(weaponGeometry(weapon),aim-player.angle,save.modules.flatMap(moduleCells),dist/COMBAT_TILE)>=dist/COMBAT_TILE;
  }
  function fireProjectile(owner,x,y,target,damage,speed,range=speed*2.3){
    const angle=Math.atan2(target.y-y,target.x-x);
    battle.projectiles.push({owner,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage,life:range/speed,remaining:range});
  }
  function worldToHull(point,player) {
    const bounds=shipBounds(),dx=point.x-player.x,dy=point.y-player.y,cos=Math.cos(player.angle),sin=Math.sin(player.angle);
    return {x:(dx*cos+dy*sin)/COMBAT_TILE+bounds.cx,y:(-dx*sin+dy*cos)/COMBAT_TILE+bounds.cy};
  }
  function rayCircle(origin,dx,dy,circle,radius) {
    const x=origin.x-circle.x,y=origin.y-circle.y,b=x*dx+y*dy,c=x*x+y*y-radius*radius;
    if(c<=0)return 0;
    const discriminant=b*b-c;
    if(discriminant<0)return Infinity;
    const entry=-b-Math.sqrt(discriminant);
    return entry>=0?entry:Infinity;
  }
  function damagePlayer(amount){
    const live=save.modules.filter((module)=>module.hp>0);if(!live.length)return;
    const shields=activeModules('shield').length,final=amount*(shields?Math.max(.55,1-.2*shields):1),weights=live.map((module)=>module.type==='core'?1:2);
    let roll=rand(0,weights.reduce((a,b)=>a+b,0)),target=live[0];
    for(let i=0;i<live.length;i++){roll-=weights[i];if(roll<=0){target=live[i];break;}}
    target.hp=Math.max(0,target.hp-final);battle.shake=.12;
    if(target.hp===0){log(`${MODULES[target.type].name} disabled!`);toast(`${MODULES[target.type].name} disabled!`);}
    if(save.modules.find((module)=>module.type==='core').hp<=0)finishBattle(false);
  }
  function updateBattle(dt,time){
    if(!battle)return;const b=battle,p=b.player;b.shake=Math.max(0,b.shake-dt);
    navigatePlayer(dt);
    for(const module of save.modules){
      if(module.hp<=0||module.hp>=maxHp(module))continue;
      const repairers=crewAtStation('repair',module);
      if(repairers)module.hp=Math.min(maxHp(module),module.hp+dt*5*repairers);
    }
    const living=b.enemies.filter((enemy)=>enemy.hp>0);
    for(const weapon of activeModules('weapon','railgun')){
      const def=MODULES[weapon.type],mount=weaponWorld(weapon,p);weapon.cooldown-=dt;
      if(weapon.cooldown>0||b.ammo<def.ammo)continue;
      const target=living.filter((enemy)=>weaponCanTarget(weapon,p,enemy)).sort((a,c)=>distance(a,mount)-distance(c,mount))[0];
      if(target){
        b.ammo-=def.ammo;weapon.cooldown=def.reload/(1+crewAtStation('gun',weapon)*.4)/(1+(weapon.level-1)*.22);
        fireProjectile('player',mount.x,mount.y,target,def.damage+(weapon.level-1)*5,weapon.type==='railgun'?530:390,weaponRange(weapon));
      }
    }
    for(const enemy of living){
      const dx=p.x-enemy.x,dy=p.y-enemy.y,dist=Math.hypot(dx,dy)||1;
      enemy.pathTimer-=dt;enemy.moving=dist>220;
      if(enemy.moving){
        if(enemy.pathTimer<=0||!enemy.path.length){
          const goal=safePoint(p,enemy.r,b.asteroids,b.world);
          enemy.path=routeAroundRocks(enemy,goal,enemy.r,b.asteroids,b.world);enemy.pathTimer=1.2;
        }
        if(enemy.path.length>1&&distance(enemy,enemy.path[0])<14)enemy.path.shift();
        const waypoint=enemy.path[0];
        if(waypoint){const vx=waypoint.x-enemy.x,vy=waypoint.y-enemy.y,length=Math.hypot(vx,vy)||1;enemy.x+=vx/length*enemy.speed*dt;enemy.y+=vy/length*enemy.speed*dt;}
      }else{enemy.x+=Math.cos(time*.001+enemy.phase)*enemy.speed*.32*dt;enemy.y+=Math.sin(time*.001+enemy.phase)*enemy.speed*.32*dt;}
      if(resolveRockCollision(enemy,b.asteroids,b.world))enemy.pathTimer=0;
      enemy.angle+=clamp(angleDifference(enemy.angle,Math.atan2(dy,dx)),-dt*2,dt*2);
      enemy.cooldown-=dt;if(enemy.cooldown<=0&&dist<470){
        enemy.cooldown=rand(1.7,2.3);
        const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle);
        fireProjectile('enemy',enemy.x+ENEMY_TILE*4*cos+ENEMY_TILE*sin,enemy.y+ENEMY_TILE*4*sin-ENEMY_TILE*cos,p,7+save.sector*.65,270);
      }
    }
    for(let i=b.projectiles.length-1;i>=0;i--){
      const shot=b.projectiles[i],speed=Math.hypot(shot.vx,shot.vy),dx=shot.vx/speed,dy=shot.vy/speed;
      const travel=Math.min(speed*dt,shot.remaining);
      let stop=travel,hit=false,target=null;
      if(shot.owner==='player'){
        const blocked=hullRay(worldToHull(shot,p),Math.atan2(dy,dx)-p.angle,save.modules.flatMap(moduleCells),travel/COMBAT_TILE)*COMBAT_TILE;
        if(blocked<travel){stop=blocked;hit=true;}
      }
      for(const rock of b.asteroids){
        const entry=rayCircle(shot,dx,dy,rock,rock.r*.87);
        if(entry<=stop){stop=entry;hit=true;}
      }
      const targets=shot.owner==='player'?b.enemies.filter((enemy)=>enemy.hp>0):[p];
      for(const candidate of targets){
        const entry=rayCircle(shot,dx,dy,candidate,candidate.r*(shot.owner==='enemy'?.82:1));
        if(entry<stop||(!hit&&entry<=stop)){stop=entry;hit=true;target=candidate;}
      }
      shot.x+=dx*stop;shot.y+=dy*stop;shot.remaining-=stop;shot.life-=dt;
      if(target&&shot.owner==='player'){
        target.hp=Math.max(0,target.hp-shot.damage);
        if(target.hp===0){log(`${target.name} destroyed.`);toast(`${target.name} destroyed`);}
      }else if(target){damagePlayer(shot.damage);if(!battle)return;}
      if(hit||shot.remaining<=1e-7||shot.x<0||shot.x>b.world.w||shot.y<0||shot.y>b.world.h)b.projectiles.splice(i,1);
    }
    if(b.enemies.every((enemy)=>enemy.hp<=0)){finishBattle(true);return;}
    if(time-lastHudRefresh>280){lastHudRefresh=time;renderHud();renderInspector();refreshCrewStatus();}
  }
  function enemySprite(heavy,moving){
    const key=`${heavy}:${moving}`;if(enemySprites.has(key))return enemySprites.get(key);
    const sprite=document.createElement('canvas');sprite.width=220;sprite.height=160;
    const g=sprite.getContext('2d');g.imageSmoothingEnabled=false;g.translate(110,80);
    const modules=enemyLayout(heavy).modules,occupied=new Set(modules.flatMap((module)=>module.cells.map(([x,y])=>`${x},${y}`)));
    const colors={core:'#d98495',weapon:'#e3a373',engine:'#87b9c4',armor:'#9b9bad'};
    for(const module of modules)for(const [x,y] of module.cells){
      const px=x*ENEMY_TILE-11,py=y*ENEMY_TILE-11;
      g.fillStyle='#211a2a';g.fillRect(px,py,22,22);
      g.fillStyle=colors[module.type];g.fillRect(px+2,py+2,18,18);
      g.fillStyle='#4a3547';g.fillRect(px+4,py+4,14,14);
      g.fillStyle='#70515e';g.fillRect(px+5,py+5,12,2);g.fillRect(px+5,py+15,12,1);
      g.fillStyle='#342b3b';g.fillRect(px+9,py+8,4,6);
      g.fillStyle='#f2c2a8';g.fillRect(px+3,py+3,2,1);g.fillRect(px+18,py+18,2,1);
      if(!occupied.has(`${x-1},${y}`)){g.fillStyle='#a87989';g.fillRect(px,py+2,2,18);g.fillStyle='#e7a5a4';g.fillRect(px,py+4,1,4);}
      if(!occupied.has(`${x+1},${y}`)){g.fillStyle='#a87989';g.fillRect(px+20,py+2,2,18);g.fillStyle='#e7a5a4';g.fillRect(px+21,py+4,1,4);}
      if(!occupied.has(`${x},${y-1}`)){g.fillStyle='#a87989';g.fillRect(px+2,py,18,2);g.fillStyle='#e7a5a4';g.fillRect(px+4,py,4,1);}
      if(!occupied.has(`${x},${y+1}`)){g.fillStyle='#a87989';g.fillRect(px+2,py+20,18,2);g.fillStyle='#e7a5a4';g.fillRect(px+4,py+21,4,1);}
    }
    g.fillStyle='#101e2b';g.fillRect(-8,-8,16,15);g.fillStyle='#71c5d2';g.fillRect(-6,-6,12,8);
    g.fillStyle='#dffff0';g.fillRect(-4,-5,6,2);g.fillStyle='#eeb27f';g.fillRect(-5,5,3,2);g.fillRect(3,5,3,2);
    g.fillStyle='#1c2633';g.fillRect(-55,-8,14,16);g.fillStyle='#86b6c3';g.fillRect(-54,-6,10,12);
    g.fillStyle='#caeef0';g.fillRect(-50,-3,5,6);
    if(moving){g.fillStyle='#55d7ee';g.fillRect(-68,-5,13,10);g.fillStyle='#ffe3a4';g.fillRect(-75,-2,8,4);}
    g.fillStyle='#1e2131';g.fillRect(61,-27,20,17);g.fillStyle='#e3a373';g.fillRect(63,-25,17,13);
    g.fillStyle='#3c2938';g.fillRect(65,-22,15,7);g.fillStyle='#ffdbab';g.fillRect(77,-20,14,3);
    g.fillStyle='#fff0cf';g.fillRect(89,-19,6,1);
    if(heavy){g.fillStyle='#c2b9c9';g.fillRect(-10,39,20,5);g.fillStyle='#715e76';g.fillRect(-6,44,12,8);}
    enemySprites.set(key,sprite);return sprite;
  }
  function drawEnemy(enemy){
    const g=ctx,r=enemy.r;
    g.save();g.translate(Math.round(enemy.x),Math.round(enemy.y));g.rotate(enemy.angle);
    g.drawImage(enemySprite(enemy.modules.length===4,enemy.moving),-110,-80);
    g.restore();
    g.fillStyle='#081827';g.fillRect(enemy.x-25,enemy.y-r-16,50,6);
    g.fillStyle='#ec7b82';g.fillRect(enemy.x-24,enemy.y-r-15,48*enemy.hp/enemy.maxHp,4);
  }
  function drawArena(time){
    if(!battle)return;const b=battle,w=b.world.w,h=b.world.h,p=b.player;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.scale(canvas.width/w,canvas.height/h);
    ctx.fillStyle='#071522';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#1d3449';ctx.lineWidth=2;
    for(let x=0;x<w;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<h;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(const star of b.stars){ctx.fillStyle=star.s===2?'#8cbdc4':'#4f7386';ctx.fillRect(star.x,star.y,star.s,star.s);}
    ctx.strokeStyle='#4b7488';ctx.lineWidth=4;ctx.strokeRect(3,3,w-6,h-6);
    for(const rock of b.asteroids){
      ctx.save();ctx.translate(Math.round(rock.x),Math.round(rock.y));ctx.rotate(rock.spin);
      const sprite=rock.sprite||(rock.sprite=asteroidSprite(rock));ctx.drawImage(sprite,-sprite.width/2,-sprite.height/2);ctx.restore();
    }
    if(p.dest){
      ctx.setLineDash([9,9]);ctx.strokeStyle='#7bdee3aa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);for(const point of p.path)ctx.lineTo(point.x,point.y);ctx.stroke();ctx.setLineDash([]);
      ctx.strokeStyle='#80e2e4';ctx.strokeRect(p.dest.x-9,p.dest.y-9,18,18);
      ctx.beginPath();ctx.moveTo(p.dest.x,p.dest.y);ctx.lineTo(p.dest.x+Math.cos(p.targetAngle)*26,p.dest.y+Math.sin(p.targetAngle)*26);ctx.stroke();
    }
    const selected=selectedModule();
    if(p.selected&&selected&&MODULES[selected.type].muzzle){
      const mount=weaponWorld(selected,p);
      const bounds=shipBounds();
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.translate(-bounds.cx*COMBAT_TILE,-bounds.cy*COMBAT_TILE);
      drawWeaponArc(ctx,selected,COMBAT_TILE,'rgba(244,177,108,.17)');ctx.restore();
      ctx.fillStyle='#ffe5b7';ctx.fillRect(mount.x-3,mount.y-3,6,6);
    }
    for(const enemy of b.enemies)if(enemy.hp>0)drawEnemy(enemy);
    if(p.selected){ctx.strokeStyle='#88e5e5';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+13,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    drawInterior(spriteCtx,false,p.thrusters);
    const bounds=shipBounds(),minX=Math.max(0,bounds.minX-2),minY=Math.max(0,bounds.minY-2);
    const maxX=Math.min(GRID_W-1,bounds.maxX+2),maxY=Math.min(GRID_H-1,bounds.maxY+2);
    const width=maxX-minX+1,height=maxY-minY+1;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    ctx.drawImage(shipSprite,minX*TILE,minY*TILE,width*TILE,height*TILE,(minX-bounds.cx)*COMBAT_TILE,(minY-bounds.cy)*COMBAT_TILE,width*COMBAT_TILE,height*COMBAT_TILE);
    ctx.restore();
    for(const shot of b.projectiles){ctx.fillStyle=shot.owner==='player'?'#ffdb92':'#fc828a';ctx.fillRect(shot.x-4,shot.y-4,8,8);ctx.fillStyle=shot.owner==='player'?'#e8a75e88':'#d65f7088';ctx.fillRect(shot.x-shot.vx*.025,shot.y-shot.vy*.025,4,4);}
    ctx.fillStyle='#a6c8d0';ctx.font='14px monospace';ctx.fillText(`SECTOR ${String(save.sector).padStart(2,'0')}  //  ${Math.round(hullRatio()*100)}% HULL`,20,h-19);
    if(p.selected){ctx.fillStyle='#92dfe0';ctx.fillText(`SPEED ${Math.round(Math.hypot(p.vx,p.vy))}  TURN ${Math.round(Math.abs(p.omega)*180/Math.PI)}°/s`,w-270,h-19);}
  }
  function fitArenaCanvas(){
    const arena=canvas.parentElement,scale=Math.min(arena.clientWidth/canvas.width,arena.clientHeight/canvas.height);
    if(scale<=0)return;
    canvas.style.width=`${Math.floor(canvas.width*scale)}px`;
    canvas.style.height=`${Math.floor(canvas.height*scale)}px`;
  }
  function canvasPoint(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width*battle.world.w,y:(event.clientY-rect.top)/rect.height*battle.world.h};}
  function selectPlayer(point=null){
    if(!battle)return;const p=battle.player;p.selected=true;
    if(point){
      const dx=point.x-p.x,dy=point.y-p.y,cos=Math.cos(p.angle),sin=Math.sin(p.angle),bounds=shipBounds();
      const localX=dx*cos+dy*sin,localY=-dx*sin+dy*cos;
      const gx=Math.floor(localX/COMBAT_TILE+bounds.cx),gy=Math.floor(localY/COMBAT_TILE+bounds.cy),module=occupancy().get(`${gx},${gy}`);
      if(module){selectedModuleId=module.id;renderInspector();}
    }
    $('combatHint').textContent='SCROLL TO ROTATE · RIGHT CLICK TO MOVE';toast('Ship selected');
  }
  function orderMove(point){
    if(!battle)return;if(!battle.player.selected){toast('Select your ship first.');return;}
    const p=battle.player,goal=safePoint(point,p.r,battle.asteroids,battle.world);
    const path=routeAroundRocks(p,goal,p.r,battle.asteroids,battle.world);
    if(!path.length){toast('No clear route to that location.');return;}
    p.dest=goal;p.path=path;
    $('combatHint').textContent='THRUSTERS STEERING TO WAYPOINT · RIGHT CLICK TO REDIRECT';
  }
  function rotateArrival(step){
    if(!battle)return;if(!battle.player.selected){toast('Select your ship first.');return;}
    battle.player.targetAngle+=step*Math.PI/12;
    const degrees=((Math.round(battle.player.targetAngle*180/Math.PI)%360)+360)%360;
    $('combatRotationLabel').textContent=`${degrees}°`;
    $('combatHint').textContent='SHIP TURNING UNDER ENGINE THRUST';
  }
  function refreshCrewStatus(){
    $('crewList').querySelectorAll('.crew-card').forEach((card,index)=>{
      const person=save.crew.find((member)=>member.id===CREW[index].id),route=crewRoutes[person.id];
      const moving=route?.path?.length&&distance(person,route.path[0])>.08;
      card.querySelector('small').textContent=moving?'WALKING':'AT STATION';
    });
  }
  function frame(time){
    const dt=Math.min(.05,(time-lastFrame)/1000||0);lastFrame=time;
    if(screen==='playing'){
      if(!eventOpen)updateCrew(dt);
      if(mode==='combat'&&battle){updateBattle(dt,time);drawArena(time);}
      if(mode==='hangar')drawHangar();
      if(time-lastHudRefresh>700){lastHudRefresh=time;refreshCrewStatus();}
    }
    requestAnimationFrame(frame);
  }
  function init(){
    createGrid();
    window.addEventListener('resize',()=>{if(screen==='playing'&&mode==='combat')fitArenaCanvas();});
    $('menuContinue').addEventListener('click',()=>{if(canContinue())showGame();});
    $('menuNew').addEventListener('click',()=>{if(canContinue())$('menuConfirm').hidden=false;else startNewGame();});
    $('confirmNew').addEventListener('click',startNewGame);
    $('cancelNew').addEventListener('click',()=>{$('menuConfirm').hidden=true;$('menuNew').focus();});
    $('menuQuit').addEventListener('click',quitGame);
    $('quitReturn').addEventListener('click',showMainMenu);
    $('buildWeaponFacing').addEventListener('click',()=>{buildWeaponFacing=buildWeaponFacing?0:1;renderGrid();});
    $('buildRotateLeft').addEventListener('click',()=>rotateBuild(-1));$('buildRotateRight').addEventListener('click',()=>rotateBuild(1));
    $('combatRotateLeft').addEventListener('click',()=>rotateArrival(-1));$('combatRotateRight').addEventListener('click',()=>rotateArrival(1));
    $('selectShipButton').addEventListener('click',()=>selectPlayer());$('jumpButton').addEventListener('click',toggleMap);$('resetButton').addEventListener('click',returnToMainMenu);
    $('nextSectorButton').addEventListener('click',goNextSector);
    canvas.addEventListener('contextmenu',(event)=>event.preventDefault());
    canvas.addEventListener('wheel',(event)=>{event.preventDefault();rotateArrival(event.deltaY>0?1:-1);},{passive:false});
    canvas.addEventListener('pointerdown',(event)=>{
      if(!battle)return;const point=canvasPoint(event);
      if(event.button===2){event.preventDefault();orderMove(point);return;}
      if(event.button!==0)return;
      if(distance(point,battle.player)<battle.player.r+14)selectPlayer(point);
      else if(event.pointerType==='touch')orderMove(point);
    });
    document.addEventListener('keydown',(event)=>{
      if(event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;
      if(screen==='menu'){if(event.key==='Escape')$('menuConfirm').hidden=true;return;}
      if(screen!=='playing')return;
      if(event.key.toLowerCase()==='q'){if(mode==='combat')rotateArrival(-1);else if(mode==='hangar')rotateBuild(-1);}
      if(event.key.toLowerCase()==='e'){if(mode==='combat')rotateArrival(1);else if(mode==='hangar')rotateBuild(1);}
      if(event.key==='Escape'&&mode==='hangar'&&!eventOpen){selectedCatalog=null;renderAll();}
    });
    log('Ship systems online. Plot a route on the sector map.');
    renderAll();showMainMenu();requestAnimationFrame(frame);
  }
  init();
})();
