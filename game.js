(() => {
  'use strict';

  const GRID_W = 12, GRID_H = 10, TILE = 24, COMBAT_TILE = 30, ENEMY_TILE = 22, SAVE_KEY = 'starship-drift-save-v1';
  const TAU = Math.PI * 2;
  const WRECK_BERTH = 62;
  // Preserve the source drawing's little square pixels before rotating the
  // assembled image. The display canvas samples this at native screen density.
  const SPRITE_SCALE = 4;
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const C = {
    core: '#78dbea', engine: '#8cd7b0', weapon: '#f4b878', railgun: '#f29490',
    shield: '#bfa6f1', armor: '#9aadc0', cargo: '#e5ca84'
  };
  const MODULES = {
    core: { name: 'Command Core', short: 'C', color: C.core, shape: [[0,0],[1,0],[0,1],[1,1]], station: [0,0], hp: 170, cost: 0, description: 'Command console and shared power source. Staff a pilot here to enable engine evasion.' },
    engine: { name: 'Standard Ion Engine', short: 'E', color: C.engine, shape: [[0,0],[0,1],[0,2]], station: [0,1], hp: 80, cost: 35, thrust: 270, description: 'Powered directional thruster. An operator boosts thrust; a pilot enables evasion. Keep the exhaust clear.' },
    smallEngine: { name: 'Compact Ion Engine', short: 'E', color: '#90c6d8', shape: [[0,0]], station: [0,0], hp: 50, cost: 22, thrust: 110, description: 'Single-cell maneuvering thruster. Low force, easy to fit at the hull edge. Keep the exhaust clear.' },
    heavyEngine: { name: 'Heavy Ion Engine', short: 'E', color: '#a7c99b', shape: [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]], station: [0,1], hp: 125, cost: 70, thrust: 620, description: 'Six-cell drive with three exhaust nozzles. High force for heavy hulls. Keep the exhaust clear.' },
    weapon: { name: 'Pulse Cannon', short: 'W', color: C.weapon, shape: [[0,0],[1,0],[1,1]], station: [1,1], mount: [1,0], muzzle: [2,.5], hp: 75, cost: 45, range: 420, arc: 130, damage: 14, reload: 1.2, ammo: 1, description: 'A crewed pulse cannon with a 130° forward firing arc.' },
    railgun: { name: 'Railgun', short: 'R', color: C.railgun, shape: [[0,0],[1,0],[2,0],[3,0]], station: [1,0], mount: [3,0], muzzle: [4,.5], hp: 90, cost: 70, range: 580, arc: 50, damage: 30, reload: 2.4, ammo: 2, description: 'Long-range damage through a narrow 50° firing arc.' },
    shield: { name: 'Wide Shield Array', short: 'S', color: C.shield, shape: [[0,0],[1,0],[0,1],[1,1]], station: [0,0], hp: 85, cost: 50, shield:'wide', capacity:100, recharge:10, description: 'A 100-strength full-hull shield. Shared power and a crew operator improve recharge.' },
    focusShield: { name: 'Focused Shield', short: 'F', color: '#91e8e4', shape: [[0,0],[1,0],[0,1]], station: [0,0], hp: 75, cost: 62, shield:'focused', capacity:160, recharge:16, arc:105, description: 'A 160-strength shield covering a 105° sector, with faster recharge.' },
    generator: { name: 'Small Power Generator', short: 'G', color: '#e5be72', shape: [[0,0],[1,0]], station: [0,0], hp: 65, cost: 35, generation: 2, description: 'Compact two-cell generator. Adds 2 shared power; each upgrade adds 1 more. No crew or power required.' },
    armor: { name: 'Armor Plating', short: 'A', color: C.armor, shape: [[0,0],[1,0],[0,1]], station: null, hp: 115, cost: 20, description: 'Open, durable floor that can absorb damage.' },
    cargo: { name: 'Ammo Hold', short: 'M', color: C.cargo, shape: [[0,0],[1,0],[2,0]], station: [1,0], hp: 65, cost: 25, description: 'Adds ammo capacity and a loading point for crew.' }
  };
  // Every weapon participates in construction, crew operation, and combat through
  // the same definition. Corner mounts can turn; long barrels remain fixed.
  MODULES.weapon.mountFacings=2;MODULES.weapon.speed=390;MODULES.weapon.family='cannon';
  MODULES.railgun.speed=530;MODULES.railgun.family='rail';MODULES.railgun.pierce=1;
  const WEAPON_DESIGNS = [
    {id:'autocannon',name:'Autocannon',color:'#e5c78b',range:360,arc:110,damage:8,reload:.55,ammo:1,speed:470,cost:48,family:'cannon',description:'Fast, accurate shells for close pursuit.'},
    {id:'gatling',name:'Gatling Battery',color:'#daca86',range:310,arc:100,damage:4,reload:.65,ammo:1,speed:500,cost:58,salvo:3,spread:8,family:'rotary',description:'Three-round bursts with a tight spread.'},
    {id:'flak',name:'Flak Battery',color:'#d9a76e',range:280,arc:150,damage:4,reload:1.7,ammo:2,speed:330,cost:55,salvo:5,spread:32,splash:24,family:'scatter',description:'Five explosive shells cover a wide cone.'},
    {id:'scattergun',name:'Scatter Cannon',color:'#e8d6ad',range:220,arc:140,damage:5,reload:1.1,ammo:1,speed:440,cost:42,salvo:7,spread:36,family:'scatter',description:'Seven close-range pellets fan across the target.'},
    {id:'plasma',name:'Plasma Cannon',color:'#b8a1f2',range:390,arc:100,damage:23,reload:2,ammo:2,speed:250,cost:68,splash:52,family:'plasma',description:'Slow plasma spheres explode across clustered ships.'},
    {id:'ion',name:'Ion Blaster',color:'#80dce9',range:400,arc:120,damage:7,reload:1.5,ammo:0,speed:420,cost:60,ion:.5,ionDuration:3,family:'energy',description:'Ion hits halve the struck system’s efficiency for three seconds.'},
    {id:'laser',name:'Laser Repeater',color:'#f2898c',range:450,arc:110,damage:5,reload:.42,ammo:0,speed:1100,cost:62,family:'laser',description:'Rapid laser bolts reach targets almost instantly.'},
    {id:'heavyLaser',name:'Heavy Laser',color:'#f5a6bc',range:540,arc:45,damage:28,reload:2.5,ammo:0,speed:1300,cost:88,fixed:true,length:3,family:'laser',description:'A focused, long-range laser on a fixed barrel.'},
    {id:'missile',name:'Missile Rack',color:'#d5dca4',range:560,arc:100,damage:20,reload:2.4,ammo:2,speed:250,cost:75,guidance:2.2,splash:38,family:'missile',description:'Guided missiles track moving targets and explode.'},
    {id:'swarm',name:'Swarm Launcher',color:'#a8d6a8',range:440,arc:140,damage:7,reload:2.2,ammo:3,speed:280,cost:82,salvo:4,spread:26,guidance:3.2,splash:18,family:'missile',description:'Four nimble guided rockets overwhelm a target.'},
    {id:'torpedo',name:'Torpedo Tube',color:'#e4aa90',range:650,arc:35,damage:48,reload:4.3,ammo:4,speed:190,cost:110,fixed:true,length:3,splash:75,family:'missile',description:'Heavy unguided torpedoes cause a broad explosion.'},
    {id:'siege',name:'Siege Cannon',color:'#bca692',range:600,arc:30,damage:55,reload:5,ammo:4,speed:340,cost:120,fixed:true,length:4,splash:42,family:'cannon',description:'Slow-loading siege shells deliver massive damage.'},
    {id:'disruptor',name:'Disruptor',color:'#b8e87e',range:340,arc:155,damage:5,reload:1.8,ammo:0,speed:520,cost:74,ion:.8,ionDuration:2,systemPulse:80,family:'energy',description:'A broad pulse reduces nearby systems’ efficiency by twenty percent for two seconds.'},
    {id:'tesla',name:'Tesla Coil',color:'#abafff',range:300,arc:150,damage:6,reload:1.8,ammo:0,speed:950,cost:80,chainSystems:3,chainRange:110,chainFalloff:.7,family:'energy',description:'A light electrical hit bounces through up to three more systems on the same ship, weakening with each jump.'},
    {id:'cryo',name:'Cryo Projector',color:'#a2eaf0',range:260,arc:140,damage:8,reload:.9,ammo:1,speed:300,cost:54,slow:.4,slowDuration:4,family:'plasma',description:'Cold bursts slow pursuers for four seconds.'},
    {id:'inferno',name:'Inferno Projector',color:'#f39a64',range:230,arc:130,damage:6,reload:1,ammo:1,speed:290,cost:57,burn:5,burnDuration:4,family:'plasma',description:'Incendiary hits burn for five damage per second.'},
    {id:'proton',name:'Proton Lance',color:'#f0df82',range:620,arc:25,damage:24,reload:2.8,ammo:0,speed:950,cost:98,fixed:true,length:4,hullPass:true,family:'energy',description:'A narrow lance passes safely through your own hull sections, stopping at the first enemy ship.'},
    {id:'gauss',name:'Gauss Repeater',color:'#9ac4dd',range:510,arc:55,damage:12,reload:1.6,ammo:2,speed:650,cost:84,fixed:true,length:3,salvo:2,spread:4,pierce:1,family:'rail',description:'Twin magnetic slugs each pierce a second target.'}
  ];
  for(const {id,fixed,length=2,...stats} of WEAPON_DESIGNS){
    const base=fixed?MODULES.railgun:MODULES.weapon;
    MODULES[id]={...base,pierce:0,...stats,short:stats.name[0],mountFacings:fixed?1:2};
    if(fixed){MODULES[id].shape=Array.from({length},(_,x)=>[x,0]);MODULES[id].mount=[length-1,0];MODULES[id].muzzle=[length,.5];MODULES[id].station=[0,0];}
  }
  const WEAPON_TYPES=Object.keys(MODULES).filter((type)=>MODULES[type].range);
  const legacyWeaponLayouts=Object.fromEntries(WEAPON_TYPES.map((type)=>[type,copyFootprint(MODULES[type])]));
  // Footprints follow the machinery: compact emitters, ammunition magazines,
  // paired launch pods, and long fixed accelerators are different rooms.
  const WEAPON_FOOTPRINTS={
    autocannon:{shape:[[0,0],[1,0]],station:[0,0],mount:[1,0]},
    gatling:{shape:[[0,0],[1,0],[2,0]],station:[0,0],mount:[2,0]},
    flak:{shape:[[0,0],[1,0],[2,0],[1,1]],station:[1,1],mount:[2,0]},
    scattergun:{shape:[[0,0],[0,1]],station:[0,1],mount:[0,0]},
    plasma:{shape:[[0,0],[1,0],[0,1],[1,1]],station:[0,1],mount:[1,0]},
    ion:{shape:[[0,0]],station:[0,0],mount:[0,0]},
    laser:{shape:[[0,0],[1,0]],station:[0,0],mount:[1,0]},
    heavyLaser:{shape:[[0,0],[1,0],[2,0]],station:[0,0],mount:[2,0]},
    missile:{shape:[[0,0],[1,0],[0,1],[1,1]],station:[0,1],mount:[1,0]},
    swarm:{shape:[[0,0],[0,1],[0,2],[1,2]],station:[0,1],mount:[1,2]},
    torpedo:{shape:[[0,0],[1,0],[2,0]],station:[0,0],mount:[2,0]},
    siege:{shape:[[0,0],[1,0],[2,0],[2,1],[2,2]],station:[2,2],mount:[2,0]},
    disruptor:{shape:[[0,0],[0,1],[0,2]],station:[0,1],mount:[0,0]},
    tesla:{shape:[[0,0],[1,0],[2,0],[1,1]],station:[1,1],mount:[2,0]},
    cryo:{shape:[[0,0],[1,0]],station:[0,0],mount:[1,0]},
    inferno:{shape:[[0,0],[0,1]],station:[0,1],mount:[0,0]},
    proton:{shape:[[0,0],[1,0],[2,0],[3,0]],station:[0,0],mount:[3,0]},
    gauss:{shape:[[0,0],[1,0],[1,1],[2,1]],station:[0,0],mount:[2,1]}
  };
  for(const [type,layout] of Object.entries(WEAPON_FOOTPRINTS))Object.assign(MODULES[type],layout,{muzzle:[layout.mount[0]+1,layout.mount[1]+.5]});
  MODULES.gatling.burstInterval=.09;MODULES.gauss.burstInterval=.12;MODULES.swarm.burstInterval=.1;
  MODULES.gatling.description='Three rounds fire in a timed burst, tracking the target between shots.';
  MODULES.gauss.description='Two magnetic slugs fire in sequence; each can pierce two ships.';
  MODULES.swarm.description='Four guided rockets launch in sequence before homing toward their target.';
  MODULES.missile.description='A guided rocket launches from a pod, clears your hull, then homes and explodes.';
  function copyFootprint(def){return {shape:def.shape.map((cell)=>[...cell]),station:def.station&&[...def.station],mount:def.mount&&[...def.mount],muzzle:def.muzzle&&[...def.muzzle]};}
  function migrateWeaponFootprints(data){
    if(data.weaponFootprintsVersion===2)return;
    for(const module of data.modules)if(legacyWeaponLayouts[module.type]&&!module.footprint){
      const old=legacyWeaponLayouts[module.type];
      if(JSON.stringify(old)!==JSON.stringify(copyFootprint(MODULES[module.type])))module.footprint=copyFootprint(old);
    }
    data.weaponFootprintsVersion=2;
  }
  const SHIELD_TYPES=Object.keys(MODULES).filter((type)=>type==='shield'||MODULES[type].shield);
  const ENGINE_TYPES=Object.keys(MODULES).filter((type)=>MODULES[type].thrust).sort((a,b)=>MODULES[a].thrust-MODULES[b].thrust);
  const BUYABLE = [...ENGINE_TYPES,...WEAPON_TYPES,'shield','focusShield','generator','armor','cargo'];
  const CREW = [
    { id: 'vega', name: 'VEGA', initial: 'V', color: '#f4bd77', task: 'gun', x: 5.5, y: 4.5 },
    { id: 'moss', name: 'MOSS', initial: 'M', color: '#8fddb5', task: 'repair', x: 6.5, y: 4.5 },
    { id: 'iris', name: 'IRIS', initial: 'I', color: '#c4acf1', task: 'load', x: 5.5, y: 5.5 }
  ];
  const TASKS = { pilot:'Pilot ship', engine:'Operate engines', gun: 'Operate weapons', shield: 'Operate shields', repair: 'Repair systems', load: 'Deliver ammo', idle: 'Stand by' };
  const EVENT_TYPES = {
    pirate: { name: 'PIRATES', icon: '⚔' }, rescue: { name: 'DISTRESS', icon: '◇' },
    salvage: { name: 'SALVAGE', icon: '✧' }, trader: { name: 'TRADER', icon: '◆' },
    anomaly: { name: 'ANOMALY', icon: '◈' }, derelict: { name: 'DERELICT', icon: '▣' },
    outpost: { name: 'OUTPOST', icon: '⌂' }, relay: { name: 'RELAY', icon: '⌁' },
    minefield: { name: 'MINEFIELD', icon: '◌' }, lifeboat: { name: 'LIFEBOAT', icon: '♡' },
    exit: { name: 'NEXT SECTOR', icon: '➜' }
  };

  function traderStock(){
    const stock=[];
    for(let i=0;i<5;i++){
      const type=WEAPON_TYPES[Math.floor(Math.random()*WEAPON_TYPES.length)],existing=stock.find((offer)=>offer.type===type);
      if(existing)existing.qty++;else stock.push({type,qty:1,price:Math.max(1,MODULES[type].cost+Math.floor(rand(-5,11)))});
    }
    const supports=[...SHIELD_TYPES,...ENGINE_TYPES,'generator',['armor','cargo'][Math.floor(Math.random()*2)]];
    for(const type of supports)stock.push({type,qty:1+Number(Math.random()<.25),price:Math.max(1,MODULES[type].cost+Math.floor(rand(-5,11)))});
    return stock;
  }
  function crewAppearance(person){
    const original=CREW.find((member)=>member.id===person.id),name=person.name||original?.name||'CREW';
    return {name,initial:person.initial||original?.initial||name[0],color:person.color||original?.color||'#b7cbe0'};
  }
  function traderRecruits(){
    const names=['NOVA','ORION','JUNO','ASH','ROOK','SABLE','LYRA','FINCH','SOL','PIPER','KAI','EMBER'];
    const colors=['#efc27c','#8fddb5','#c4acf1','#81cee4','#ea9baf'];
    const pool=[...names],offers=[];
    for(let i=0,count=1+Number(Math.random()<.5);i<count;i++){
      const name=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
      offers.push({id:`recruit-${i}`,name,initial:name[0],color:colors[Math.floor(Math.random()*colors.length)],price:40+Math.floor(Math.random()*16),hired:false});
    }
    return offers;
  }
  function buyRecruit(id){
    if(mode!=='trade'||!tradeNode)return false;
    const recruit=tradeNode.recruits?.find((offer)=>offer.id===id);
    if(!recruit||recruit.hired||save.metal<recruit.price)return false;
    const core=save.modules.find((module)=>module.type==='core'),point=moduleStation(core);
    save.nextCrewId??=1;let crewId;do{crewId=`crew-${save.nextCrewId++}`;}while(save.crew.some((person)=>person.id===crewId));
    save.metal-=recruit.price;recruit.hired=true;
    save.crew.push({id:crewId,name:recruit.name,initial:recruit.initial,color:recruit.color,task:'idle',...point});
    persist();log(`${recruit.name} joined the crew.`);renderAll();toast(`${recruit.name} recruited · assign a job in the crew panel`);return true;
  }
  function recruitCards(){
    if(!['all','crew'].includes(marketFilter))return '';
    return (tradeNode.recruits||[]).map((person)=>`<div class="catalog-item recruit-offer"><span class="crew-avatar" style="--crew-color:${person.color}">${person.initial}</span><div><strong>${person.name} · CREW</strong><small>Can pilot, operate engines, shields or weapons, repair, or deliver ammo.</small><div class="market-actions"><button type="button" data-recruit="${person.id}" ${person.hired||save.metal<person.price?'disabled':''}>${person.hired?'RECRUITED':`RECRUIT ◆ ${person.price}`}</button></div></div></div>`).join('');
  }

  function makeMap(base) {
    const pool=['pirate','rescue','salvage','anomaly','derelict','relay','minefield','lifeboat','pirate','rescue'];
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const usedVariants={},variantOffsets={};
    const nodes=[{id:'0-1',col:0,row:1,mapX:80,mapY:300,type:'start',links:[]}];
    for(let col=1;col<=4;col++)for(let row=0;row<3;row++){
      const type=col===2&&row===1?'trader':col===4&&row===1?'outpost':pool.pop();
      if(variantOffsets[type]===undefined)variantOffsets[type]=Math.floor(Math.random()*3);
      const variant=(variantOffsets[type]+(usedVariants[type]||0))%3;usedVariants[type]=(usedVariants[type]||0)+1;
      nodes.push({id:`${col}-${row}`,col,row,mapX:80+col*168+rand(-16,16),mapY:110+row*190+rand(-31,31),type,variant,links:[],stockVersion:type==='trader'?6:undefined,stock:type==='trader'?traderStock():undefined});
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
  function commandCore(data=save){return data.modules.find((module)=>module.type==='core');}
  function systemDemand(module){const def=MODULES[module.type];return ENGINE_TYPES.includes(module.type)||def.range||SHIELD_TYPES.includes(module.type)?2:0;}
  function coreOutput(data=save){const core=commandCore(data);return core?.hp>0?8+2*((core.powerLevel||1)-1):0;}
  function generatorOutput(module){const base=MODULES[module.type].generation;return module.hp>0&&base?base+module.level-1:0;}
  function auxiliaryOutput(data=save){return data.modules.reduce((sum,module)=>sum+generatorOutput(module),0);}
  function totalPower(data=save){return coreOutput(data)+auxiliaryOutput(data);}
  function poweredSystems(data=save){return data.modules.filter((module)=>module.hp>0&&systemDemand(module));}
  function sharedPower(data=save){const count=poweredSystems(data).length;return count?Math.min(2,totalPower(data)/count):0;}
  function powerUsed(){return poweredSystems().length*sharedPower();}
  function systemSupply(module){return module.hp>0&&systemDemand(module)?sharedPower():0;}
  function systemPower(module){return systemDemand(module)?systemSupply(module)/2:module.hp>0?1:0;}
  function normalizeSystems(data){
    const core=commandCore(data);
    if(core&&(!Number.isInteger(core.powerLevel)||core.powerLevel<1))core.powerLevel=Number.isInteger(data.reactorLevel)&&data.reactorLevel>0?data.reactorLevel:1;
    delete data.reactorLevel;
    for(const module of data.modules)delete module.power;
  }
  function upgradeCorePower(){
    const core=commandCore(),cost=40+20*((core?.powerLevel||1)-1);
    if(!core||core.hp<=0||!['hangar','trade'].includes(mode)||save.metal<cost)return false;
    save.metal-=cost;core.powerLevel=(core.powerLevel||1)+1;persist();renderAll();toast('Command core upgraded · +2 shared power');return true;
  }
  function evasionChance(){
    const core=save.modules.find((module)=>module.type==='core');
    if(!core||core.hp<=0||!crewAtStation('pilot',core))return 0;
    const engines=activeModules(...ENGINE_TYPES),power=engines.reduce((sum,module)=>sum+systemSupply(module),0);
    if(!power)return 0;
    return Math.min(.45,.05+power*.03+engines.reduce((sum,module)=>sum+Math.min(1,crewAtStation('engine',module))*.05,0));
  }
  function renderSystems(){
    const panel=$('systemsPanel'),scrollTop=panel.querySelector?.('.power-rows')?.scrollTop||0,core=commandCore();
    const count=poweredSystems().length,share=sharedPower(),cost=40+20*((core?.powerLevel||1)-1);
    panel.innerHTML=`<div class="reactor-summary"><strong>SHIP POWER · ${totalPower()}</strong><span>COMMAND CORE ${coreOutput()} + GENERATORS ${auxiliaryOutput()}<br>AUTO SHARE · ${count} SYSTEMS · ${share.toFixed(2)} EACH<br>${Math.round(evasionChance()*100)}% EVADE</span></div><button id="upgradeCorePower" type="button" ${!['hangar','trade'].includes(mode)||save.metal<cost?'disabled':''}>UPGRADE CORE POWER +2 · ◆ ${cost}</button><div class="power-rows">${save.modules.filter((module)=>systemDemand(module)).map((module)=>{
      const performance=systemPower(module),shield=SHIELD_TYPES.includes(module.type),stats=shield?shieldStats(module):null;
      const strength=shield?(battle?shieldState(module).charge:module.hp>0?stats.capacity:0):0;
      return `<div class="power-row"><span title="Grid ${module.x}, ${module.y}">${MODULES[module.type].name} <small>(${module.x}, ${module.y})</small></span><strong>${module.hp>0?`${Math.round(performance*100)}% POWER`:'OFFLINE'}</strong><div class="power-meter" role="meter" aria-label="${MODULES[module.type].name} performance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(performance*100)}"><span style="width:${performance*100}%"></span></div>${shield?`<span class="shield-strength">SHIELD ${Math.round(strength)} / ${stats.capacity}</span><div class="power-meter shield-meter"><span style="width:${strength/stats.capacity*100}%"></span></div>`:''}</div>`;
    }).join('')}</div><small>The command core and generators share power evenly across active systems. Lower power slows weapons, engine thrust, and shield recharge.</small>`;
    const rows=panel.querySelector?.('.power-rows');if(rows)rows.scrollTop=scrollTop;
    $('upgradeCorePower').addEventListener('click',upgradeCorePower);
  }

  function newSave() {
    const data={
      metal: 90, sector: 1, wins: 0, nextId: 6, starterLayoutVersion:2, weaponFootprintsVersion:2, inventory:{ion:1}, passengers:0, ammoCrates:0,
      modules: [
        { id: 1, type: 'core', x: 5, y: 4, rotation: 0, hp: 170, level: 1 },
        { id: 2, type: 'engine', x: 4, y: 2, rotation: 0, hp: 80, level: 1 },
        { id: 3, type: 'engine', x: 4, y: 5, rotation: 0, hp: 80, level: 1 },
        { id: 4, type: 'weapon', x: 6, y: 3, rotation: 0, hp: 75, level: 1 },
        { id: 5, type: 'weapon', x: 6, y: 5, rotation: 1, weaponFacing:1, hp: 75, level: 1 }
      ],
      crew: CREW.map(({id,name,initial,color,task,x,y}) => ({id,name,initial,color,task,x,y})),
      map: makeMap(1)
    };
    normalizeSystems(data);return data;
  }
  function migrateStarter(data) {
    if(data.starterLayoutVersion===2)return;
    const legacy=[['core',5,4,0],['engine',4,2,0],['engine',4,5,0],['weapon',6,3,0]];
    const untouched=data.modules.length===4&&legacy.every(([type,x,y,rotation])=>data.modules.some((m)=>m.type===type&&m.x===x&&m.y===y&&m.rotation===rotation&&m.level===1&&m.hp===MODULES[type].hp&&!(m.weaponFacing)));
    if(untouched){const id=Math.max(...data.modules.map((m)=>m.id))+1;data.modules.push({id,type:'weapon',x:6,y:5,rotation:1,weaponFacing:1,hp:75,level:1});}
    data.starterLayoutVersion=2;
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
      if(!Number.isFinite(data.passengers))data.passengers=0;
      if(!Number.isFinite(data.ammoCrates))data.ammoCrates=0;
      for (const template of CREW) {
        let person = data.crew.find((member) => member.id === template.id);
        if (!person) { person = { id: template.id, task: template.task }; data.crew.push(person); }
        if (!Number.isFinite(person.x)) person.x = template.x;
        if (!Number.isFinite(person.y)) person.y = template.y;
      }
      migrateStarter(data);migrateWeaponFootprints(data);
      data.nextId = Math.max(data.nextId || 1, ...data.modules.map((module) => module.id + 1));
      data.nextCrewId=Number.isInteger(data.nextCrewId)?data.nextCrewId:1;
      for(const person of data.crew){Object.assign(person,crewAppearance(person));if(!TASKS[person.task])person.task='idle';if(!Number.isFinite(person.x)||!Number.isFinite(person.y))Object.assign(person,moduleStation(data.modules.find((module)=>module.type==='core')));}
      normalizeSystems(data);
      return data;
    } catch (_) { return null; }
  }

  const storedSave = loadSave();
  let save = storedSave || newSave(), hasSave = !!storedSave, screen = 'menu', mode = 'hangar', selectedCatalog = null, selectedModuleId = 1;
  let movingModuleId=null, refittingFootprint=false;
  const buildView={x:0,y:0};
  let tradeNode=null, marketFilter='all';
  let buildRotation = 0, buildWeaponFacing = 0, hoverCell = null, battle = null, eventOpen = false, pendingNodeId = null;
  let toastTimer = null, lastFrame = performance.now(), lastHudRefresh = 0;
  const logEntries = [], gridButtons = [], crewRoutes = {};
  const canvas = $('combatCanvas'), ctx = canvas.getContext('2d');
  const hangarCanvas = $('hangarArt'), hangarCtx = hangarCanvas.getContext('2d');
  const shipSprite = document.createElement('canvas'); shipSprite.width = GRID_W*TILE*SPRITE_SCALE; shipSprite.height = GRID_H*TILE*SPRITE_SCALE;
  hangarCanvas.width=shipSprite.width;hangarCanvas.height=shipSprite.height;
  const spriteCtx = shipSprite.getContext('2d');
  const enemySprites = new Map();
  ctx.imageSmoothingEnabled = true;ctx.imageSmoothingQuality='high';
  hangarCtx.imageSmoothingEnabled = false;spriteCtx.imageSmoothingEnabled = false;

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
  function rotatedGeometry(type, rotation,layout=MODULES[type]) {
    const def = layout, raw = def.shape.map(([x,y]) => rotateRaw(x,y,rotation));
    const minX = Math.min(...raw.map(([x]) => x)), minY = Math.min(...raw.map(([,y]) => y));
    const turn = ([x,y]) => { const [rx,ry] = rotateRaw(x,y,rotation); return [rx-minX,ry-minY]; };
    // Cell indices rotate about their centers; muzzle coordinates lie on cell edges.
    const turnPoint = ([x,y]) => { const [rx,ry] = rotateRaw(x-.5,y-.5,rotation); return [rx+.5-minX,ry+.5-minY]; };
    return { cells: raw.map(([x,y]) => [x-minX,y-minY]), station: def.station && turn(def.station), mount: def.mount && turn(def.mount), muzzle: def.muzzle && turnPoint(def.muzzle) };
  }
  function moduleGeometry(module){return rotatedGeometry(module.type,module.rotation,module.footprint||MODULES[module.type]);}
  function placementFootprint(type){return !refittingFootprint&&movingModuleId!==null?save.modules.find((module)=>module.id===movingModuleId&&module.type===type)?.footprint:null;}
  function placementGeometry(type,rotation){return rotatedGeometry(type,rotation,placementFootprint(type)||MODULES[type]);}
  function weaponRange(module) {
    const maximum=MODULES[module.type].range;
    return Number.isFinite(module.range)?clamp(module.range,30,maximum):maximum;
  }
  function weaponGeometry(module) {
    const geometry=moduleGeometry(module),facing=MODULES[module.type].mountFacings===2&&module.weaponFacing===1?-1:0;
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
    if(MODULES[module.type].hullPass)return true;
    const mount=weaponGeometry(module),limit=hullEscapeLimit(mount,cells);
    return weaponAngles(module,cells).some((angle)=>hullRay(mount,angle,cells,limit)>=limit);
  }
  function weaponsHaveClearArc(modules) {
    const cells=modules.flatMap(moduleCells);
    return modules.filter((module)=>MODULES[module.type].muzzle).every((module)=>weaponHasEscape(module,cells));
  }
  function connectedHull(modules) {
    const cells=new Set(modules.flatMap(moduleCells).map(([x,y])=>`${x},${y}`));
    const queue=[cells.values().next().value],seen=new Set(queue);
    for(const key of queue){const [x,y]=key.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next=`${x+dx},${y+dy}`;if(cells.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}
    }}
    return seen.size===cells.size;
  }
  function canPlace(type,x,y,rotation) {
    if(movingModuleId!==null){
      const original=save.modules,moving=original.find((module)=>module.id===movingModuleId);
      if(!moving||type!==moving.type)return false;
      save.modules=original.filter((module)=>module!==moving);
      try {
        const candidate={...moving,x,y,rotation,weaponFacing:buildWeaponFacing,footprint:refittingFootprint?null:moving.footprint};
        return canPlaceFootprint(type,x,y,rotation,candidate.footprint)&&connectedHull([...save.modules,candidate])&&weaponsHaveClearArc([...save.modules,candidate]);
      } finally {save.modules=original;}
    }
    if(!canPlaceFootprint(type,x,y,rotation))return false;
    return weaponsHaveClearArc([...save.modules,{type,x,y,rotation,weaponFacing:buildWeaponFacing}]);
  }
  function moduleCells(module) { return moduleGeometry(module).cells.map(([x,y]) => [x+module.x,y+module.y]); }
  function moduleStation(module) {
    const geometry = moduleGeometry(module);
    const [x,y] = geometry.station || geometry.cells[0];
    return {x:module.x+x+.5,y:module.y+y+.5};
  }
  function occupancy() {
    const occupied = new Map();
    for (const module of save.modules) for (const [x,y] of moduleCells(module)) occupied.set(`${x},${y}`,module);
    return occupied;
  }
  function shipBounds() {
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const module of save.modules)for(const [x,y] of moduleCells(module)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    return {minX,maxX,minY,maxY,cx:(minX+maxX+1)/2,cy:(minY+maxY+1)/2};
  }
  function hullEscapeLimit(origin,cells){
    let limit=2;for(const [x,y] of cells)limit=Math.max(limit,Math.hypot(x-origin.x,y-origin.y)+3);return limit;
  }
  function shipArtFrame(){
    const b=shipBounds(),x=b.minX-2,y=b.minY-2,w=b.maxX-b.minX+5,h=b.maxY-b.minY+5;
    const scale=Math.min(SPRITE_SCALE,8192/(w*TILE),8192/(h*TILE),Math.sqrt(16000000/(w*h*TILE*TILE)));
    return {x,y,w,h,scale};
  }
  function sizeArtCanvas(canvas,frame){
    const w=Math.max(1,Math.ceil(frame.w*TILE*frame.scale)),h=Math.max(1,Math.ceil(frame.h*TILE*frame.scale));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  }
  function panBuild(dx,dy){buildView.x+=dx;buildView.y+=dy;hoverCell=null;renderGrid();}
  function centerBuildView(redraw=true){const b=shipBounds();buildView.x=Math.floor(b.cx-GRID_W/2);buildView.y=Math.floor(b.cy-GRID_H/2);hoverCell=null;if(redraw)renderGrid();}

  function moduleClearance(module){
    if(ENGINE_TYPES.includes(module.type)){
      const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][module.rotation],cells=moduleCells(module);
      const own=new Set(cells.map(([x,y])=>`${x},${y}`));
      const rear=cells.filter(([x,y])=>!own.has(`${x-dx},${y-dy}`)).map(([x,y])=>[x-dx,y-dy]);
      const station=moduleGeometry(module).station;
      rear.push([module.x+station[0]-2*dx,module.y+station[1]-2*dy]);
      return rear;
    }
    if(MODULES[module.type].muzzle&&!MODULES[module.type].hullPass){
      const mount=weaponGeometry(module);
      return [[Math.floor(mount.x+Math.cos(mount.direction)*1e-7),Math.floor(mount.y+Math.sin(mount.direction)*1e-7)]];
    }
    return [];
  }
  function exteriorCells(blocked){
    // Flood horizontal empty spans instead of a finite grid or every empty cell.
    const rows=new Map(),memo=new Map();
    for(const key of blocked){const [x,y]=key.split(',').map(Number);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(x);}
    for(const row of rows.values())row.sort((a,b)=>a-b);
    const span=(x,y)=>{
      const row=rows.get(y)||[];let lo=0,hi=row.length;
      while(lo<hi){const mid=(lo+hi)>>1;if(row[mid]<x)lo=mid+1;else hi=mid;}
      return {y,left:lo?row[lo-1]+1:-Infinity,right:lo<row.length?row[lo]-1:Infinity};
    };
    return {has(key){
      if(blocked.has(key))return false;
      const [x,y]=key.split(',').map(Number),queue=[span(x,y)],seen=new Set();let outside=false;
      for(let i=0;i<queue.length;i++){
        const part=queue[i],id=`${part.y}:${part.left}:${part.right}`;if(seen.has(id))continue;seen.add(id);
        if(memo.has(id)){if(memo.get(id)){outside=true;break;}continue;}
        if(!Number.isFinite(part.left)||!Number.isFinite(part.right)){outside=true;break;}
        for(const ny of [part.y-1,part.y+1]){
          let start=part.left;
          for(const wall of rows.get(ny)||[]){
            if(wall<start)continue;if(wall>part.right)break;
            if(wall>start)queue.push(span(start,ny));start=wall+1;
          }
          if(start<=part.right)queue.push(span(start,ny));
        }
      }
      for(const id of seen)memo.set(id,outside);return outside;
    }};
  }

  function hasClearMount(module){
    const occupied=occupancy(),reserved=new Set(save.modules.filter((other)=>other.id!==module.id).flatMap(moduleClearance).map(([x,y])=>`${x},${y}`));
    const outside=exteriorCells(new Set(occupied.keys()));
    return moduleClearance(module).every(([x,y])=>!occupied.has(`${x},${y}`)&&!reserved.has(`${x},${y}`)&&outside.has(`${x},${y}`));
  }
  function canPlaceFootprint(type,x,y,rotation,footprint=null) {
    const occupied=occupancy(),candidate={type,x,y,rotation,weaponFacing:buildWeaponFacing,footprint},cells=moduleCells(candidate);
    if(cells.some(([cx,cy])=>occupied.has(`${cx},${cy}`)))return false;
    const reserved=new Set(save.modules.flatMap(moduleClearance).map(([cx,cy])=>`${cx},${cy}`));
    if(cells.some(([cx,cy])=>reserved.has(`${cx},${cy}`)))return false;
    if(!cells.some(([cx,cy])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>occupied.has(`${cx+dx},${cy+dy}`))))return false;
    const blocked=new Set([...occupied.keys(),...cells.map(([cx,cy])=>`${cx},${cy}`)]);
    const clearance=moduleClearance(candidate);
    if(clearance.some(([cx,cy])=>blocked.has(`${cx},${cy}`)))return false;
    const outside=exteriorCells(blocked);
    return clearance.every(([cx,cy])=>outside.has(`${cx},${cy}`));
  }
  function placementAt(type,x,y,rotation) {
    if(canPlace(type,x,y,rotation))return {x,y,valid:true};
    const occupied=occupancy();
    if(!occupied.has(`${x},${y}`))return {x,y,valid:false};
    const shape=placementGeometry(type,rotation).cells,bounds=shipBounds();
    const outwardX=x+.5-bounds.cx,outwardY=y+.5-bounds.cy;
    let best=null,bestScore=Infinity;
    const anchors=new Set();
    for(const [dx,dy] of shape)for(const [nx,ny] of [[1,0],[-1,0],[0,1],[0,-1]])anchors.add(`${x+nx-dx},${y+ny-dy}`);
    for(const anchor of anchors){const [cx,cy]=anchor.split(',').map(Number);
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
  function activeModules(...types) { return save.modules.filter((module)=>types.includes(module.type)&&module.hp>0&&systemPower(module)>0); }
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
    for(let y=0;y<GRID_H;y++)for(let x=0;x<GRID_W;x++){
      const cell=document.createElement('button');cell.type='button';cell.className='grid-cell';cell.setAttribute('role','gridcell');
      cell.dataset.x=x;cell.dataset.y=y;
      const point=()=>({x:+cell.dataset.x,y:+cell.dataset.y});
      cell.addEventListener('mouseenter',()=>{hoverCell=point();renderGrid();});
      cell.addEventListener('focus',()=>{hoverCell=point();renderGrid();});
      cell.addEventListener('click',()=>{const p=point();onGridClick(p.x,p.y);});
      grid.append(cell);gridButtons.push(cell);
    }
    grid.addEventListener('mouseleave',()=>{hoverCell=null;renderGrid();});
    grid.addEventListener('wheel',(event)=>{event.preventDefault();if(event.deltaX||event.shiftKey)panBuild(Math.sign(event.deltaX||event.deltaY)*3,0);else panBuild(0,Math.sign(event.deltaY)*3);},{passive:false});
    document.querySelectorAll('[data-pan]').forEach((button)=>button.addEventListener('click',()=>{const [x,y]=button.dataset.pan.split(',').map(Number);panBuild(x,y);}));
    $('centerBuild').addEventListener('click',()=>centerBuildView());
  }

  function weaponBehavior(type){
    const d=MODULES[type],rules=[];
    if(d.burstInterval)rules.push(`${d.salvo} rounds · ${d.burstInterval}s apart`);
    else if(d.salvo>1)rules.push(`${d.salvo}-shot spread`);
    if(d.guidance)rules.push('Homing after hull clearance');
    else if(d.family==='missile')rules.push('Unguided explosive');
    if(d.splash)rules.push(`Blast radius ${d.splash}`);
    if(d.ion)rules.push(`${d.systemPulse?'Nearby systems':'Struck system'} ${Math.round(d.ion*100)}% for ${d.ionDuration}s`);
    if(d.systemPulse)rules.push(`System pulse radius ${d.systemPulse}`);
    if(d.chainSystems)rules.push(`Up to ${d.chainSystems+1} systems · ${Math.round(d.chainFalloff*100)}% per hop`);
    if(d.slow)rules.push(`Movement ${Math.round(d.slow*100)}% for ${d.slowDuration}s`);
    if(d.burn)rules.push(`Burn ${d.burn}/s for ${d.burnDuration}s`);
    if(d.chain)rules.push(`Chain within ${d.chain} · 50% damage`);
    if(d.pierce)rules.push(`Hits up to ${d.pierce+1} ships`);
    if(d.hullPass)rules.push('Own-hull passage · one enemy');
    return rules.join(' · ');
  }
  function footprintBadge(type,footprint=null){
    const cells=(footprint||MODULES[type]).shape,width=Math.max(...cells.map(([x])=>x))+1,height=Math.max(...cells.map(([,y])=>y))+1;
    return `<span class="footprint-diagram" style="width:${width*7}px;height:${height*7}px" aria-label="${cells.length} cell footprint">${cells.map(([x,y])=>`<i style="left:${x*7}px;top:${y*7}px"></i>`).join('')}</span><span>${cells.length} CELL${cells.length===1?'':'S'} · ${width} × ${height}${footprint?' · SAVED ROOM':''}</span>`;
  }
  function miniShape(type) {
    if(MODULES[type].range)return `<canvas class="weapon-thumbnail" width="176" height="96" data-weapon="${type}" role="img" aria-label="${MODULES[type].name} weapon"></canvas>`;
    return `<span class="mini-shape" style="--module-color:${MODULES[type].color}">${rotatedGeometry(type,0).cells.map(([x,y])=>`<i style="left:${x*9}px;top:${y*9}px"></i>`).join('')}</span>`;
  }
  function buyTraderItem(type) {
    if(mode!=='trade'||!tradeNode)return false;
    const item=tradeNode.stock?.find((entry)=>entry.type===type);
    if(!item||item.qty<1||save.metal<item.price)return false;
    save.metal-=item.price;item.qty--;save.inventory[type]=(save.inventory[type]||0)+1;
    movingModuleId=null;selectedCatalog=type;selectedModuleId=null;persist();log(`${MODULES[type].name} purchased at a trader.`);renderAll();toast('Purchased · choose a clear hull position to install');return true;
  }
  function renderCatalog() {
    if(mode!=='trade'||!tradeNode){$('catalog').innerHTML='';return;}
    $('marketFilters').querySelectorAll('button').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.filter===marketFilter)));
    const stock=tradeNode.stock||[],types=BUYABLE.filter((type)=>stock.some((item)=>item.type===type)||(save.inventory[type]||0)>0);
    const visible=types.filter((type)=>marketFilter==='all'||(marketFilter==='crew'?false:marketFilter==='shields'?SHIELD_TYPES.includes(type):(marketFilter==='weapons')===!!MODULES[type].range))
      .sort((a,b)=>Number(SHIELD_TYPES.includes(b))-Number(SHIELD_TYPES.includes(a)));
    $('marketSummary').textContent=`${stock.filter((item)=>item.qty>0).length} PART OFFERS · ${(tradeNode.recruits||[]).filter((person)=>!person.hired).length} CREW FOR HIRE`;
    const partCards=visible.map((type)=>{
      const def=MODULES[type],held=save.inventory[type]||0,item=stock.find((entry)=>entry.type===type);
      return `<div class="catalog-item ${selectedCatalog===type?'active':''}">${miniShape(type)}<div class="market-description"><strong>${def.name.toUpperCase()}</strong><small>${def.description}</small>${def.thrust?`<small class="weapon-fit">${footprintBadge(type)}</small><small class="weapon-spec">${def.thrust} BASE THRUST · 2 POWER AT FULL OUTPUT</small>`:''}${def.range?`<small class="weapon-fit">${footprintBadge(type)}</small><small class="weapon-spec">${def.damage} DMG × ${def.salvo||1} · ${def.reload}s · ${def.range} RANGE · ${def.arc}°${def.guidance?' LAUNCH · AUTO TRACK':''} · ${def.ammo?`${def.ammo} AMMO / TRIGGER`:'NO AMMO'}</small>`:''}<small class="weapon-rules">${def.range?weaponBehavior(type):''}</small><small>${held} IN HOLD${item?` · ${item.qty} IN STOCK`:''}</small><div class="market-actions">${item?`<button type="button" data-buy="${type}" ${item.qty<1||save.metal<item.price?'disabled':''}>${item.qty?`BUY ◆ ${item.price}`:'SOLD OUT'}</button>`:''}${held?`<button type="button" data-install="${type}" aria-pressed="${selectedCatalog===type}">${selectedCatalog===type?'CANCEL':'INSTALL HELD'}</button>`:''}</div></div></div>`;
    }).join('');
    $('catalog').innerHTML=(partCards+recruitCards())||'<p class="muted small">No offers in this category at this trader.</p>';
    $('catalog').querySelectorAll('[data-recruit]').forEach((button)=>button.addEventListener('click',()=>buyRecruit(button.dataset.recruit)));
    $('catalog').querySelectorAll('[data-buy]').forEach((button)=>button.addEventListener('click',()=>buyTraderItem(button.dataset.buy)));
    $('catalog').querySelectorAll('[data-install]').forEach((button)=>button.addEventListener('click',()=>{movingModuleId=null;selectedCatalog=selectedCatalog===button.dataset.install?null:button.dataset.install;selectedModuleId=null;renderAll();}));
    paintWeaponThumbnails($('catalog'));
    $('traderRepair').disabled=save.metal<15||hullRatio()>=.999;
  }
  function renderGrid() {
    const occupied=occupancy(),ghost=new Set(),reserved=new Map();let valid=false;
    for(const module of save.modules)for(const [rx,ry] of moduleClearance(module))reserved.set(`${rx},${ry}`,module.type);
    if(selectedCatalog&&hoverCell){const place=placementAt(selectedCatalog,hoverCell.x,hoverCell.y,buildRotation);valid=place.valid;for(const [dx,dy] of placementGeometry(selectedCatalog,buildRotation).cells)ghost.add(`${place.x+dx},${place.y+dy}`);}
    for(const [index,cell] of gridButtons.entries()){
      cell.dataset.x=buildView.x+index%GRID_W;cell.dataset.y=buildView.y+Math.floor(index/GRID_W);
      const x=+cell.dataset.x,y=+cell.dataset.y,key=`${x},${y}`,module=occupied.get(key);
      cell.className='grid-cell';cell.style.removeProperty('--module-color');cell.textContent='';
      if(module){cell.classList.add('occupied');if(module.id===selectedModuleId)cell.classList.add('selected');cell.style.setProperty('--module-color',MODULES[module.type].color);cell.setAttribute('aria-label',`${MODULES[module.type].name}, level ${module.level}, ${Math.ceil(module.hp)} health`);}
      else if(ghost.has(key)){cell.classList.add('ghost');if(!valid)cell.classList.add('invalid');cell.style.setProperty('--module-color',MODULES[selectedCatalog].color);cell.setAttribute('aria-label',`${MODULES[selectedCatalog].name} placement ${valid?'valid':'invalid'}`);}
      else if(reserved.has(key)){cell.classList.add('reserved');cell.setAttribute('aria-label',`${ENGINE_TYPES.includes(reserved.get(key))?'Engine exhaust':'Weapon mount'} clearance, keep empty`);}
      else cell.setAttribute('aria-label',`Empty cell ${x+1}, ${y+1}`);
    }
    $('placementHint').textContent=mode!=='trade'?'CLICK A ROOM TO INSPECT · VISIT A TRADER TO REFIT':selectedCatalog?(hoverCell?(valid?(movingModuleId!==null?'CLICK TO MOVE ROOM':'CLICK TO INSTALL HELD MODULE'):'ROOMS NEED OPEN HULL SPACE AND CLEAR EXHAUST'):'HOVER OVER THE GRID TO INSTALL MODULE'):'CLICK A ROOM TO INSPECT OR MOVE · INSTALL STORED PARTS';
    $('buildWeaponFacing').hidden=!selectedCatalog||MODULES[selectedCatalog].mountFacings!==2;
    $('buildWeaponFacing').textContent=`MOUNT: ${['RIGHT','DOWN','LEFT','UP'][(buildRotation+(buildWeaponFacing?3:0))%4]} ↻`;
    $('buildCoordinates').textContent=`X ${buildView.x}…${buildView.x+GRID_W-1} · Y ${buildView.y}…${buildView.y+GRID_H-1}`;
    drawHangar();
  }
  function onGridClick(x,y) {
    const existing=occupancy().get(`${x},${y}`);
    if(existing&&!selectedCatalog){selectedModuleId=existing.id;renderAll();return;}
    if(mode!=='trade'||!selectedCatalog){toast('Visit a trader to buy and install modules.');return;}
    const place=placementAt(selectedCatalog,x,y,buildRotation);
    if(!place.valid){toast('Connect rooms and keep exhaust and a weapon arc clear to space.');return;}
    if(movingModuleId!==null){
      const module=save.modules.find((part)=>part.id===movingModuleId),oldCells=new Set(moduleCells(module).map(([cx,cy])=>`${cx},${cy}`));
      const occupants=save.crew.filter((person)=>oldCells.has(`${Math.floor(person.x)},${Math.floor(person.y)}`));
      Object.assign(module,{x:place.x,y:place.y,rotation:buildRotation,weaponFacing:buildWeaponFacing});
      if(refittingFootprint)delete module.footprint;refittingFootprint=false;
      for(const person of occupants)Object.assign(person,moduleStation(module));
      for(const id of Object.keys(crewRoutes))delete crewRoutes[id];
      selectedModuleId=module.id;movingModuleId=null;selectedCatalog=null;persist();renderAll();toast('Room moved');return;
    }
    const def=MODULES[selectedCatalog];if((save.inventory[selectedCatalog]||0)<1){toast('Buy this module from a trader first.');return;}
    const module={id:save.nextId++,type:selectedCatalog,x:place.x,y:place.y,rotation:buildRotation,weaponFacing:buildWeaponFacing,hp:def.hp,level:1};
    save.modules.push(module);save.inventory[selectedCatalog]--;selectedModuleId=module.id;selectedCatalog=null;
    persist();log(`${def.name} installed from the hold.`);toast(`${def.name} installed`);renderAll();
  }
  function beginModuleMove(refit=false){
    const module=selectedModule();if(mode!=='trade'||!module)return false;
    movingModuleId=module.id;refittingFootprint=refit;selectedCatalog=module.type;buildRotation=module.rotation;buildWeaponFacing=module.weaponFacing||0;
    $('buildRotationLabel').textContent=`${buildRotation*90}°`;renderAll();return true;
  }
  function rotateBuild(step){buildRotation=(buildRotation+step+4)%4;$('buildRotationLabel').textContent=`${buildRotation*90}°`;renderGrid();}
  function renderInspector(){
    const module=selectedModule();
    if(!module){$('moduleInspector').innerHTML='<div class="empty-inspector">Click a ship room to inspect its station, firing arc, upgrade, or repair it.</div>';return;}
    const def=MODULES[module.type],maximum=maxHp(module),ratio=module.hp/maximum,upgradeCost=25*module.level+(module.type==='core'?10:0),repairCost=Math.ceil((maximum-module.hp)/10)*3;
    const direction=['RIGHT','DOWN','LEFT','UP'][(module.rotation+(MODULES[module.type].mountFacings===2&&module.weaponFacing===1?3:0))%4];
    const shieldInfo=SHIELD_TYPES.includes(module.type)?`<div class="inspector-detail">${module.type==='shield'?'FULL HULL COVERAGE':`${def.arc}° FOCUSED ARC · ${direction}`} · ${Math.round(battle?shieldState(module).charge:module.hp>0?shieldStats(module).capacity:0)} / ${shieldStats(module).capacity} STRENGTH · +${shieldStats(module).recharge.toFixed(1)}/s</div>`:null;
    const detail=shieldInfo|| (def.range?`<div class="inspector-detail">${def.guidance?'LAUNCH ARC':'FIRING ARC'} ${def.arc}°${def.guidance?' · AUTO TRACK':''} · RANGE ${weaponRange(module)} · ${direction} · ${def.ammo?`${def.ammo} AMMO / TRIGGER`:'NO AMMO'}</div>`:def.thrust?`<div class="inspector-detail">THRUST → ${direction} · <span id="engineForce">${Math.round(engineThrusters().find((engine)=>engine.module.id===module.id)?.force||0)}</span> FORCE · ${def.thrust} BASE</div><div class="weapon-fit">${footprintBadge(module.type,module.footprint)}</div>`:def.station?'<div class="inspector-detail">WALKABLE FLOOR · 1 SYSTEM STATION</div>':'<div class="inspector-detail">OPEN WALKABLE FLOOR · NO STATION</div>');
    const rangeControl=def.range?`<div class="weapon-fit">${footprintBadge(module.type,module.footprint)}</div><div class="weapon-rules">${weaponBehavior(module.type)}</div><label class="weapon-range" for="weaponRange">RANGE LIMIT <input id="weaponRange" type="number" min="30" max="${def.range}" step="1" value="${weaponRange(module)}" ${!['hangar','trade'].includes(mode)?'disabled':''}><span>MAX ${def.range}</span></label>${def.mountFacings===2?`<button id="rotateWeapon" class="outline-button full-width" type="button" ${!['hangar','trade'].includes(mode)?'disabled':''}>TURN MOUNT 90° ↻</button>`:''}`:'';
    $('moduleInspector').innerHTML=`<div class="inspector-head">${def.range?miniShape(module.type):`<span class="inspector-swatch" style="--module-color:${def.color}"></span>`}<strong>${def.name.toUpperCase()} · LV ${module.level}</strong></div><div class="inspector-sub"><span>${def.description}</span><span>${Math.ceil(module.hp)}/${maximum}</span></div>${detail}<div class="inspector-detail">${systemDemand(module)?`AUTO POWER ${systemSupply(module).toFixed(2)} · ${Math.round(systemPower(module)*100)}% PERFORMANCE`:module.type==='core'?`COMMAND POWER ${coreOutput()} · SHARED EQUALLY`:def.generation?`GENERATOR OUTPUT ${generatorOutput(module)} · SHARED EQUALLY · +1 PER UPGRADE`:'PASSIVE SYSTEM · NO POWER REQUIRED'}</div>${rangeControl}${module.footprint&&mode==='trade'?'<button id="refitFootprint" class="outline-button full-width" type="button">REFIT TO NEW FOOTPRINT · FREE</button>':''}${mode==='trade'?`<button id="moveModule" class="outline-button full-width" type="button">${movingModuleId===module.id?'CANCEL MOVE':'MOVE ROOM'}</button>`:''}<div class="meter ${ratio<.35?'low':''}"><span style="width:${Math.round(ratio*100)}%"></span></div><div class="inspector-actions"><button id="upgradeModule" type="button" ${module.level>=3||save.metal<upgradeCost||mode==='combat'?'disabled':''}>UPGRADE<br>◆ ${upgradeCost}</button><button id="repairModule" type="button" ${repairCost===0||save.metal<repairCost||mode==='combat'?'disabled':''}>REPAIR<br>◆ ${repairCost}</button></div>`;
    paintWeaponThumbnails($('moduleInspector'));
    if(module.footprint&&mode==='trade')$('refitFootprint').addEventListener('click',()=>beginModuleMove(true));
    if(mode==='trade')$('moveModule').addEventListener('click',()=>{
      if(movingModuleId===module.id){movingModuleId=null;selectedCatalog=null;renderAll();}else beginModuleMove();
    });
    if(def.range)$('weaponRange').addEventListener('change',(event)=>{
      if(!['hangar','trade'].includes(mode))return;
      const value=event.target.valueAsNumber;
      if(Number.isFinite(value))module.range=Math.round(clamp(value,30,def.range));
      persist();renderInspector();drawHangar();
    });
    if(def.mountFacings===2)$('rotateWeapon').addEventListener('click',()=>{
      if(!['hangar','trade'].includes(mode))return;
      const candidate={...module,weaponFacing:module.weaponFacing===1?0:1};
      if(!hasClearMount(candidate)||!weaponHasEscape(candidate,save.modules.flatMap(moduleCells))){toast('That mount direction needs open space outside the hull.');return;}
      module.weaponFacing=candidate.weaponFacing;persist();renderAll();
    });
    $('upgradeModule').addEventListener('click',()=>{if(module.level>=3||save.metal<upgradeCost||mode==='combat')return;save.metal-=upgradeCost;module.level++;module.hp+=25;persist();log(`${def.name} upgraded to level ${module.level}.`);toast(`${def.name} upgraded`);renderAll();});
    $('repairModule').addEventListener('click',()=>{if(repairCost===0||save.metal<repairCost||mode==='combat')return;save.metal-=repairCost;module.hp=maximum;persist();log(`${def.name} repaired.`);toast(`${def.name} repaired`);renderAll();});
  }
  function renderCrew(){
    $('crewList').innerHTML=save.crew.map((person)=>{
      const template=crewAppearance(person),route=crewRoutes[person.id],moving=route?.path?.length&&distance(person,route.path[0])>.08;
      return `<div class="crew-card"><div class="crew-top"><span class="crew-avatar" style="--crew-color:${template.color}">${template.initial}</span><strong>${template.name}</strong><small>${moving?'WALKING':'AT STATION'}</small></div><select data-crew="${person.id}" aria-label="${template.name} assignment">${Object.entries(TASKS).map(([value,label])=>`<option value="${value}" ${person.task===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
    }).join('');
    $('crewList').querySelectorAll('select').forEach((select)=>select.addEventListener('change',()=>{
      const person=save.crew.find((member)=>member.id===select.dataset.crew);person.task=select.value;delete crewRoutes[person.id];
      persist();log(`${crewAppearance(person).name} assigned to ${TASKS[person.task].toLowerCase()}.`);renderCrew();
    }));
  }

  function renderHud(){
    renderSystems();
    $('sectorDisplay').textContent=String(save.sector).padStart(2,'0');$('metalDisplay').textContent=save.metal;$('hullDisplay').textContent=`${Math.round(hullRatio()*100)}%`;
    $('jumpButton').disabled=mode==='combat'||eventOpen;
    $('jumpButton').textContent=mode==='combat'?'IN COMBAT':mode==='map'?'RETURN TO SHIP':'OPEN SECTOR MAP ↗';
    $('revisitTrader').hidden=mode!=='hangar'||currentMapNode()?.type!=='trader';
    const cells=save.modules.reduce((sum,module)=>sum+moduleCells(module).length,0),weapons=activeModules(...WEAPON_TYPES).length;
    $('shipStats').innerHTML=`<div class="stat-card"><span>HULL INTEGRITY</span><strong class="${hullRatio()<.35?'bad':'good'}">${Math.round(hullRatio()*100)}%</strong></div><div class="stat-card"><span>MODULES</span><strong>${save.modules.length} <small style="font-size:9px;color:var(--muted)">/ ${cells} CELLS</small></strong></div><div class="stat-card"><span>WEAPONS</span><strong class="${weapons?'good':'bad'}">${weapons} ACTIVE</strong></div><div class="stat-card"><span>AMMUNITION</span><strong class="${mode==='combat'&&battle&&battle.ammo<=2?'warn':''}">${battle?Math.floor(battle.ammo)+' / '+battle.maxAmmo:save.ammoCrates?`READY +${save.ammoCrates*6}`:'READY'}</strong></div>`;
    const shields=save.modules.filter((module)=>SHIELD_TYPES.includes(module.type));
    if(shields.length){const maximum=shields.reduce((sum,module)=>sum+shieldStats(module).capacity,0),strength=shields.reduce((sum,module)=>sum+(battle?shieldState(module).charge:module.hp>0?shieldStats(module).capacity:0),0);$('shipStats').innerHTML+=`<div class="stat-card"><span>SHIELD STRENGTH</span><strong>${Math.round(strength)} / ${maximum}</strong></div>`;}
    $('leftStatus').textContent=mode==='combat'?`ENGAGED // ${battle?.enemies.filter(enemyAlive).length||0} HOSTILES`:mode==='map'?`CHARTED // SECTOR ${String(save.sector).padStart(2,'0')}`:activeModules(...ENGINE_TYPES).length?'DOCKED // SYSTEMS READY':'DOCKED // ENGINE OFFLINE';
    $('footerStatus').textContent=mode==='combat'?'THRUSTERS ACTIVE ONLY ON DEMAND':mode==='map'?'CHOOSE YOUR NEXT JUMP':'A LONG WAY FROM HOME';
    if(battle){
      const p=battle.player,heading=((Math.round(p.angle*180/Math.PI)%360)+360)%360;
      const firing=Object.values(p.thrusters).filter((throttle)=>throttle>.08).length;
      $('flightTelemetry').innerHTML=`HEADING ${heading}°<br>SPEED ${Math.round(Math.hypot(p.vx,p.vy))} · ${firing} THRUSTER${firing===1?'':'S'} FIRING`;
      $('enemyCountLabel').textContent=`${battle.enemies.filter(enemyAlive).length} HOSTILE${battle.enemies.filter(enemyAlive).length===1?'':'S'}`;
    }
  }
  function renderAll(){renderCatalog();renderGrid();renderInspector();renderCrew();renderHud();if(mode==='map')renderMap();}

  let arcCache=null;
  function drawWeaponArc(g,module,tile,color,modules=save.modules) {
    const key=JSON.stringify([module.type,module.x,module.y,module.rotation,module.weaponFacing,module.footprint,weaponRange(module),modules.map(({type,x,y,rotation,footprint})=>[type,x,y,rotation,footprint])]);
    if(arcCache?.key!==key){
      const cells=MODULES[module.type].hullPass?[]:modules.flatMap(moduleCells),mount=weaponGeometry(module),limit=weaponRange(module)/COMBAT_TILE;
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
    const template=crewAppearance(person),x=Math.round(person.x*size),y=Math.round(person.y*size);
    g.fillStyle='#091421';g.fillRect(x-5,y-7,10,13);
    g.fillStyle='#53677c';g.fillRect(x-4,y-6,8,4);
    g.fillStyle=template.color;g.fillRect(x-3,y-6,6,3);g.fillRect(x-4,y-2,8,6);
    g.fillStyle='#f2fbec';g.fillRect(x-2,y-5,4,1);
    g.fillStyle='#294358';g.fillRect(x-2,y,2,3);g.fillRect(x+1,y,2,3);
    g.fillStyle='#101b2b';g.fillRect(x-4,y+4,3,3);g.fillRect(x+1,y+4,3,3);
    g.fillStyle='#fff1c6';g.fillRect(x+4,y,1,2);
  }
  function drawStation(g,module,throttle=0){
    const def=MODULES[module.type],geom=moduleGeometry(module),station=geom.station;
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
      if(module.type==='focusShield'){
        g.fillStyle='#397f82';g.fillRect(px+8,py+7,8,10);
        g.fillStyle='#b0fff1';g.fillRect(px+9,py+9,6,2);g.fillRect(px+11,py+11,2,5);
        g.fillStyle='#5accc1';g.fillRect(px+3,py+10,2,4);g.fillRect(px+19,py+10,2,4);
        g.save();g.translate(px+12,py+12);g.rotate(module.rotation*Math.PI/2);
        g.fillStyle='#e5fff4';g.fillRect(5,-1,4,2);g.fillRect(7,-3,2,6);g.restore();
      }
      if(def.generation){
        g.fillStyle='#514c3f';g.fillRect(px+6,py+6,12,12);
        g.fillStyle='#c4a566';g.fillRect(px+8,py+7,8,10);
        g.fillStyle=module.hp>0?'#ffe7a0':'#665c49';g.fillRect(px+11,py+8,2,8);g.fillRect(px+8,py+11,8,2);
        g.fillStyle='#847d69';g.fillRect(px+3,py+8,2,8);g.fillRect(px+19,py+8,2,8);
      }
      if(module.type==='cargo'){
        g.fillStyle='#865e42';g.fillRect(px+7,py+7,10,10);
        g.fillStyle='#e9ca83';g.fillRect(px+8,py+8,8,2);g.fillRect(px+11,py+8,2,8);
        g.fillStyle='#543d35';g.fillRect(px+8,py+13,2,2);g.fillRect(px+14,py+13,2,2);
      }
      if(ENGINE_TYPES.includes(module.type)){
        g.fillStyle='#0d2731';g.fillRect(px+7,py+7,10,10);
        g.fillStyle='#71c9a6';g.fillRect(px+8,py+8,8,4);
        g.fillStyle='#e6fff0';g.fillRect(px+9,py+9,3,1);
        g.fillStyle='#345b65';g.fillRect(px+8,py+14,2,2);g.fillRect(px+12,py+14,4,2);
      }
      if(def.range){
        g.fillStyle='#15283a';g.fillRect(px+7,py+7,10,9);
        g.fillStyle='#b85d51';g.fillRect(px+8,py+8,8,4);
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
        g.fillStyle='#303737';
        if(side==='left'||side==='right'){
          const sx=side==='left'?px-8:px+24;g.fillRect(sx,py,8,24);
          g.fillStyle='#777e77';g.fillRect(sx+(side==='left'?2:0),py+2,6,20);
          g.fillStyle='#bcc0ae';g.fillRect(sx+(side==='left'?6:0),py+4,2,16);
          g.fillStyle='#dedfce';g.fillRect(sx+3,py+5,2,2);g.fillRect(sx+3,py+17,2,2);
          g.fillStyle='#555e59';g.fillRect(sx+1,py+11,6,2);
        }else{
          const sy=side==='top'?py-8:py+24;g.fillRect(px,sy,24,8);
          g.fillStyle='#777e77';g.fillRect(px+2,sy+(side==='top'?2:0),20,6);
          g.fillStyle='#bcc0ae';g.fillRect(px+4,sy+(side==='top'?6:0),16,2);
          g.fillStyle='#dedfce';g.fillRect(px+5,sy+3,2,2);g.fillRect(px+17,sy+3,2,2);
          g.fillStyle='#555e59';g.fillRect(px+11,sy+1,2,6);
        }
      }
    }
  }
  function drawExteriorHardware(g,module,throttle=0){
    if(ENGINE_TYPES.includes(module.type)){
      const station=moduleGeometry(module).station;
      const cx=(module.x+station[0]+.5)*TILE,cy=(module.y+station[1]+.5)*TILE;
      g.save();g.translate(cx,cy);g.rotate(module.rotation*Math.PI/2);
      const half=module.type==='smallEngine'?8:module.type==='heavyEngine'?24:13;
      const offsets=module.type==='smallEngine'?[0]:module.type==='heavyEngine'?[-18,0,18]:[-7,7];
      g.fillStyle='#303638';g.fillRect(-23,-half,12,half*2);
      g.fillStyle='#7c8682';g.fillRect(-21,1-half,8,half*2-2);
      g.fillStyle='#cbd1c1';g.fillRect(-20,3-half,2,half*2-6);
      for(const offset of offsets){
        g.fillStyle='#424b49';g.fillRect(-28,offset-5,12,10);
        g.fillStyle='#aab7ae';g.fillRect(-27,offset-4,4,8);
        g.fillStyle='#44b9ce';g.fillRect(-31,offset-4,5,8);
        g.fillStyle='#b6f5ee';g.fillRect(-31,offset-2,2,4);
        if(throttle>.08){const length=5+Math.round(throttle*13);g.fillStyle='#3ad8ed';g.fillRect(-29-length,offset-3,length,6);g.fillStyle='#fff0ae';g.fillRect(-29-length,offset-1,Math.max(3,length-3),2);}
      }
      g.restore();
    }
    if(MODULES[module.type].muzzle){
      const mount=weaponGeometry(module);
      g.save();g.translate(mount.x*TILE,mount.y*TILE);g.rotate(mount.direction);
      drawWeaponSprite(g,module.type,module.hp>0,module.hp>0?(module.flash||0):0);g.restore();
    }
  }
  function drawWeaponSprite(g,type,active=true,flash=0){
    const ink='#242a2b',dark='#4b5354',steel='#929c98',light='#d3d6c8',red=active?'#ad4944':'#65524e',bright='#d27665';
    const r=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
    const body=(x,y,w,h)=>{r(x,y,w,h,ink);r(x+1,y+1,w-2,h-2,dark);r(x+1,y+1,w-2,1,light);};
    const barrel=(x,y,length,width=3)=>{r(x,y-.5,length,width+1,ink);r(x,y,length-1,width,steel);r(x,y,length-2,.75,light);};
    r(-9,-4,5,8,ink);r(-8,-3,3,6,steel);r(-7,-2,1,1,light);r(-7,1,1,1,light);
    g.save();g.translate(flash>0?-1:0,0);
    switch(type){
      case 'weapon':
        body(-6,-5,15,10);r(-4,-3,10,6,red);r(-4,-3,10,1,bright);barrel(8,-1.5,18,3);r(23,-3,4,6,dark);r(25,-1,2,2,ink);break;
      case 'autocannon':
        body(-6,-3,14,7);r(-3,-7,7,5,red);r(-3,-7,7,1,light);barrel(6,-1,23,2);r(18,-2,2,5,dark);r(-1,3,5,2,steel);break;
      case 'gatling':
        body(-6,-6,13,12);r(-4,-4,8,8,red);for(const y of [-4,-1,2])barrel(5,y,23,1.5);r(18,-6,3,12,dark);r(19,-6,1,12,light);r(26,-5,3,10,steel);break;
      case 'flak':
        body(-7,-7,17,14);r(-5,-5,6,10,red);r(3,-8,5,16,dark);for(const y of [-5,1]){barrel(9,y,12,4);r(18,y,4,4,ink);}r(0,-9,3,3,steel);r(0,6,3,3,steel);break;
      case 'scattergun':
        body(-6,-4,14,8);r(-4,-3,7,6,red);barrel(5,-3,14,6);r(18,-5,7,10,dark);r(20,-4,4,8,steel);r(23,-3,2,6,ink);r(4,4,3,2,steel);break;
      case 'plasma':
        body(-6,-6,14,12);r(-4,-4,8,8,red);body(6,-8,13,16);r(8,-6,9,12,'#7b7496');r(9,-5,7,2,'#c5b0df');r(11,-7,2,14,steel);r(19,-4,7,8,dark);r(23,-2,4,4,'#b9a2e8');break;
      case 'ion':
        body(-6,-5,16,10);r(-4,-3,5,6,red);r(2,-3,6,6,'#81adac');for(const y of [-6,4]){barrel(9,y,16,2);r(21,y-.5,4,3,light);}r(16,-2,3,4,'#91dae4');break;
      case 'laser':
        body(-6,-4,14,8);r(-4,-2,8,4,red);for(const y of [-3,1])barrel(7,y,18,2);r(22,-4,5,8,dark);r(25,-2,2,4,'#e5a9a0');break;
      case 'heavyLaser':
        body(-6,-6,18,12);r(-4,-4,11,8,red);r(1,-4,2,8,bright);barrel(11,-2,18,4);r(16,-4,3,8,dark);r(27,-3,4,6,steel);r(29,-2,2,4,'#f2b0ac');break;
      case 'missile':
        // An armored pod with three recessed rocket mouths and loaded warheads.
        body(-7,-9,27,18);r(-5,-7,7,14,red);r(-5,-7,7,1,bright);r(2,-8,18,16,steel);r(3,-7,16,14,dark);
        for(const y of [-6,-1,4]){r(4,y-1,17,4,ink);r(5,y,12,2,steel);r(15,y,5,2,'#d9d8bf');r(19,y+.5,3,1,light);r(8,y,3,2,red);}r(-1,-10,3,2,steel);break;
      case 'swarm':
        body(-7,-10,21,20);r(-5,-8,6,16,red);
        for(const [x,y] of [[1,-7],[7,-2],[1,3],[7,6]]){r(x,y-1,18,4,ink);r(x+1,y,14,2,steel);r(x+12,y,4,2,light);r(x+5,y,3,2,red);}break;
      case 'torpedo':
        body(-7,-6,29,12);r(-5,-4,7,8,red);r(3,-4,16,8,steel);r(5,-4,13,1,light);r(18,-3,7,6,'#d4c9aa');r(25,-2,3,4,light);r(28,-1,2,2,light);r(9,-8,4,3,red);r(9,5,4,3,red);break;
      case 'siege':
        body(-8,-8,20,16);r(-6,-6,12,12,red);r(-6,-6,12,1,bright);barrel(10,-3,17,6);body(22,-6,9,12);r(25,-4,2,8,steel);r(28,-4,2,2,ink);r(28,2,2,2,ink);break;
      case 'disruptor':
        body(-6,-5,17,10);r(-4,-3,8,6,red);r(11,-2,10,4,steel);r(19,-8,4,16,dark);for(const y of [-7,-1,5]){r(22,y,5,2,steel);r(26,y,2,2,'#bad68d');}break;
      case 'tesla':
        body(-6,-5,14,10);r(-4,-3,8,6,red);barrel(6,-1,13,2);for(const y of [-8,-3,2,7]){r(10,y,10,1.5,steel);r(12,y,2,1.5,red);}r(18,-9,3,18,dark);r(21,-7,4,3,'#c2bef0');r(21,4,4,3,'#c2bef0');break;
      case 'cryo':
        body(-7,-6,14,12);for(const y of [-7,2]){body(-4,y,9,5);r(-2,y+1,5,2,'#89b6bf');}barrel(6,-2,16,4);r(12,-4,3,8,steel);r(21,-5,6,10,dark);r(25,-3,3,6,'#bae0df');r(7,-3,3,6,red);break;
      case 'inferno':
        body(-6,-6,14,12);r(-4,-4,9,8,red);r(-3,-8,6,3,steel);r(-3,5,6,3,dark);barrel(6,-2,14,4);r(11,-4,2,8,red);r(19,-4,8,8,dark);r(23,-3,4,6,steel);r(27,-1,2,2,'#e9a46d');r(16,4,8,1,red);break;
      case 'proton':
        body(-6,-4,12,8);r(-4,-3,7,6,red);barrel(5,-1,26,2);for(const x of [8,15,22]){r(x,-4,2,8,dark);r(x,-3,1,6,'#d6ca8b');}r(29,-3,3,6,steel);r(31,-1,1,2,'#e2d889');break;
      case 'gauss':
        body(-7,-6,14,12);r(-5,-4,9,8,red);for(const [y,length] of [[-4,21],[2,25]]){barrel(6,y,length,2);r(11,y-1,4,4,dark);r(12,y,2,2,red);r(6+length-2,y-.5,2,3,light);}break;
      case 'railgun':
        body(-6,-5,12,10);r(-4,-3,8,6,red);for(const y of [-4,2])barrel(4,y,27,2);r(9,-2,17,4,ink);for(const x of [8,18]){r(x,-5,3,2,red);r(x,3,3,2,red);}r(29,-3,2,6,light);break;
    }
    if(flash>0){r(29,-1.5,4,3,'#fff0bc');r(33,-.5,2,1,'#e5a65e');}
    g.restore();
  }
  function paintWeaponThumbnails(root){
    root.querySelectorAll('canvas[data-weapon]').forEach((thumbnail)=>{
      const g=thumbnail.getContext('2d');g.setTransform(SPRITE_SCALE,0,0,SPRITE_SCALE,0,0);
      g.clearRect(0,0,44,24);g.translate(10,12);drawWeaponSprite(g,thumbnail.dataset.weapon);
    });
  }
  function drawInterior(g,showSelection=false,thrusters={},view=shipArtFrame()){
    g.imageSmoothingEnabled=false;g.setTransform(view.scale,0,0,view.scale,-view.x*TILE*view.scale,-view.y*TILE*view.scale);
    g.clearRect(view.x*TILE,view.y*TILE,view.w*TILE,view.h*TILE);
    const occupied=occupancy();
    drawHullShell(g,occupied);
    if(showSelection){
      const selected=selectedModule();
      if(selected&&MODULES[selected.type].muzzle&&!selectedCatalog){
        drawWeaponArc(g,selected,TILE,'rgba(248,183,103,.23)');
      }
    }
    for(const module of save.modules){
      const def=MODULES[module.type];
      for(const [x,y] of moduleCells(module)){
        const px=x*TILE,py=y*TILE;
        g.fillStyle='#303735';g.fillRect(px,py,TILE,TILE);
        g.fillStyle=module.hp>0?'#72786b':'#343b43';g.fillRect(px+2,py+2,20,20);
        g.fillStyle=module.hp>0?'#9b9c86':'#4a4c50';g.fillRect(px+3,py+3,18,18);
        g.fillStyle='#898f7c';g.fillRect(px+5,py+5,14,14);
        g.fillStyle='#b4b5a0';g.fillRect(px+6,py+6,12,1);g.fillRect(px+6,py+17,12,1);
        g.fillStyle='#747d6e';g.fillRect(px+11.5,py+6,.5,11);
        g.fillStyle='#a8ae98';g.fillRect(px+6,py+11.5,11,.5);
        g.fillStyle='#c2c5ae';g.fillRect(px+6.5,py+7,.5,2);g.fillRect(px+16.5,py+15,.5,2);
        g.fillStyle=def.color;g.fillRect(px+3,py+3,4,1);g.fillRect(px+17,py+20,4,1);
        g.fillStyle='#c9cdbc';g.fillRect(px+3,py+3,1,1);g.fillRect(px+20,py+20,1,1);
        if(module.type==='armor'){
          g.fillStyle='#718898';g.fillRect(px+6,py+6,12,11);g.fillStyle='#a8bcc8';g.fillRect(px+7,py+6,10,2);
          g.fillStyle='#465f70';g.fillRect(px+8,py+10,8,5);g.fillStyle='#d7e5e5';g.fillRect(px+8,py+9,2,1);g.fillRect(px+15,py+14,2,1);
        }
        const edges=[[-1,0,'left'],[1,0,'right'],[0,-1,'top'],[0,1,'bottom']];
        for(const [dx,dy,side] of edges){
          const neighbor=occupied.get(`${x+dx},${y+dy}`);
          if(neighbor?.id===module.id)continue;
          const outer=!neighbor,metal=outer?'#c0c5b6':'#969f90';
          g.fillStyle='#343d38';
          if(side==='left'||side==='right'){
            const sx=side==='left'?px:px+21;g.fillRect(sx,py,3,24);
            g.fillStyle=metal;g.fillRect(sx,py+2,1,outer?20:7);if(!outer)g.fillRect(sx,py+15,1,7);
            g.fillStyle='#d4d6c6';g.fillRect(sx+1,py+3,1,2);g.fillRect(sx+1,py+19,1,2);
          }else{
            const sy=side==='top'?py:py+21;g.fillRect(px,sy,24,3);
            g.fillStyle=metal;g.fillRect(px+2,sy,outer?20:7,1);if(!outer)g.fillRect(px+15,sy,7,1);
            g.fillStyle='#d4d6c6';g.fillRect(px+3,sy+1,2,1);g.fillRect(px+19,sy+1,2,1);
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
  function placementPreview(){
    if(mode!=='trade'||!selectedCatalog||!hoverCell)return null;
    const place=placementAt(selectedCatalog,hoverCell.x,hoverCell.y,buildRotation);
    const original=save.modules.find((module)=>module.id===movingModuleId);
    return {valid:place.valid,module:{level:1,hp:MODULES[selectedCatalog].hp,...original,footprint:refittingFootprint?null:original?.footprint,type:selectedCatalog,x:place.x,y:place.y,rotation:buildRotation,weaponFacing:buildWeaponFacing}};
  }
  function drawHangar(){
    drawInterior(hangarCtx,true,{},{x:buildView.x,y:buildView.y,w:GRID_W,h:GRID_H,scale:SPRITE_SCALE});
    const preview=placementPreview();if(!preview)return;
    const g=hangarCtx,module=preview.module,color=preview.valid?'rgba(111,235,196,.22)':'rgba(255,101,111,.25)';
    if(MODULES[module.type].range)drawWeaponArc(g,module,TILE,color,[...save.modules.filter((part)=>part.id!==movingModuleId),module]);
    g.globalAlpha=.7;
    for(const [x,y] of moduleCells(module)){g.fillStyle=preview.valid?'#81e4bb':'#ed7783';g.fillRect(x*TILE+1,y*TILE+1,TILE-2,TILE-2);}
    g.globalAlpha=1;drawStation(g,module);drawExteriorHardware(g,module);
    if(MODULES[module.type].range){
      const mount=weaponGeometry(module);g.fillStyle='#fff2bd';g.fillRect(mount.x*TILE-2,mount.y*TILE-2,4,4);
    }
  }

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
    if(person.task==='pilot')return {module:core,point:moduleStation(core)};
    if(person.task==='engine'){
      const engines=save.modules.filter((module)=>ENGINE_TYPES.includes(module.type)&&module.hp>0);
      const module=engines.reduce((best,candidate)=>!best||distance(person,moduleStation(candidate))<distance(person,moduleStation(best))?candidate:best,null)||core;
      return {module,point:moduleStation(module)};
    }
    if(person.task==='gun'){
      const weapons=save.modules.filter((module)=>WEAPON_TYPES.includes(module.type)&&module.hp>0);
      if(!weapons.length)return {module:core,point:moduleStation(core)};
      const module=weapons.reduce((best,candidate)=>distance(person,moduleStation(candidate))<distance(person,moduleStation(best))?candidate:best,weapons[0]);
      return {module,point:moduleStation(module)};
    }
    if(person.task==='shield'){
      const shields=save.modules.filter((module)=>SHIELD_TYPES.includes(module.type)&&module.hp>0);
      if(!shields.length)return {module:core,point:moduleStation(core)};
      const module=shields.reduce((best,candidate)=>distance(person,moduleStation(candidate))<distance(person,moduleStation(best))?candidate:best,shields[0]);
      return {module,point:moduleStation(module)};
    }
    if(person.task==='repair'){
      const damaged=save.modules.filter((module)=>module.hp>0&&module.hp<maxHp(module)).sort((a,b)=>a.hp/maxHp(a)-b.hp/maxHp(b));
      const module=damaged[0]||core;return {module,point:moduleStation(module)};
    }
    if(person.task==='load'&&battle){
      const pickup=activeModules('cargo')[0]||core,weapon=activeModules(...WEAPON_TYPES).find((module)=>MODULES[module.type].ammo>0);
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
    if(next!=='trade'){selectedCatalog=null;movingModuleId=null;tradeNode=null;}
    const shipView=next==='hangar'||next==='trade';
    $('hangarScreen').hidden=!shipView;$('combatScreen').hidden=next!=='combat';$('mapScreen').hidden=next!=='map';
    $('hangarTools').hidden=next!=='hangar';$('traderTools').hidden=next!=='trade';$('combatTools').hidden=next!=='combat';$('mapTools').hidden=next!=='map';
    $('leftTitle').textContent=next==='trade'?'TRADER MARKET':next==='hangar'?'SHIP COMMAND':next==='combat'?'TACTICAL CONTROL':'NAVIGATION';
    $('stageEyebrow').textContent=next==='trade'?'WAYFARER // DOCKSIDE REFIT':next==='hangar'?'HANGAR // SYSTEMS ONLINE':next==='combat'?'LIVE ENCOUNTER // COMBAT':'NAVIGATION // ROUTE CHART';
    $('stageTitle').textContent=next==='trade'?'TRADE & REFIT':next==='hangar'?'YOUR STARSHIP':next==='combat'?(battle?.kind==='rescue'?'FREIGHTER DEFENSE':'PIRATE INTERCEPT'):'CHOOSE YOUR COURSE';
    $('stageTag').textContent=shipView?'UNBOUNDED HULL':next==='combat'?`${battle?.enemies.length||0} HOSTILES`:`SECTOR ${String(save.sector).padStart(2,'0')}`;
    renderHud();if(next==='map')renderMap();if(shipView){renderGrid();drawHangar();}if(next==='combat')fitArenaCanvas();
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
      return `<button type="button" class="map-node ${cls} type-${node.type}" data-node="${node.id}" style="left:${(node.mapX??80+node.col*168)/10}%;top:${(node.mapY??110+node.row*190)/6}%" ${!isAvailable||!activeModules(...ENGINE_TYPES).length?'disabled':''} aria-label="Sector ${String(save.sector).padStart(2,'0')} ${info.name}${visited?', visited':''}${isAvailable?', available next':''}"><span>${info.icon}</span><strong>${info.name}</strong><small>${isCurrent?'YOU ARE HERE':visited?'VISITED':`BEACON ${node.col}${node.row+1}`}</small></button>`;
    }).join('');
    container.querySelectorAll('.map-node.available').forEach((button)=>button.addEventListener('click',()=>openMapEvent(button.dataset.node)));
    $('nextSectorButton').hidden=current.type!=='exit';
    $('mapHint').textContent=activeModules(...ENGINE_TYPES).length?(innerWidth<=720?'TAP CONNECTED BEACONS · SWIPE TO PAN':'EXPLORE AND REVISIT CONNECTED BEACONS'):'ENGINE OFFLINE · REPAIR IN SHIPYARD';
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
    if(currentMapNode()?.type!=='exit'||!activeModules(...ENGINE_TYPES).length)return;
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
  function awardCrew(name,color){
    const core=commandCore(),point=moduleStation(core);
    save.nextCrewId??=1;
    let id;do{id=`crew-${save.nextCrewId++}`;}while(save.crew.some((person)=>person.id===id));
    let displayName=name,suffix=2;
    while(save.crew.some((person)=>person.name===displayName))displayName=`${name} ${suffix++}`;
    save.crew.push({id,name:displayName,initial:name[0],color,task:'idle',...point});
    log(`${displayName} joined the crew.`);
    return displayName;
  }
  function awardWeapon(type){
    save.inventory[type]=(save.inventory[type]||0)+1;
    log(`${MODULES[type].name} recovered and stored in the hold.`);
    return MODULES[type].name;
  }
  function upgradeTraderStock(node){
    node.stock??=traderStock();
    for(const type of [...SHIELD_TYPES,...ENGINE_TYPES,'generator'])if(!node.stock.some((item)=>item.type===type))node.stock.push({type,qty:1,price:MODULES[type].cost});
    if(!Array.isArray(node.recruits))node.recruits=traderRecruits();
    node.stockVersion=6;
  }

  function openTrader(node){
    upgradeTraderStock(node);persist();hideEvent();setMode('trade');tradeNode=node;marketFilter='all';renderAll();
  }
  function openOutpost(node){
    const choices=[];
    if(save.passengers>0)choices.push({label:`DELIVER ${save.passengers} SURVIVOR${save.passengers===1?'':'S'} · +${save.passengers*20} METAL`,action:()=>{
      const count=save.passengers,reward=count*20;save.passengers=0;save.metal+=reward;
      log(`${count} survivors brought safely to the outpost; ${reward} metal paid for the rescue.`);persist();renderAll();openOutpost(node);
    }});
    choices.push({label:'DOCK FOR REPAIRS · ◆ 12',disabled:save.metal<12||hullRatio()>=.999,action:()=>{
      save.metal-=12;repairAll(40);log('Outpost crew patched damaged rooms.');persist();renderAll();openOutpost(node);
    }});
    choices.push({label:'LEAVE OUTPOST →',action:()=>{hideEvent();openMap();}});
    showEvent({type:'CIVILIAN SIGNAL // OUTPOST',icon:'⌂',title:'FRINGE OUTPOST',
      body:save.passengers?`The station has room for ${save.passengers} survivors aboard your ship. Its technicians also offer hull repairs.`:'The technicians can repair damaged rooms here. Return any time you need their help.',choices});
  }
  function chartShortcut(node){
    const candidates=save.map.nodes.filter((target)=>target.id!==node.id&&!node.links.includes(target.id)&&Math.abs(target.col-node.col)>=2);
    candidates.sort((a,b)=>Math.abs(b.col-node.col)-Math.abs(a.col-node.col)||Math.abs(a.row-node.row)-Math.abs(b.row-node.row));
    const target=candidates[0];if(!target)return null;
    node.links.push(target.id);target.links.push(node.id);return target;
  }
  function eventScene(node,title,body,choices){const info=EVENT_TYPES[node.type];showEvent({type:`BEACON // ${info.name}`,icon:info.icon,title,body,choices});}
  function openMapEvent(id){
    if(!availableNodes().includes(id))return;
    if(!activeModules(...ENGINE_TYPES).length){toast('Power and repair an engine before jumping.');return;}
    pendingNodeId=id;const node=save.map.nodes.find((item)=>item.id===id);
    const firstVisit=!save.map.resolved.includes(id);
    if(!firstVisit||['trader','outpost','exit'].includes(node.type)){
      advanceRoute();renderAll();
      if(node.type==='trader'){openTrader(node);return;}
      if(node.type==='outpost'){openOutpost(node);return;}
      if(node.type==='exit'){toast('Exit reached · choose NEXT SECTOR or keep exploring');return;}
      toast(`${EVENT_TYPES[node.type]?.name||'BEACON'} revisited`);return;
    }
    const variant=(node.variant||0)%3;
    if(node.type==='pirate'){
      if(variant===0)eventScene(node,'RAIDER TOLL','A pirate corvette blocks the lane and demands metal before it will move.',[
        {label:'FIGHT THROUGH →',action:()=>startBattle('pirate')},
        {label:'PAY THE TOLL · −18 METAL',disabled:save.metal<18,action:()=>{save.metal-=18;log('Paid a raider toll.');concludeEvent('LANE CLEARED','The corvette takes its payment and lets your ship pass.','⚔');}}
      ]);
      if(variant===1)eventScene(node,'WRECK PICKERS','Pirates are cutting apart a disabled tug. Their guns turn toward your ship as you approach.',[
        {label:'DRIVE THEM OFF →',action:()=>startBattle('pirate')},
        {label:'DRIFT PAST THE WRECK',action:()=>concludeEvent('CONTACT AVOIDED','Your crew keeps the ship dark until the tug is safely behind you.','⚔')}
      ]);
      if(variant===2)eventScene(node,'PIRATE BOARDING LINE','A raider sends grappling drones toward a nearby convoy. You can intervene or broadcast a costly decoy signal.',[
        {label:'INTERCEPT THE RAIDER →',action:()=>startBattle('pirate')},
        {label:'LAUNCH DECOY TRANSMITTERS · −10 METAL',disabled:save.metal<10,action:()=>{save.metal-=10;log('Decoys drew the raider away from the convoy.');concludeEvent('CONVOY ESCAPES','The pirate follows false engine signatures while the convoy jumps clear.','◇');}}
      ]);
      return;
    }
    if(node.type==='rescue'){
      if(variant===0)eventScene(node,'FREIGHTER UNDER FIRE','Two skiffs have pinned a cargo ship against the edge of a wreck field. Its captain asks for cover.',[
        {label:'DEFEND THE FREIGHTER →',action:()=>startBattle('rescue')},
        {label:'LAUNCH DECOYS · −12 METAL',disabled:save.metal<12,action:()=>{save.metal+=8;log('The freighter paid 20 metal after your 12-metal decoy launch.');concludeEvent('FREIGHTER ESCAPES','Your decoys cost 12 metal. The captain transfers 20 metal once clear of the skiffs.','◇');}},
        {label:'LEAVE THE CHANNEL',action:()=>concludeEvent('DISTRESS LEFT BEHIND','You mark the channel and continue without engaging.','◇')}
      ]);
      if(variant===1)eventScene(node,'DISABLED ORE HAULER','A hauler has lost its drive. Its mechanic offers to join your crew if you tow the vessel clear; the load will strain an engine.',[
        {label:'TOW TO SAFETY · +CREW, ENGINE −12 HP',action:()=>{const engine=activeModules(...ENGINE_TYPES)[0];if(engine)engine.hp=Math.max(1,engine.hp-12);const recruit=awardCrew('TAMSIN','#91d6b5');concludeEvent('HAULER DELIVERED',`${recruit} joins your crew after the tow. The heavy load strains one engine for 12 damage. Assign a job in the crew panel.`,'◇');}},
        {label:'TRANSFER REPAIR METAL · NET +12',disabled:save.metal<10,action:()=>{save.metal+=12;log('Hauler owner paid 22 metal for 10 metal of repairs.');concludeEvent('DRIVE RESTARTED','Your crew uses 10 metal to patch the drive; the owner pays 22 for the help.','◇');}},
        {label:'CONTINUE ON YOUR ROUTE',action:()=>concludeEvent('HAULER MARKED','You send its coordinates to the nearest outpost.','◇')}
      ]);
      if(variant===2)eventScene(node,'CONVOY REARGUARD','A small ore convoy needs time to reach a jump beacon. Pirate skiffs are gaining on its last ship.',[
        {label:'HOLD OFF THE SKIFFS →',action:()=>startBattle('rescue')},
        {label:'COVER WITH AMMO DECOYS · −8 METAL',disabled:save.metal<8,action:()=>{save.metal-=8;save.ammoCrates++;log('Convoy escaped and left a munitions crate.');concludeEvent('CONVOY CLEAR','Your decoys cost 8 metal. The grateful crew leaves a sealed ammo crate for your next battle.','◇');}},
        {label:'STAY OUT OF THE FIGHT',action:()=>concludeEvent('CONVOY SIGNAL LOST','The convoy disappears from your scope.','◇')}
      ]);
      return;
    }
    if(node.type==='salvage'){
      if(variant===0)eventScene(node,'LOOSE ALLOY PALLETS','A broken freight rack has scattered clean alloy plates. The outer pallets are easy to collect.',[
        {label:'COLLECT OUTER PALLETS · +18 METAL',action:()=>{save.metal+=18;log('18 metal collected from loose pallets.');concludeEvent('ALLOY SECURED','The crew hauls the accessible plates aboard.','✧');}},
        {label:'CUT OPEN THE INNER RACK · +30 METAL',action:()=>{save.metal+=30;const target=damageRandomModule(12);log('Inner rack yielded 30 metal but struck a room.');concludeEvent('RACK OPENED',`You gain 30 metal; tumbling cargo damages your ${MODULES[target.type].name.toLowerCase()} by 12.`,'✧');}}
      ]);
      if(variant===1)eventScene(node,'SEALED MUNITIONS POD','A military supply pod still has an intact ammunition seal. Its metal casing can also be recycled.',[
        {label:'KEEP THE AMMUNITION · +1 CRATE',action:()=>{save.ammoCrates++;log('One ammo crate stored for the next battle.');concludeEvent('AMMO STORED','The pod adds six rounds to your next battle supply.','✧');}},
        {label:'RECYCLE THE CASING · +12 METAL',action:()=>{save.metal+=12;log('12 metal recycled from the pod.');concludeEvent('CASING RECYCLED','The crew strips the empty shell for usable alloy.','✧');}}
      ]);
      if(variant===2)eventScene(node,'REPAIR DRONE HULK','A damaged maintenance drone floats among cargo debris. Its repair arm still responds to commands.',[
        {label:'USE THE DRONE · REPAIR 30 HULL',disabled:hullRatio()>=.999,action:()=>{repairAll(30);log('Salvaged drone repaired 30 hull.');concludeEvent('DRONE REPAIRS COMPLETE','The drone patches your most damaged rooms before its battery dies.','✧');}},
        {label:'STRIP ITS PARTS · +16 METAL',action:()=>{save.metal+=16;log('16 metal stripped from a repair drone.');concludeEvent('PARTS RECOVERED','Its motors and chassis are broken down for metal.','✧');}}
      ]);
      return;
    }
    if(node.type==='anomaly'){
      if(variant===0)eventScene(node,'ION STORM','Charged dust sweeps across the route. Metallic fragments glitter inside the cloud, but engine coils will take a hit.',[
        {label:'SCOOP FRAGMENTS · +25 METAL',action:()=>{save.metal+=25;const engine=activeModules(...ENGINE_TYPES)[0];if(engine)engine.hp=Math.max(1,engine.hp-14);log('Ion storm yielded 25 metal and strained an engine.');concludeEvent('FRAGMENTS RECOVERED','The crew secures 25 metal. An ion engine takes 14 damage.','◈');}},
        {label:'WAIT FOR THE STORM TO PASS',action:()=>concludeEvent('CLEAR SKIES','You hold position until the charged dust thins.','◈')}
      ]);
      if(variant===1)eventScene(node,'GRAVITY LENS','A stable gravity lens links this beacon to a distant lane. The crew can chart a shortcut or mine its trapped alloy.',[
        {label:'CHART THE SHORTCUT',action:()=>{const target=chartShortcut(node);log('A gravity-lens shortcut was added to the sector chart.');concludeEvent('ROUTE OPENED',target?`A new two-way route to beacon ${target.col}${target.row+1} appears on the chart.`:'The lens leads back to known space.','◈');}},
        {label:'MINE TRAPPED ALLOY · +14 METAL',action:()=>{save.metal+=14;log('14 metal mined from the gravity lens.');concludeEvent('ALLOY MINED','The crew pries fragments from the lens instead of charting a route.','◈');}}
      ]);
      if(variant===2)eventScene(node,'MAGNETIC TIDE','A narrow magnetic tide is pulling scrap toward a dead satellite. Your crew can skim its edge or shut down and wait.',[
        {label:'SKIM THE EDGE · +20 METAL',action:()=>{save.metal+=20;const target=damageRandomModule(10);log('Magnetic tide yielded 20 metal and damaged a room.');concludeEvent('SCRAP COLLECTED',`You recover 20 metal; the tide stresses your ${MODULES[target.type].name.toLowerCase()} by 10.`,'◈');}},
        {label:'POWER DOWN AND WAIT',action:()=>concludeEvent('TIDE PASSED','The crew waits for the debris to drift clear.','◈')}
      ]);
      return;
    }
    if(node.type==='derelict'){
      if(variant===0)eventScene(node,'RESEARCH VESSEL','An unpowered research ship still has a hot security grid. A working ion blaster is locked in its hold; the exterior alloy is easier to reach.',[
        {label:'STRIP EXTERIOR · +12 METAL',action:()=>{save.metal+=12;log('12 metal stripped from research vessel exterior.');concludeEvent('EXTERIOR SALVAGED','The crew leaves the security grid untouched.','▣');}},
        {label:'BREACH THE HOLD · +ION BLASTER, HULL −20 HP',action:()=>{const target=damageRandomModule(20);awardWeapon('ion');concludeEvent('ION BLASTER RECOVERED',`The weapon is in your hold for installation at a trader. A security charge hits your ${MODULES[target.type].name.toLowerCase()} for 20.`,'▣');}}
      ]);
      if(variant===1)eventScene(node,'ABANDONED MEDICAL SHIP','A medic is sheltering aboard an abandoned hospital ship. Emergency repair drones still wait in their cradles.',[
        {label:'DEPLOY REPAIR DRONES · REPAIR 35 HULL',disabled:hullRatio()>=.999,action:()=>{repairAll(35);log('Medical ship drones repaired 35 hull.');concludeEvent('REPAIRS COMPLETE','The drones weld damaged rooms before their batteries expire.','▣');}},
        {label:'RESCUE THE MEDIC · +CREW',action:()=>{const recruit=awardCrew('MIRA','#bca8f1');concludeEvent('MEDIC RESCUED',`${recruit} joins your crew. Assign a repair job or another role in the crew panel.`,'▣');}}
      ]);
      if(variant===2)eventScene(node,'SILENT GUNSHIP','The derelict gunship has intact ammunition lockers and a working laser repeater in its exterior mount.',[
        {label:'TAKE AMMUNITION · +1 CRATE',action:()=>{save.ammoCrates++;log('One ammo crate taken from a gunship.');concludeEvent('AMMUNITION RECOVERED','The sealed rounds add six shots to your next battle.','▣');}},
        {label:'RECOVER LASER REPEATER · +WEAPON',action:()=>{awardWeapon('laser');concludeEvent('LASER REPEATER RECOVERED','The working weapon is secured in your hold. Visit a trader to install it on your ship.','▣');}}
      ]);
      return;
    }
    if(node.type==='relay'){
      if(variant===0)eventScene(node,'BROKEN ROUTE RELAY','Its memory contains a route to a distant beacon. The copper antenna could instead be recycled.',[
        {label:'RESTORE THE DISTANT ROUTE',action:()=>{const target=chartShortcut(node);log('A relay shortcut was added to the sector chart.');concludeEvent('RELAY RESTORED',target?`The chart now connects to beacon ${target.col}${target.row+1}.`:'The relay points only to lanes you already know.','⌁');}},
        {label:'RECYCLE THE ANTENNA · +14 METAL',action:()=>{save.metal+=14;log('14 metal recovered from a relay.');concludeEvent('ANTENNA RECYCLED','The relay goes dark as its copper is stowed aboard.','⌁');}}
      ]);
      if(variant===1)eventScene(node,'OLD NAVIGATION BUOY','A retired patrol buoy has sealed emergency ammunition and a recyclable steel chassis.',[
        {label:'TAKE EMERGENCY AMMO · +1 CRATE',action:()=>{save.ammoCrates++;log('Patrol buoy supplied an ammo crate.');concludeEvent('AMMO RECOVERED','The sealed rounds add six shots to your next battle.','⌁');}},
        {label:'RECYCLE THE CHASSIS · +11 METAL',action:()=>{save.metal+=11;log('11 metal recovered from a patrol buoy.');concludeEvent('CHASSIS RECYCLED','The buoy is broken down into useful steel.','⌁');}}
      ]);
      if(variant===2)eventScene(node,'ABANDONED JUMP MARKER','A jump marker is out of alignment. Replacement couplers would reopen a distant two-way lane.',[
        {label:'REPLACE COUPLERS · −8 METAL',disabled:save.metal<8,action:()=>{save.metal-=8;const target=chartShortcut(node);log('A jump marker shortcut was restored for 8 metal.');concludeEvent('JUMP MARKER ONLINE',target?`The marker now connects to beacon ${target.col}${target.row+1}.`:'The marker points only to known lanes.','⌁');}},
        {label:'LEAVE THE MARKER DARK',action:()=>concludeEvent('MARKER BYPASSED','You keep your couplers and follow the original lanes.','⌁')}
      ]);
      return;
    }
    if(node.type==='minefield'){
      if(variant===0)eventScene(node,'DRIFTING MINES','Old anti-ship mines drift across the route. Their cases contain recoverable metal, but sweeping them will strike your hull.',[
        {label:'SWEEP AND SALVAGE · +22 METAL',action:()=>{save.metal+=22;const protectedShip=activeModules('shield','focusShield').length>0;const target=protectedShip?null:damageRandomModule(14);log('22 metal salvaged from a minefield.');concludeEvent('MINES CLEARED',target?`The mines yield 22 metal, but your ${MODULES[target.type].name.toLowerCase()} takes 14 damage.`:'Your shield holds while the crew collects 22 metal.','◌');}},
        {label:'SKIRT THE FIELD',action:()=>concludeEvent('FIELD AVOIDED','The crew takes the long clear lane around the mines.','◌')}
      ]);
      if(variant===1)eventScene(node,'FREIGHT CONTAINER TRAP','A sealed container lies inside a mine perimeter. Remote cutters can free it, but replacement blades cost metal.',[
        {label:'CUT IT FREE · PAY 8, GAIN 28 METAL',disabled:save.metal<8,action:()=>{save.metal+=20;log('Container salvage netted 20 metal after cutter costs.');concludeEvent('CONTAINER OPENED','The recovered cargo contains 28 metal; replacement cutters cost 8.','◌');}},
        {label:'LEAVE THE CONTAINER',action:()=>concludeEvent('TRAP BYPASSED','You pass the mine perimeter without touching the cargo.','◌')}
      ]);
      if(variant===2)eventScene(node,'DEACTIVATED TORPEDO NET','A line of failed torpedoes hangs in the current. Their propellant is gone, but the warheads can supply your guns.',[
        {label:'RECOVER WARHEADS · +1 AMMO CRATE',action:()=>{save.ammoCrates++;log('Torpedo net yielded one ammo crate.');concludeEvent('WARHEADS SECURED','The inert warheads add six rounds to your next battle.','◌');}},
        {label:'RECYCLE CASINGS · +13 METAL',action:()=>{save.metal+=13;log('13 metal recycled from torpedo casings.');concludeEvent('CASINGS RECYCLED','The crew strips the empty housings for alloy.','◌');}}
      ]);
      return;
    }
    if(node.type==='lifeboat'){
      const count=[2,1,3][variant],titles=['FREIGHTER LIFEBOAT','LONE ESCAPE POD','DRIFTING SHUTTLE'];
      const cost=[0,6,0][variant],strain=[0,0,8][variant];
      const situation=['The lifeboat has air for a short journey.','A leaking escape pod needs six metal in sealant before its pilot can board.','A three-person shuttle is tangled in wreckage; pulling it free will strain an engine.'][variant];
      eventScene(node,titles[variant],`${situation} An outpost pays 20 metal per survivor delivered.`,[
        {label:`RESCUE ${count} SURVIVOR${count===1?'':'S'}${cost?' · −6 METAL':strain?' · ENGINE −8 HP':''}`,disabled:save.metal<cost,action:()=>{save.metal-=cost;save.passengers+=count;const engine=strain?activeModules(...ENGINE_TYPES)[0]:null;if(engine)engine.hp=Math.max(1,engine.hp-strain);log(`${count} survivors taken aboard for outpost delivery.`);concludeEvent('SURVIVORS ABOARD',`The ${count} survivor${count===1?' is':'s are'} safe aboard. An outpost will pay for their return.${cost?' Six metal was used to seal the pod.':''}${engine?' The tow strained an engine.':''}`,'♡');}},
        {label:'TRANSMIT THEIR LOCATION',action:()=>concludeEvent('RESCUE SIGNAL SENT','You alert the outpost and leave the beacon transmitting.','♡')}
      ]);
    }

  }
  function canContinue(){return hasSave&&save.modules.some((module)=>module.type==='core'&&module.hp>0);}
  function renderMainMenu(){
    const available=canContinue();
    $('menuContinue').disabled=!available;
    $('menuSaveStatus').textContent=available?`SAVED GAME // SECTOR ${String(save.sector).padStart(2,'0')} · ${save.metal} METAL`:hasSave?'LAST SHIP LOST // START A NEW GAME':'NO SAVED GAME // BEGIN A NEW JOURNEY';
    const menuCanvas=$('menuShip');sizeArtCanvas(menuCanvas,shipArtFrame());
    const g=menuCanvas.getContext('2d');g.imageSmoothingEnabled=false;drawInterior(g);
  }
  function showMainMenu(){
    screen='menu';$('appShell').hidden=true;$('quitScreen').hidden=true;$('mainMenu').hidden=false;
    $('menuConfirm').hidden=true;renderMainMenu();
  }
  function showGame(){
    screen='playing';$('mainMenu').hidden=true;$('quitScreen').hidden=true;$('appShell').hidden=false;
    centerBuildView(false);setMode('hangar');renderAll();
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
    const size=Math.ceil((rock.r+18)*2/4)*4,sprite=document.createElement('canvas');
    sprite.width=size*SPRITE_SCALE;sprite.height=size*SPRITE_SCALE;
    const g=sprite.getContext('2d'),seed=Math.floor(rock.spin*100),half=size/2;
    g.scale(SPRITE_SCALE,SPRITE_SCALE);g.translate(half,half);
    const left=-Math.round(rock.r*.65),top=-Math.round(rock.r*.5),width=Math.round(rock.r*1.3),height=Math.round(rock.r);
    // A broken bridge, exposed room floor, torn plating and a snapped engine
    // make each obstacle read as a dead ship rather than a natural asteroid.
    g.fillStyle='#111d29';g.fillRect(left-7,top+7,width+14,height-14);
    g.fillStyle='#596c73';g.fillRect(left-5,top+4,width+10,height-8);
    g.fillStyle='#a2a99f';g.fillRect(left-3,top+2,width+6,height-4);
    g.fillStyle='#252e35';g.fillRect(left+2,top+5,width-4,height-10);
    g.fillStyle='#677678';g.fillRect(left+5,top+7,width-10,height-14);
    g.fillStyle='#9ea9a5';g.fillRect(left+6,top+8,width-12,2);
    g.fillStyle='#3d4c52';g.fillRect(left+6,top+12,width-12,height-23);
    const cell=Math.max(10,Math.floor(rock.r*.42));
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
      const x=left+6+col*(cell+2),y=top+9+row*(cell+2);
      g.fillStyle='#182833';g.fillRect(x,y,cell,cell);
      g.fillStyle=(row+col+seed)%3===0?'#735f5c':'#7a8c8c';g.fillRect(x+2,y+2,cell-4,cell-4);
      g.fillStyle='#283b45';g.fillRect(x+4,y+4,cell-8,cell-8);
      g.fillStyle='#c1ccc0';g.fillRect(x+2,y+2,Math.max(2,cell-7),1);
      if((row+col+seed)%2===0){g.fillStyle='#cb765e';g.fillRect(x+5,y+5,3,2);}
    }
    g.fillStyle='#172c3d';g.fillRect(left+width-12,top+7,11,10);
    g.fillStyle='#6ab5be';g.fillRect(left+width-10,top+8,7,4);
    g.fillStyle='#c7e1d7';g.fillRect(left+width-9,top+8,3,1);
    const torn=seed%2===0?1:-1;
    g.fillStyle='#313e43';g.fillRect(left-13,top+12,13,6);g.fillRect(left-17,top+13,4,3);
    g.fillStyle='#94a5a3';g.fillRect(left-14,top+12,10,2);
    g.fillStyle='#4e6268';g.fillRect(left+width-3,top+height/2+torn*3,13,4);
    g.fillStyle='#c0b9a6';g.fillRect(left+width+7,top+height/2+torn*3,3,2);
    g.fillStyle='#a45b50';g.fillRect(left+width-2,top+height-11,7,3);
    g.fillStyle='#d8b087';g.fillRect(left+width+4,top+height-10,4,1);
    for(let i=0;i<5;i++){
      const x=left+4+(seed*7+i*13)%(width-8),y=top+4+(seed*11+i*9)%(height-8);
      g.fillStyle=i%2?'#211f29':'#202b32';g.fillRect(x,y,3+i%3,2);
      g.fillStyle='#e4b78b';g.fillRect(x+1,y,1,1);
    }
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
    const health={core:64,weapon:42,engine:40,armor:55};
    const modules=types.map((type)=>({type,cells:ENEMY_TETROMINOES[type],hp:health[type],maxHp:health[type]}));
    const cells=modules.flatMap((module)=>module.cells);
    const r=Math.ceil(Math.max(...cells.map(([x,y])=>Math.hypot((x+.5)*ENEMY_TILE,(y+.5)*ENEMY_TILE)))+9);
    return {modules,r,cells:cells.length};
  }
  function enemyAlive(enemy){
    return enemy.modules?.some((room)=>room.type==='core')?enemy.modules.find((room)=>room.type==='core').hp>0:enemy.hp>0;
  }
  function nearestEnemyRoom(enemy,point){
    const live=enemy.modules?.filter((room)=>room.hp>0);if(!live?.length)return null;
    const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle),dx=point.x-enemy.x,dy=point.y-enemy.y;
    const x=dx*cos+dy*sin,y=-dx*sin+dy*cos;
    return live.sort((a,b)=>{
      const range=(room)=>Math.min(...room.cells.map(([cx,cy])=>Math.hypot(x-cx*ENEMY_TILE,y-cy*ENEMY_TILE)));
      return range(a)-range(b);
    })[0];
  }
  function rayEnemyRoom(origin,dx,dy,enemy,limit){
    if(!enemy.modules?.length){const entry=rayCircle(origin,dx,dy,enemy,enemy.r);return {distance:entry,room:null};}
    const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle),ox=origin.x-enemy.x,oy=origin.y-enemy.y;
    const x=ox*cos+oy*sin,y=-ox*sin+oy*cos,vx=dx*cos+dy*sin,vy=-dx*sin+dy*cos;
    let nearest=limit,roomHit=null;
    for(const room of enemy.modules){
      if(room.hp<=0)continue;
      for(const [cx,cy] of room.cells){
        let entry=-Infinity,exit=Infinity;
        for(const [start,delta,min] of [[x,vx,cx*ENEMY_TILE-ENEMY_TILE/2],[y,vy,cy*ENEMY_TILE-ENEMY_TILE/2]]){
          if(Math.abs(delta)<1e-8){if(start<min||start>min+ENEMY_TILE){exit=-Infinity;break;}}
          else{const a=(min-start)/delta,b=(min+ENEMY_TILE-start)/delta;entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
        }
        if(exit>=Math.max(0,entry)&&entry>=-1e-7&&Math.max(0,entry)<nearest){nearest=Math.max(0,entry);roomHit=room;}
      }
    }
    return {distance:roomHit?nearest:Infinity,room:roomHit};
  }
  function makeAsteroids(world,count,spawn,enemies){
    const rocks=[],navigationRadius=Math.max(spawn.r,...enemies.map((enemy)=>enemy.r));
    for(let i=0;i<count*30&&rocks.length<count;i++){
      const rock={x:rand(110,world.w-110),y:rand(110,world.h-110),r:rand(25,39),spin:rand(0,TAU)};
      if(distance(rock,spawn)<rock.r+spawn.r+WRECK_BERTH+30||enemies.some((enemy)=>distance(rock,enemy)<rock.r+enemy.r+WRECK_BERTH+18))continue;
      if(rocks.some((other)=>distance(rock,other)<rock.r+other.r+2*(navigationRadius+WRECK_BERTH)+12))continue;
      rock.hp=rock.maxHp=rock.r*2;rock.sprite=asteroidSprite(rock);rocks.push(rock);
    }
    return rocks;
  }
  function startBattle(kind){
    hideEvent();
    const count=kind==='rescue'?2:save.sector>3&&Math.random()<.35?2:1;
    const cellCount=save.modules.reduce((sum,module)=>sum+moduleCells(module).length,0),layout=enemyLayout(kind!=='rescue'),enemyCells=count*layout.cells;
    const width=Math.max(2400+cellCount*16+enemyCells*8,shipRadius()*7+900),world={w:width,h:Math.max(1800,width*.72)};
    const enemies=[];
    for(let i=0;i<count;i++){
      const modules=layout.modules.map((room)=>({...room,hp:room.hp+(room.type==='core'?save.sector*4:0),maxHp:room.maxHp+(room.type==='core'?save.sector*4:0)}));
      const hp=modules.reduce((sum,room)=>sum+room.hp,0);
      enemies.push({x:world.w*.5+220+i*70,y:world.h*.5+(count===1?0:i===0?-135:135),angle:Math.PI,hp,maxHp:hp,r:layout.r,modules,path:[],pathTimer:0,cooldown:rand(.7,1.5),speed:kind==='rescue'?48:40,phase:rand(0,TAU),name:kind==='rescue'?'PIRATE SKIFF':'RAIDER'});
    }
    const player={x:world.w*.5-260,y:world.h*.5,vx:0,vy:0,angle:0,omega:0,targetAngle:0,dest:null,path:[],selected:false,r:shipRadius(),thrusters:{}};
    const ammo=12+activeModules('cargo').length*6+save.ammoCrates*6;save.ammoCrates=0;
    battle={kind,world,player,enemies,asteroids:makeAsteroids(world,Math.min(14,8+Math.ceil(cellCount/12)+count),player,enemies),projectiles:[],stars:Array.from({length:Math.min(650,Math.round(world.w*world.h/9500))},()=>({x:rand(0,world.w),y:rand(0,world.h),s:Math.random()<.17?2:1})),ammo,maxAmmo:ammo,shake:0,shields:{}};
    persist();
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
      return Math.hypot(a.x+dx*t-rock.x,a.y+dy*t-rock.y)>=rock.r+radius+WRECK_BERTH;
    });
  }
  function safePoint(point,radius,rocks,world){
    const result={x:clamp(point.x,radius+8,world.w-radius-8),y:clamp(point.y,radius+8,world.h-radius-8)};
    for(let pass=0;pass<3;pass++)for(const rock of rocks){
      const dx=result.x-rock.x,dy=result.y-rock.y,d=Math.hypot(dx,dy)||1,min=rock.r+radius+WRECK_BERTH+4;
      if(d<min){result.x=clamp(rock.x+dx/d*min,radius+8,world.w-radius-8);result.y=clamp(rock.y+dy/d*min,radius+8,world.h-radius-8);}
    }
    return result;
  }
  function routeAroundRocks(start,goal,radius,rocks,world){
    if(clearSegment(start,goal,radius,rocks))return [goal];
    const nodes=[start,goal];
    for(const rock of rocks)for(let i=0;i<16;i++){
      const angle=i*TAU/16,clearance=rock.r+radius+WRECK_BERTH+8;
      const point={x:rock.x+Math.cos(angle)*clearance,y:rock.y+Math.sin(angle)*clearance};
      if(point.x<radius+8||point.x>world.w-radius-8||point.y<radius+8||point.y>world.h-radius-8)continue;
      if(rocks.some((other)=>other!==rock&&distance(point,other)<other.r+radius+WRECK_BERTH))continue;
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
        if(inward<0){ship.vx-=inward*nx*1.55;ship.vy-=inward*ny*1.55;}
      }
    }
    ship.x=clamp(ship.x,ship.r+5,world.w-ship.r-5);ship.y=clamp(ship.y,ship.r+5,world.h-ship.r-5);
    return collided;
  }
  function engineThrusters(){
    const bounds=shipBounds();
    return activeModules(...ENGINE_TYPES).map((module)=>{
      const cells=moduleCells(module),cx=cells.reduce((sum,[x])=>sum+x+.5,0)/cells.length,cy=cells.reduce((sum,[,y])=>sum+y+.5,0)/cells.length;
      const direction=module.rotation*Math.PI/2,force=MODULES[module.type].thrust*(1+.2*(module.level-1))*(systemSupply(module)/2)*(1+.25*Math.min(1,crewAtStation('engine',module)));
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
          const rx=p.x-rock.x,ry=p.y-rock.y,d=Math.hypot(rx,ry)||1,clearance=rock.r+p.r+WRECK_BERTH+32;
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
  function missileLaunch(weapon){
    const mount=weaponGeometry(weapon),cells=save.modules.flatMap(moduleCells),limit=hullEscapeLimit(mount,cells);
    const angle=weaponAngles(weapon,cells,true).filter((angle)=>hullRay(mount,angle,cells,limit)>=limit)
      .sort((a,b)=>Math.abs(angleDifference(mount.direction,a))-Math.abs(angleDifference(mount.direction,b)))[0];
    if(angle===undefined)return null;
    // Stay on the clear launch rail until beyond the hull's projected edge.
    const clearance=Math.max(1,...cells.flatMap(([x,y])=>[[x,y],[x+1,y],[x,y+1],[x+1,y+1]].map(([cx,cy])=>(cx-mount.x)*Math.cos(angle)+(cy-mount.y)*Math.sin(angle))))*COMBAT_TILE+4;
    return {angle,clearance};
  }
  function weaponCanTarget(weapon,player,target) {
    const def=MODULES[weapon.type],mount=weaponWorld(weapon,player),aim=Math.atan2(target.y-mount.y,target.x-mount.x),dist=distance(target,mount);
    if(dist>weaponRange(weapon))return false;
    if(def.guidance)return !!missileLaunch(weapon);
    return Math.abs(angleDifference(mount.direction,aim))<=def.arc*Math.PI/360
      &&(def.hullPass||hullRay(weaponGeometry(weapon),aim-player.angle,save.modules.flatMap(moduleCells),dist/COMBAT_TILE)>=dist/COMBAT_TILE);
  }
  function fireProjectile(owner,x,y,target,damage,speed,range=speed*2.3,options={}){
    const angle=options.angle??Math.atan2(target.y-y,target.x-x);
    battle.projectiles.push({owner,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage,life:range/speed,remaining:range,hitIds:new Set(),...options});
  }
  function fireWeapon(weapon,player,target) {
    const def=MODULES[weapon.type],mount=weaponWorld(weapon,player),salvo=def.salvo||1;
    const aim=Math.atan2(target.y-mount.y,target.x-mount.x),spread=(def.spread||0)*Math.PI/180,half=def.arc*Math.PI/360;
    const launch=def.guidance?missileLaunch(weapon):null;
    if(def.guidance&&!launch)return;weapon.flash=.07;
    for(let i=0;i<salvo;i++){
      const angle=launch?player.angle+launch.angle:mount.direction+clamp(angleDifference(mount.direction,aim+(salvo===1?0:(i/(salvo-1)-.5)*spread)),-half,half);
      fireProjectile('player',mount.x+Math.cos(angle)*.01,mount.y+Math.sin(angle)*.01,target,def.damage+(weapon.level-1)*5,def.speed,weaponRange(weapon),{
        angle,target:def.guidance?target:null,guidance:def.guidance||0,launchRemaining:launch?.clearance||0,
        delay:(def.burstInterval||0)*i,emitter:weapon,burstTarget:target,spreadOffset:launch?0:(salvo===1?0:(i/(salvo-1)-.5)*spread),
        color:def.color,family:def.family,splash:def.splash||0,pierce:def.pierce||0,chain:def.chain||0,hullPass:!!def.hullPass,
        ion:def.ion||0,ionDuration:def.ionDuration||0,systemPulse:def.systemPulse||0,
        chainSystems:def.chainSystems||0,chainRange:def.chainRange||0,chainFalloff:def.chainFalloff||0,
        slow:def.slow||0,slowDuration:def.slowDuration||0,burn:def.burn||0,burnDuration:def.burnDuration||0
      });
    }
  }
  function systemEfficiency(module){return module?.hp===0?0:module?.ionTime>0?module.ionFactor:1;}
  function enemySystemEfficiency(enemy,type){
    const systems=(enemy.modules||[]).filter((module)=>module.type===type);
    return systems.length?systems.reduce((sum,module)=>sum+(module.hp>0?systemEfficiency(module):0),0)/systems.length:1;
  }
  function ionizeSystem(enemy,shot,hitRoom=null){
    const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle),dx=shot.x-enemy.x,dy=shot.y-enemy.y;
    const x=(dx*cos+dy*sin)/ENEMY_TILE,y=(-dx*sin+dy*cos)/ENEMY_TILE;
    const systems=(enemy.modules||[]).filter((module)=>module.type!=='armor'&&module.hp>0);
    const struck=hitRoom?.hp>0&&hitRoom.type!=='armor'?hitRoom:systems.sort((a,b)=>Math.min(...a.cells.map(([cx,cy])=>Math.hypot(cx+.5-x,cy+.5-y)))-Math.min(...b.cells.map(([cx,cy])=>Math.hypot(cx+.5-x,cy+.5-y))))[0];
    if(struck){struck.ionFactor=Math.min(systemEfficiency(struck),shot.ion);struck.ionTime=Math.max(struck.ionTime||0,shot.ionDuration);}
  }
  function enemyRoomPoint(enemy,room){
    const cells=room.cells,x=cells.reduce((sum,[cx])=>sum+cx,0)/cells.length*ENEMY_TILE,y=cells.reduce((sum,[,cy])=>sum+cy,0)/cells.length*ENEMY_TILE;
    const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle);
    return {x:enemy.x+x*cos-y*sin,y:enemy.y+x*sin+y*cos};
  }
  function enemyRoomDistance(enemy,room,point){
    const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle),dx=point.x-enemy.x,dy=point.y-enemy.y;
    const x=(dx*cos+dy*sin)/ENEMY_TILE,y=(-dx*sin+dy*cos)/ENEMY_TILE;
    return Math.min(...room.cells.map(([cx,cy])=>Math.hypot(Math.max(0,Math.abs(x-cx)-.5),Math.max(0,Math.abs(y-cy)-.5))))*ENEMY_TILE;
  }
  function liveEnemySystems(enemy){return (enemy.modules||[]).filter((room)=>room.type!=='armor'&&room.hp!==0);}
  function disruptSystems(shot){
    (battle.effects??=[]).push({x:shot.x,y:shot.y,r:shot.systemPulse,color:shot.color,time:.4,duration:.4,pulse:true});
    for(const enemy of battle.enemies){
      if(enemy.hp<=0||enemy.modules?.some((room)=>room.type==='core'&&room.hp===0))continue;
      for(const room of liveEnemySystems(enemy))if(enemyRoomDistance(enemy,room,shot)<=shot.systemPulse){
        room.ionFactor=Math.min(systemEfficiency(room),shot.ion);room.ionTime=Math.max(room.ionTime||0,shot.ionDuration);
      }
    }
  }
  function damageWeaponSystem(target,room,damage,point){
    room.maxHp??=room.hp??40;room.hp??=room.maxHp;
    const before=room.hp;hurtEnemy(target,damage,room,point);
    // Preserve system damage on layouts that also track aggregate ship health.
    if(room.hp===before)room.hp=Math.max(0,before-damage);
    if(room.type==='core'&&room.hp===0&&target.hp>0)hurtEnemy(target,target.hp);
  }
  function teslaImpact(shot,target,hitRoom){
    let room=hitRoom&&hitRoom.hp!==0?hitRoom:liveEnemySystems(target).sort((a,b)=>enemyRoomDistance(target,a,shot)-enemyRoomDistance(target,b,shot))[0];
    if(!room){hurtEnemy(target,shot.damage);return;}
    let point={x:shot.x,y:shot.y},damage=shot.damage;
    const visited=new Set();
    for(let hop=0;room&&hop<=shot.chainSystems;hop++){
      const to=enemyRoomPoint(target,room);visited.add(room);
      (battle.effects??=[]).push({x:point.x,y:point.y,to,color:shot.color,time:.3,duration:.3});
      damageWeaponSystem(target,room,damage,to);
      if(target.hp<=0||target.modules?.some((part)=>part.type==='core'&&part.hp===0))break;
      point=to;damage*=shot.chainFalloff;
      room=liveEnemySystems(target).filter((part)=>!visited.has(part)&&distance(enemyRoomPoint(target,part),point)<=shot.chainRange)
        .sort((a,b)=>distance(enemyRoomPoint(target,a),point)-distance(enemyRoomPoint(target,b),point))[0];
    }
  }
  function damageAsteroid(rock,damage){
    rock.maxHp??=rock.r*2;rock.hp=Math.max(0,(rock.hp??rock.maxHp)-damage);
    if(rock.hp===0){
      (battle.effects??=[]).push({x:rock.x,y:rock.y,r:rock.r+15,color:'#c9b797',time:.45,duration:.45});
      battle.asteroids=battle.asteroids.filter((other)=>other!==rock);
      for(const enemy of battle.enemies)enemy.pathTimer=0;
      if(battle.player.dest)battle.player.path=routeAroundRocks(battle.player,battle.player.dest,battle.player.r,battle.asteroids,battle.world);
    }
  }
  function hurtEnemy(target,amount,room=null,point=null) {
    if(!enemyAlive(target))return;
    if(!target.modules?.some((part)=>part.type==='core')){
      target.hp=Math.max(0,target.hp-amount);
      if(target.hp===0){log(`${target.name} destroyed.`);toast(`${target.name} destroyed`);}
      return;
    }
    const struck=room?.hp>0?room:nearestEnemyRoom(target,point||{x:target.x,y:target.y});
    if(!struck)return;
    struck.hp=Math.max(0,struck.hp-amount);
    target.hp=target.modules.reduce((sum,part)=>sum+Math.max(0,part.hp),0);
    if(struck.hp===0){
      if(struck.type==='core'){log(`${target.name} command core destroyed.`);toast(`${target.name} destroyed`);}
      else{log(`${target.name} ${struck.type} room disabled.`);toast(`${target.name} ${struck.type} disabled`);}
    }
  }
  function weaponImpact(shot,target,hitRock=null,hitRoom=null) {
    if(shot.chainSystems&&target){teslaImpact(shot,target,hitRoom);return;}
    if(shot.systemPulse){
      disruptSystems(shot);
      if(target){
        const room=hitRoom||liveEnemySystems(target).sort((a,b)=>enemyRoomDistance(target,a,shot)-enemyRoomDistance(target,b,shot))[0];
        if(room)damageWeaponSystem(target,room,shot.damage,shot);else hurtEnemy(target,shot.damage);
      }
      if(hitRock)damageAsteroid(hitRock,shot.damage);
      return;
    }
    const affected=target?[target]:[];
    if(shot.splash){
      (battle.effects??=[]).push({x:shot.x,y:shot.y,r:shot.splash,color:shot.color,time:.35,duration:.35});
      for(const other of battle.enemies)if(other!==target&&enemyAlive(other)&&distance(other,shot)<=shot.splash+(other.r||0))affected.push(other);
    }
    for(const rock of [...battle.asteroids]){
      if(rock===hitRock)damageAsteroid(rock,shot.damage);
      else if(shot.splash&&distance(rock,shot)<=shot.splash+rock.r)damageAsteroid(rock,shot.damage*.55);
    }
    for(const enemy of affected){
      const room=enemy===target?hitRoom:nearestEnemyRoom(enemy,shot);
      if(shot.ion)ionizeSystem(enemy,shot,room);
      hurtEnemy(enemy,shot.damage*(enemy===target?1:.55),room,shot);
      if(shot.slow){enemy.slowFactor=Math.min(enemy.slowTime>0?enemy.slowFactor:1,shot.slow);enemy.slowTime=Math.max(enemy.slowTime||0,shot.slowDuration);}
      if(shot.burn){enemy.burnDps=Math.max(enemy.burnDps||0,shot.burn);enemy.burnTime=Math.max(enemy.burnTime||0,shot.burnDuration);enemy.burnRoom=room;}
    }
    if(target&&shot.chain){
      const chained=battle.enemies.filter((other)=>{
        if(other===target||!enemyAlive(other)||distance(other,target)>shot.chain)return false;
        const dist=distance(other,target)/COMBAT_TILE,angle=Math.atan2(other.y-target.y,other.x-target.x)-battle.player.angle;
        return hullRay(worldToHull(target,battle.player),angle,save.modules.flatMap(moduleCells),dist)>=dist;
      }).sort((a,b)=>distance(a,target)-distance(b,target))[0];
      if(chained){hurtEnemy(chained,shot.damage*.5,nearestEnemyRoom(chained,target),target);(battle.effects??=[]).push({x:target.x,y:target.y,to:{x:chained.x,y:chained.y},color:shot.color,time:.2,duration:.2});}
    }
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
  function shieldStats(module){
    const def=MODULES[module.type];
    return {capacity:Math.round(def.capacity*(1+.35*((module.level||1)-1))),recharge:def.recharge*systemPower(module)*(1+.4*Math.min(1,crewAtStation('shield',module)))};
  }

  function shieldState(module){
    if(!battle)return null;const capacity=shieldStats(module).capacity;
    battle.shields??={};const state=battle.shields[module.id]??={charge:module.hp>0?capacity:0,delay:0,flash:0};
    state.charge=module.hp>0?clamp(state.charge,0,capacity):0;return state;
  }

  function shieldCovers(module,player,angle){
    return module.type==='shield'||Math.abs(angleDifference(player.angle+module.rotation*Math.PI/2,angle))<=MODULES[module.type].arc*Math.PI/360;
  }
  function shieldInterception(shot,dx,dy,player,limit){
    let best=null;
    for(const module of activeModules(...SHIELD_TYPES)){
      if(shieldState(module).charge<=1e-7)continue;
      const entry=rayCircle(shot,dx,dy,player,player.r+(module.type==='focusShield'?23:17));
      if(entry>limit||entry>=best?.distance)continue;
      const angle=Math.atan2(shot.y+dy*entry-player.y,shot.x+dx*entry-player.x);
      if(shieldCovers(module,player,angle))best={distance:entry,angle};
    }
    return best;
  }
  function absorbShields(amount,angle){
    for(const module of activeModules(...SHIELD_TYPES).sort((a,b)=>Number(a.type==='shield')-Number(b.type==='shield'))){
      const state=shieldState(module);
      if(amount<=0||state.charge<=0||!shieldCovers(module,battle.player,angle))continue;
      const absorbed=Math.min(amount,state.charge);state.charge-=absorbed;amount-=absorbed;
      state.delay=1.7;state.flash=.22;
    }
    return amount;
  }

  function updateShields(dt){
    for(const module of save.modules.filter((part)=>SHIELD_TYPES.includes(part.type))){
      const state=shieldState(module),stats=shieldStats(module),waiting=Math.min(state.delay,dt);
      state.delay=Math.max(0,state.delay-dt);state.flash=Math.max(0,state.flash-dt);
      state.charge=Math.min(stats.capacity,state.charge+(dt-waiting)*stats.recharge);
    }
  }

  function damagePlayer(amount,point=null){
    const live=save.modules.filter((module)=>module.hp>0);if(!live.length)return;
    let target=null;
    if(point&&battle){
      const local=worldToHull(point,battle.player),hit=occupancy().get(`${Math.floor(local.x)},${Math.floor(local.y)}`);
      if(hit?.hp>0)target=hit;
      else target=live.reduce((best,module)=>{
        const nearest=(part)=>Math.min(...moduleCells(part).map(([x,y])=>Math.hypot(local.x-x-.5,local.y-y-.5)));
        return nearest(module)<nearest(best)?module:best;
      },live[0]);
    }
    if(!target){const weights=live.map((module)=>module.type==='core'?1:2);let roll=rand(0,weights.reduce((a,b)=>a+b,0));target=live[0];for(let i=0;i<live.length;i++){roll-=weights[i];if(roll<=0){target=live[i];break;}}}
    target.hp=Math.max(0,target.hp-amount);battle.shake=.12;
    if(target.hp===0){log(`${MODULES[target.type].name} disabled!`);toast(`${MODULES[target.type].name} disabled!`);}
    if(save.modules.find((module)=>module.type==='core').hp<=0)finishBattle(false);
  }
  function updateBattle(dt,time){
    if(!battle)return;const b=battle,p=b.player;b.shake=Math.max(0,b.shake-dt);
    navigatePlayer(dt);updateShields(dt);
    for(const module of save.modules){
      if(module.hp<=0||module.hp>=maxHp(module))continue;
      const repairers=crewAtStation('repair',module);
      if(repairers)module.hp=Math.min(maxHp(module),module.hp+dt*5*repairers);
    }
    for(const enemy of b.enemies){
      if(enemyAlive(enemy)&&enemy.burnTime>0){hurtEnemy(enemy,enemy.burnDps*Math.min(dt,enemy.burnTime),enemy.burnRoom);enemy.burnTime=Math.max(0,enemy.burnTime-dt);}
      enemy.slowTime=Math.max(0,(enemy.slowTime||0)-dt);
      for(const module of enemy.modules||[])module.ionTime=Math.max(0,(module.ionTime||0)-dt);
    }
    b.effects=(b.effects||[]).filter((effect)=>(effect.time-=dt)>0);
    const living=b.enemies.filter(enemyAlive);
    for(const weapon of activeModules(...WEAPON_TYPES)){
      weapon.flash=Math.max(0,(weapon.flash||0)-dt);
      const def=MODULES[weapon.type],mount=weaponWorld(weapon,p);weapon.cooldown-=dt;
      if(weapon.cooldown>0||b.ammo<def.ammo)continue;
      const target=living.filter((enemy)=>weaponCanTarget(weapon,p,enemy)).sort((a,c)=>distance(a,mount)-distance(c,mount))[0];
      if(target){
        b.ammo-=def.ammo;weapon.cooldown=def.reload/systemPower(weapon)/(1+crewAtStation('gun',weapon)*.4)/(1+(weapon.level-1)*.22);
        fireWeapon(weapon,p,target);
      }
    }
    for(const enemy of living){
      const dx=p.x-enemy.x,dy=p.y-enemy.y,dist=Math.hypot(dx,dy)||1;
      const speed=enemy.speed*(enemy.slowTime>0?enemy.slowFactor:1)*enemySystemEfficiency(enemy,'engine');
      enemy.pathTimer-=dt;enemy.moving=speed>0&&dist>220;
      if(enemy.moving){
        if(enemy.pathTimer<=0||!enemy.path.length){
          const goal=safePoint(p,enemy.r,b.asteroids,b.world);
          enemy.path=routeAroundRocks(enemy,goal,enemy.r,b.asteroids,b.world);enemy.pathTimer=1.2;
        }
        if(enemy.path.length>1&&distance(enemy,enemy.path[0])<14)enemy.path.shift();
        const waypoint=enemy.path[0];
        if(waypoint){const vx=waypoint.x-enemy.x,vy=waypoint.y-enemy.y,length=Math.hypot(vx,vy)||1;enemy.x+=vx/length*speed*dt;enemy.y+=vy/length*speed*dt;}
      }else{enemy.x+=Math.cos(time*.001+enemy.phase)*speed*.32*dt;enemy.y+=Math.sin(time*.001+enemy.phase)*speed*.32*dt;}
      if(resolveRockCollision(enemy,b.asteroids,b.world))enemy.pathTimer=0;
      enemy.angle+=clamp(angleDifference(enemy.angle,Math.atan2(dy,dx)),-dt*2,dt*2);
      const weaponPower=enemySystemEfficiency(enemy,'weapon');enemy.cooldown-=dt*weaponPower*enemySystemEfficiency(enemy,'core');if(weaponPower>0&&enemy.cooldown<=0&&dist<470){
        enemy.cooldown=rand(1.7,2.3);
        const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle);
        fireProjectile('enemy',enemy.x+ENEMY_TILE*4*cos+ENEMY_TILE*sin,enemy.y+ENEMY_TILE*4*sin-ENEMY_TILE*cos,p,7+save.sector*.65,270);
      }
    }
    for(let i=b.projectiles.length-1;i>=0;i--){
      const shot=b.projectiles[i];let step=dt;
      if(shot.delay>0){
        const waited=Math.min(step,shot.delay);shot.delay=Math.max(0,shot.delay-waited);step-=waited;
        if(shot.delay>1e-7)continue;shot.delay=0;
        // A burst follows the weapon's current mount, not its old position.
        const weapon=shot.emitter,target=shot.burstTarget;
        if(!save.modules.includes(weapon)||weapon.hp<=0||systemPower(weapon)<=0||!(target?.hp>0)||target.modules?.some((room)=>room.type==='core'&&room.hp===0)||!weaponCanTarget(weapon,p,target)){b.projectiles.splice(i,1);continue;}
        const def=MODULES[weapon.type],mount=weaponWorld(weapon,p),launch=def.guidance?missileLaunch(weapon):null;
        if(def.guidance&&!launch){b.projectiles.splice(i,1);continue;}
        const aim=Math.atan2(target.y-mount.y,target.x-mount.x),half=def.arc*Math.PI/360;
        const angle=launch?p.angle+launch.angle:mount.direction+clamp(angleDifference(mount.direction,aim+shot.spreadOffset),-half,half);
        const speed=Math.hypot(shot.vx,shot.vy);shot.x=mount.x+Math.cos(angle)*.01;shot.y=mount.y+Math.sin(angle)*.01;
        shot.vx=Math.cos(angle)*speed;shot.vy=Math.sin(angle)*speed;shot.launchRemaining=launch?.clearance||0;weapon.flash=.07;
      }
      const speed=Math.hypot(shot.vx,shot.vy);
      if(shot.guidance&&!(shot.launchRemaining>0)&&shot.target&&enemyAlive(shot.target)){
        const current=Math.atan2(shot.vy,shot.vx),desired=Math.atan2(shot.target.y-shot.y,shot.target.x-shot.x);
        const angle=current+clamp(angleDifference(current,desired),-shot.guidance*step,shot.guidance*step);
        shot.vx=Math.cos(angle)*speed;shot.vy=Math.sin(angle)*speed;
      }
      const dx=shot.vx/speed,dy=shot.vy/speed;
      const travel=Math.min(speed*step,shot.remaining,shot.launchRemaining>0?shot.launchRemaining:Infinity);
      if(shot.owner==='enemy'&&!shot.evasionChecked&&rayCircle(shot,dx,dy,p,p.r+25)<=travel){
        shot.evasionChecked=true;shot.evaded=Math.random()<evasionChance();
        if(shot.evaded)(b.effects??=[]).push({x:p.x,y:p.y-p.r-20,text:'MISS',color:'#9ce5df',time:.6,duration:.6});
      }
      let stop=travel,hit=false,target=null,hitRock=null,hitRoom=null,shielded=false,shieldAngle=0;
      if(shot.owner==='player'&&!shot.hullPass){
        const blocked=hullRay(worldToHull(shot,p),Math.atan2(dy,dx)-p.angle,save.modules.flatMap(moduleCells),travel/COMBAT_TILE)*COMBAT_TILE;
        if(blocked<travel-1e-7){stop=blocked;hit=true;}
      }
      for(const rock of b.asteroids){
        const entry=rayCircle(shot,dx,dy,rock,rock.r*.87);
        if(entry<=stop){stop=entry;hit=true;hitRock=rock;}
      }
      const targets=shot.owner==='player'?b.enemies.filter((enemy)=>enemyAlive(enemy)&&!shot.hitIds.has(enemy)):(shot.evaded?[]:[p]);
      for(const candidate of targets){
        const contact=shot.owner==='player'?rayEnemyRoom(shot,dx,dy,candidate,stop):{distance:rayCircle(shot,dx,dy,candidate,candidate.r*.82),room:null};
        const entry=contact.distance;
        if(entry<stop||(!hit&&entry<=stop)){stop=entry;hit=true;target=candidate;hitRock=null;hitRoom=contact.room;}
      }
      if(shot.owner==='enemy'&&!shot.evaded){
        const shield=shieldInterception(shot,dx,dy,p,stop);
        if(shield&&(shield.distance<stop||(!hit&&shield.distance<=stop))){
          stop=shield.distance;hit=true;target=p;hitRock=null;shielded=true;shieldAngle=shield.angle;
        }
      }
      shot.x+=dx*stop;shot.y+=dy*stop;shot.remaining-=stop;shot.life-=step;shot.launchRemaining=Math.max(0,(shot.launchRemaining||0)-stop);
      if(target&&shot.owner==='player'){
        weaponImpact(shot,target,null,hitRoom);shot.hitIds.add(target);
        if(shot.pierce>0){shot.pierce--;hit=false;}
      }else if(target){const remaining=shielded?absorbShields(shot.damage,shieldAngle):shot.damage;if(remaining>0)damagePlayer(remaining,shot);if(!battle)return;}
      else if(hit&&shot.owner==='player')weaponImpact(shot,null,hitRock);
      else if(hitRock)damageAsteroid(hitRock,shot.damage);
      if(hit||shot.remaining<=1e-7||shot.x<0||shot.x>b.world.w||shot.y<0||shot.y>b.world.h)b.projectiles.splice(i,1);
    }
    if(b.enemies.every((enemy)=>!enemyAlive(enemy))){finishBattle(true);return;}
    if(time-lastHudRefresh>280){lastHudRefresh=time;renderHud();renderInspector();refreshCrewStatus();}
  }
  function enemySprite(heavy,moving){
    const key=`${heavy}:${moving}`;if(enemySprites.has(key))return enemySprites.get(key);
    const sprite=document.createElement('canvas');sprite.width=220*SPRITE_SCALE;sprite.height=160*SPRITE_SCALE;
    const g=sprite.getContext('2d');g.imageSmoothingEnabled=false;g.scale(SPRITE_SCALE,SPRITE_SCALE);g.translate(110,80);
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
    g.save();g.translate(79,-ENEMY_TILE);drawWeaponSprite(g,'weapon');g.restore();
    if(heavy){g.fillStyle='#c2b9c9';g.fillRect(-10,39,20,5);g.fillStyle='#715e76';g.fillRect(-6,44,12,8);}
    enemySprites.set(key,sprite);return sprite;
  }
  function drawEnemy(enemy){
    const g=ctx,r=enemy.r;
    g.save();g.translate(enemy.x,enemy.y);g.rotate(enemy.angle);
    g.drawImage(enemySprite(enemy.modules.length===4,enemy.moving),-110,-80,220,160);
    for(const room of enemy.modules){
      if(room.hp<=0){
        for(const [x,y] of room.cells){const px=x*ENEMY_TILE-11,py=y*ENEMY_TILE-11;
          g.fillStyle='#0b111acb';g.fillRect(px+1,py+1,20,20);
          g.fillStyle='#9a6265';g.fillRect(px+3,py+3,3,2);g.fillRect(px+16,py+16,3,2);
          g.fillStyle='#d08a79';g.fillRect(px+9,py+9,4,3);
        }
      }else if(room.hp<room.maxHp){
        const center=room.cells.reduce((sum,[x,y])=>({x:sum.x+x*ENEMY_TILE,y:sum.y+y*ENEMY_TILE}),{x:0,y:0});
        const cx=center.x/room.cells.length,cy=center.y/room.cells.length;
        g.fillStyle='#111a25';g.fillRect(cx-14,cy-17,28,5);
        g.fillStyle='#ef9a87';g.fillRect(cx-13,cy-16,26*room.hp/room.maxHp,3);
      }
    }
    g.restore();
    if((enemy.modules||[]).some((module)=>module.ionTime>0)){g.fillStyle='#80dce9';g.fillRect(enemy.x-16,enemy.y-r-6,5,5);}
    if(enemy.slowTime>0){g.fillStyle='#9ceaf0';g.fillRect(enemy.x-24,enemy.y-r-6,5,5);}
    if(enemy.burnTime>0){g.fillStyle='#f5a267';g.fillRect(enemy.x-16,enemy.y-r-6,5,5);}
  }
  function drawShields(player){
    for(const module of activeModules(...SHIELD_TYPES)){
      const state=shieldState(module),stats=shieldStats(module);if(state.charge<=0)continue;
      const focused=module.type==='focusShield',center=player.angle+module.rotation*Math.PI/2,span=focused?MODULES[module.type].arc*Math.PI/180:TAU;
      ctx.save();ctx.globalAlpha=Math.min(1,.15+.45*state.charge/stats.capacity+(state.flash>0?.25:0));ctx.strokeStyle=focused?'#92f9e9':'#b9a3f7';ctx.lineWidth=state.flash>0?3:2;
      ctx.beginPath();ctx.arc(player.x,player.y,player.r+17+(focused?6:0),center-span/2,center+span/2);ctx.stroke();ctx.restore();
    }
  }

  function drawProjectile(g,shot){
    const speed=Math.hypot(shot.vx,shot.vy),color=shot.color||(shot.owner==='player'?'#ffdb92':'#fc828a');
    g.save();g.translate(shot.x,shot.y);g.rotate(Math.atan2(shot.vy,shot.vx));
    if(shot.family==='missile'){
      g.fillStyle='#252b2c';g.fillRect(-7,-3,12,6);g.fillStyle='#d0d2bf';g.fillRect(-6,-2,9,4);
      g.fillStyle='#b74e45';g.fillRect(-4,-2,3,4);g.fillStyle='#e4dec5';g.fillRect(3,-1,3,2);
      g.fillStyle='#879087';g.fillRect(-7,-4,3,2);g.fillRect(-7,2,3,2);
      g.fillStyle='#e69d5b';g.fillRect(-12,-1.5,5,3);g.fillStyle='#fff0b0';g.fillRect(-9,-1,2,2);
    }else if(shot.family==='laser'||shot.family==='rail'){
      g.fillStyle=color;g.fillRect(-Math.min(25,speed*.024),-1,Math.min(25,speed*.024)+2,2);
      g.fillStyle='#fff0d8';g.fillRect(-3,-.5,5,1);
    }else if(shot.ion){
      g.strokeStyle='#8fd6e3';g.lineWidth=1.5;g.strokeRect(-4,-4,8,8);g.fillStyle='#dbf5e9';g.fillRect(-1.5,-1.5,3,3);
    }else if(shot.burn){
      g.fillStyle='#dc7c4c';g.fillRect(-6,-3,9,6);g.fillStyle='#f6c27a';g.fillRect(-2,-2,6,4);g.fillStyle='#fff1b7';g.fillRect(2,-1,3,2);
    }else if(shot.family==='plasma'){
      g.fillStyle=color;g.fillRect(-4,-3,8,6);g.fillRect(-3,-4,6,8);g.fillStyle='#e6efdb';g.fillRect(-1,-1,3,3);
    }else{
      g.fillStyle=color;g.fillRect(-5,-2,8,4);g.fillStyle='#fff0c8';g.fillRect(1,-1,3,2);
    }
    g.restore();
  }
  function arenaViewport(world){return {w:Math.min(1080,world.w),h:Math.min(760,world.h)};}
  function arenaCamera(){
    const {world,player}=battle,view=arenaViewport(world);
    return {w:view.w,h:view.h,x:clamp((player?.x??world.w/2)-view.w/2,0,world.w-view.w),y:clamp((player?.y??world.h/2)-view.h/2,0,world.h-view.h)};
  }
  function drawArena(time){
    if(!battle)return;const b=battle,w=b.world.w,h=b.world.h,p=b.player;
    const view=arenaCamera();
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.scale(canvas.width/view.w,canvas.height/view.h);ctx.translate(-view.x,-view.y);
    ctx.fillStyle='#071522';ctx.fillRect(view.x,view.y,view.w,view.h);
    ctx.strokeStyle='#1d3449';ctx.lineWidth=2;
    for(let x=Math.floor(view.x/48)*48;x<view.x+view.w;x+=48){ctx.beginPath();ctx.moveTo(x,view.y);ctx.lineTo(x,view.y+view.h);ctx.stroke();}
    for(let y=Math.floor(view.y/48)*48;y<view.y+view.h;y+=48){ctx.beginPath();ctx.moveTo(view.x,y);ctx.lineTo(view.x+view.w,y);ctx.stroke();}
    for(const star of b.stars){ctx.fillStyle=star.s===2?'#8cbdc4':'#4f7386';ctx.fillRect(star.x,star.y,star.s,star.s);}
    ctx.strokeStyle='#4b7488';ctx.lineWidth=4;ctx.strokeRect(3,3,w-6,h-6);
    for(const rock of b.asteroids){
      if(rock.hp<rock.maxHp){ctx.fillStyle='#192e3c';ctx.fillRect(rock.x-16,rock.y-rock.r-9,32,3);ctx.fillStyle='#c9b797';ctx.fillRect(rock.x-16,rock.y-rock.r-9,32*rock.hp/rock.maxHp,3);}
      ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.spin);
      const sprite=rock.sprite||(rock.sprite=asteroidSprite(rock));ctx.drawImage(sprite,-sprite.width/SPRITE_SCALE/2,-sprite.height/SPRITE_SCALE/2,sprite.width/SPRITE_SCALE,sprite.height/SPRITE_SCALE);ctx.restore();
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
    for(const enemy of b.enemies)if(enemyAlive(enemy))drawEnemy(enemy);
    if(p.selected){ctx.strokeStyle='#88e5e5';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+13,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    const art=shipArtFrame();sizeArtCanvas(shipSprite,art);drawInterior(spriteCtx,false,p.thrusters,art);
    const bounds=shipBounds(),minX=bounds.minX-2,minY=bounds.minY-2;
    const maxX=bounds.maxX+2,maxY=bounds.maxY+2;
    const width=maxX-minX+1,height=maxY-minY+1;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(shipSprite,(minX-art.x)*TILE*art.scale,(minY-art.y)*TILE*art.scale,width*TILE*art.scale,height*TILE*art.scale,(minX-bounds.cx)*COMBAT_TILE,(minY-bounds.cy)*COMBAT_TILE,width*COMBAT_TILE,height*COMBAT_TILE);
    ctx.restore();
    drawShields(p);
    for(const effect of b.effects||[]){
      ctx.globalAlpha=effect.time/effect.duration;ctx.fillStyle=effect.color;
      if(effect.text){ctx.font='14px monospace';ctx.fillText(effect.text,effect.x,effect.y-(1-effect.time/effect.duration)*15);}
      else if(effect.to){ctx.strokeStyle=effect.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(effect.x,effect.y);ctx.lineTo(effect.to.x,effect.to.y);ctx.stroke();}
      else if(effect.pulse){ctx.strokeStyle=effect.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(effect.x,effect.y,effect.r*(1-effect.time/effect.duration),0,TAU);ctx.stroke();}
      else {const radius=effect.r*(1-effect.time/effect.duration);for(let i=0;i<12;i++){const angle=i*TAU/12;ctx.fillRect(effect.x+Math.cos(angle)*radius-3,effect.y+Math.sin(angle)*radius-3,6,6);}}
      ctx.globalAlpha=1;
    }
    for(const shot of b.projectiles)if(!(shot.delay>0))drawProjectile(ctx,shot);
    ctx.fillStyle='#a6c8d0';ctx.font='14px monospace';ctx.fillText(`SECTOR ${String(save.sector).padStart(2,'0')}  //  ${Math.round(hullRatio()*100)}% HULL`,view.x+20,view.y+view.h-19);
    if(p.selected){ctx.fillStyle='#92dfe0';ctx.fillText(`SPEED ${Math.round(Math.hypot(p.vx,p.vy))}  TURN ${Math.round(Math.abs(p.omega)*180/Math.PI)}°/s`,view.x+view.w-270,view.y+view.h-19);}
  }
  function arenaDisplaySize(world,availableWidth,availableHeight,density){
    const scale=Math.min(availableWidth/world.w,availableHeight/world.h);
    const width=Math.max(1,Math.floor(world.w*scale)),height=Math.max(1,Math.floor(world.h*scale));
    const ratio=clamp(density||1,1,3);
    return {width,height,pixelWidth:Math.round(width*ratio),pixelHeight:Math.round(height*ratio)};
  }
  function fitArenaCanvas(){
    if(!battle)return;
    const arena=canvas.parentElement;
    if(arena.clientWidth<=0||arena.clientHeight<=0)return;
    const size=arenaDisplaySize(arenaViewport(battle.world),arena.clientWidth,arena.clientHeight,window.devicePixelRatio);
    canvas.style.width=`${size.width}px`;canvas.style.height=`${size.height}px`;
    if(canvas.width!==size.pixelWidth||canvas.height!==size.pixelHeight){canvas.width=size.pixelWidth;canvas.height=size.pixelHeight;}
  }
  function canvasPoint(event){const rect=canvas.getBoundingClientRect(),view=arenaCamera();return{x:view.x+(event.clientX-rect.left)/rect.width*view.w,y:view.y+(event.clientY-rect.top)/rect.height*view.h};}
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
    if(!activeModules(...ENGINE_TYPES).length){toast('Power and repair an engine to move.');return;}
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
    const force=$('engineForce'),module=selectedModule();if(force&&ENGINE_TYPES.includes(module?.type))force.textContent=Math.round(engineThrusters().find((engine)=>engine.module.id===module.id)?.force||0);
    $('crewList').querySelectorAll('.crew-card').forEach((card,index)=>{
      const person=save.crew[index],route=crewRoutes[person.id];
      const moving=route?.path?.length&&distance(person,route.path[0])>.08;
      card.querySelector('small').textContent=moving?'WALKING':'AT STATION';
    });
  }
  function frame(time){
    const dt=clamp((time-lastFrame)/1000||0,0,.05);lastFrame=time;
    if(screen==='playing'){
      if(!eventOpen)updateCrew(dt);
      if(mode==='combat'&&battle){updateBattle(dt,time);drawArena(time);}
      if(mode==='hangar'||mode==='trade')drawHangar();
      if(time-lastHudRefresh>700){lastHudRefresh=time;refreshCrewStatus();if(mode!=='combat')renderSystems();}
    }
    requestAnimationFrame(frame);
  }
  function init(){
    createGrid();
    window.addEventListener('resize',()=>{if(screen==='playing'&&mode==='combat')fitArenaCanvas();});
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(mode==='combat')fitArenaCanvas();}).observe(canvas.parentElement);
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
    $('leaveTrader').addEventListener('click',()=>{persist();openMap();renderAll();});
    $('revisitTrader').addEventListener('click',()=>{const node=currentMapNode();if(node?.type==='trader')openTrader(node);});
    $('shipMapButton').addEventListener('click',openMap);
    $('traderRepair').addEventListener('click',()=>{if(mode!=='trade'||save.metal<15||hullRatio()>=.999)return;save.metal-=15;repairAll(55);log('Field repairs purchased.');});
    $('marketFilters').querySelectorAll('button').forEach((button)=>button.addEventListener('click',()=>{marketFilter=button.dataset.filter;$('marketFilters').querySelectorAll('button').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));renderCatalog();}));
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
      if(['hangar','trade'].includes(mode)&&event.key.startsWith('Arrow')){const pan={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,-3],ArrowDown:[0,3]}[event.key];if(pan){event.preventDefault();panBuild(...pan);return;}}
      if(event.key.toLowerCase()==='q'){if(mode==='combat')rotateArrival(-1);else if(mode==='trade')rotateBuild(-1);}
      if(event.key.toLowerCase()==='e'){if(mode==='combat')rotateArrival(1);else if(mode==='trade')rotateBuild(1);}
      if(event.key==='Escape'&&mode==='trade'&&!eventOpen){selectedCatalog=null;movingModuleId=null;renderAll();}
    });
    log('Ship systems online. Plot a route on the sector map.');
    renderAll();showMainMenu();requestAnimationFrame(frame);
  }
  init();
})();
