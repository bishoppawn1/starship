(() => {
  'use strict';

  const GRID_W = 12, GRID_H = 10, TILE = 24, COMBAT_TILE = 30, ENEMY_TILE = 22, SAVE_KEY = 'starship-drift-save-v1';
  const TAU = Math.PI * 2;
  const WRECK_BERTH = 8;
  // Preserve the source drawing's little square pixels before rotating the
  // assembled image. The display canvas samples this at native screen density.
  const SPRITE_SCALE = 4;
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const C = {
    core: '#78dbea', engine: '#8cd7b0', weapon: '#f4b878', railgun: '#f29490',
    shield: '#bfa6f1', armor: '#9aadc0'
  };
  const MODULES = {
    core: { name: 'Command Core', short: 'C', color: C.core, shape: [[0,0],[1,0],[0,1],[1,1]], station: [0,0], hp: 170, cost: 0, description: 'Pilot command room. Room upgrades add hull durability; upgrade the ship reactor separately in System Power.' },
    engine: { name: 'Standard Ion Engine', short: 'E', color: C.engine, shape: [[0,0],[0,1],[0,2]], station: [0,1], hp: 80, cost: 35, thrust: 270, description: 'Powered directional thruster. An operator boosts thrust; a pilot enables evasion. Keep the exhaust clear.' },
    smallEngine: { name: 'Compact Ion Engine', short: 'E', color: '#90c6d8', shape: [[0,0]], station: [0,0], hp: 50, cost: 22, thrust: 110, description: 'Single-cell maneuvering thruster. Low force, easy to fit at the hull edge. Keep the exhaust clear.' },
    heavyEngine: { name: 'Heavy Ion Engine', short: 'E', color: '#a7c99b', shape: [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]], station: [0,1], hp: 125, cost: 70, thrust: 620, description: 'Six-cell drive with three exhaust nozzles. High force for heavy hulls. Keep the exhaust clear.' },
    weapon: { name: 'Pulse Cannon', short: 'W', color: C.weapon, shape: [[0,0],[1,0],[1,1]], station: [1,1], mount: [1,0], muzzle: [2,.5], hp: 75, cost: 45, range: 420, arc: 130, damage: 14, reload: 1.2, ammo: 1, description: 'A crewed pulse cannon with a 130° forward firing arc.' },
    railgun: { name: 'Railgun', short: 'R', color: C.railgun, shape: [[0,0],[1,0],[2,0],[3,0]], station: [1,0], mount: [3,0], muzzle: [4,.5], hp: 90, cost: 70, range: 580, arc: 50, damage: 30, reload: 2.4, ammo: 2, description: 'Long-range slug pierces two aligned rooms within a narrow 50° arc.' },
    shield: { name: 'Wide Shield Array', short: 'S', color: C.shield, shape: [[0,0],[1,0],[0,1],[1,1]], station: [0,0], hp: 85, cost: 50, shield:'wide', capacity:100, recharge:10, description: 'A 100-strength shield around the entire hull, wherever this room is installed. Coverage grows with the ship. Shared power and crew improve recharge.' },
    focusShield: { name: 'Focused Shield', short: 'F', color: '#91e8e4', shape: [[0,0],[1,0],[0,1]], station: [0,0], hp: 75, cost: 62, shield:'focused', capacity:160, recharge:16, shieldRadius:120, arc:105, description: 'Projects a local 160-strength, 105° sector up to 120 units (4 tiles) from this room. Position and aim determine which hull sections are protected.' },
    generator: { name: 'Small Power Generator', short: 'G', color: '#e5be72', shape: [[0,0],[1,0]], station: [0,0], hp: 65, cost: 35, generation: 2, description: 'Compact two-cell generator. Adds 2 shared power; each upgrade adds 1 more. No crew or power required.' },
    teleporter: { name: 'Crew Teleporter', short: 'T', color: '#a5e2d7', shape: [[0,0],[1,0],[0,1],[1,1]], station: [0,0], hp: 80, cost: 75, description: 'Send selected crew from this pad to an enemy within 600 units. Recall them after a 12-second recharge. Requires shared power.' },
    droneControl: { name: 'Drone Bay', short: 'D', color: '#b9cde4', shape: [[0,0],[1,0],[0,1]], station: [0,0], hp: 75, cost: 65, door:[2,.5], description: 'Launches crew-loaded drones automatically through a clear exterior door. No drone storage limit. Build a Drone Assembly and leave the launch lane open.' },
    droneAssembly: { name: 'Drone Assembly', short: 'A', color: '#d3be8e', shape: [[0,0],[1,0],[0,1],[1,1]], station:[0,0], hp:80, cost:50, description:'Continuously builds drones for crew to carry to a bay. Pause production when you have enough. Requires shared power; no parts or launch costs.' },
    ammoAssembly: { name: 'Ammo Assembly', short: 'A', color: '#d8b579', shape: [[0,0],[0,1]], station: [0,0], hp: 75, cost: 45, description: 'Powered ammunition factory. Uses shared power only to make heavy rounds (4 per batch) or missiles (2 per batch). Crew collect finished rounds here and carry them to matching magazines.' },
    armor: { name: 'Armor Plating', short: 'A', color: C.armor, shape: [[0,0],[1,0],[0,1]], station: null, hp: 115, cost: 20, description: 'Open, durable floor that can absorb damage.' }
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
    {id:'missile',name:'Missile Rack',color:'#d5dca4',range:Infinity,arc:100,damage:20,reload:2.4,ammo:2,speed:250,cost:75,guidance:2.2,splash:38,family:'missile',description:'Guided missiles track moving targets and explode.'},
    {id:'swarm',name:'Swarm Launcher',color:'#a8d6a8',range:Infinity,arc:140,damage:7,reload:2.2,ammo:3,speed:280,cost:82,salvo:4,spread:26,guidance:3.2,splash:18,family:'missile',description:'Four nimble guided rockets overwhelm a target.'},
    {id:'torpedo',name:'Torpedo Tube',color:'#e4aa90',range:650,arc:35,damage:48,reload:4.3,ammo:4,speed:190,cost:110,fixed:true,length:3,splash:75,family:'missile',description:'Heavy unguided torpedoes cause a broad explosion.'},
    {id:'siege',name:'Siege Cannon',color:'#bca692',range:600,arc:30,damage:55,reload:5,ammo:4,speed:340,cost:120,fixed:true,length:4,splash:42,family:'cannon',description:'Slow-loading siege shells deliver massive damage.'},
    {id:'disruptor',name:'Disruptor',color:'#b8e87e',range:340,arc:155,damage:5,reload:1.8,ammo:0,speed:520,cost:74,ion:.8,ionDuration:2,systemPulse:80,family:'energy',description:'A broad pulse reduces nearby systems’ efficiency by twenty percent for two seconds.'},
    {id:'tesla',name:'Tesla Coil',color:'#abafff',range:300,arc:150,damage:6,reload:1.8,ammo:0,speed:950,cost:80,chainSystems:3,chainRange:110,chainFalloff:.7,family:'energy',description:'A light electrical hit bounces through up to three more systems on the same ship, weakening with each jump.'},
    {id:'cryo',name:'Cryo Projector',color:'#a2eaf0',range:260,arc:140,damage:8,reload:.9,ammo:1,speed:300,cost:54,slow:.4,slowDuration:4,family:'plasma',description:'Cold bursts slow pursuers for four seconds.'},
    {id:'inferno',name:'Inferno Projector',color:'#f39a64',range:230,arc:130,damage:6,reload:1,ammo:1,speed:290,cost:57,burn:5,burnDuration:4,family:'plasma',description:'Incendiary hits burn for five damage per second.'},
    {id:'proton',name:'Proton Lance',color:'#f0df82',range:620,arc:25,damage:24,reload:2.8,ammo:0,speed:950,cost:98,fixed:true,length:4,hullPass:true,family:'energy',description:'A narrow lance passes safely through your own hull sections, stopping at the first enemy ship.'},
    {id:'gauss',name:'Gauss Repeater',color:'#9ac4dd',range:510,arc:55,damage:12,reload:1.6,ammo:2,speed:650,cost:84,fixed:true,length:3,salvo:2,spread:4,pierce:1,family:'rail',description:'Twin magnetic slugs each pierce a second target.'},
    {id:'beam',name:'Sweep Beam',color:'#ed967e',range:460,arc:100,damage:18,reload:3.4,ammo:0,speed:0,cost:80,beamDuration:1.2,family:'beam',description:'Sweeps left to right across rooms: 18 damage per room, only 6 against shields.'},
    {id:'heavyBeam',name:'Heavy Beam',color:'#e9c986',range:580,arc:55,damage:30,reload:5,ammo:0,speed:0,cost:115,fixed:true,length:3,beamDuration:1.8,family:'beam',description:'A long, heavy sweep deals 30 damage per room, only 10 against shields.'}
  ];
  for(const {id,fixed,length=2,...stats} of WEAPON_DESIGNS){
    const base=fixed?MODULES.railgun:MODULES.weapon;
    MODULES[id]={...base,pierce:0,...stats,short:stats.name[0],mountFacings:fixed?1:2};
    if(fixed){MODULES[id].shape=Array.from({length},(_,x)=>[x,0]);MODULES[id].mount=[length-1,0];MODULES[id].muzzle=[length,.5];MODULES[id].station=[0,0];}
  }
  const WEAPON_TYPES=Object.keys(MODULES).filter((type)=>MODULES[type].range);
  const AMMO = {heavy:{name:'Heavy ammo',color:'#e6b875',batch:4},missile:{name:'Missile ammo',color:'#b9d782',batch:2}};
  for(const type of WEAPON_TYPES){
    const def=MODULES[type];def.ammoType=['missile','swarm','torpedo'].includes(type)?'missile':['railgun','flak','siege','gauss'].includes(type)?'heavy':null;
    def.ammo=def.ammoType?(def.salvo||1):0;
    def.magazine=def.ammo*4;
  }
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
    gauss:{shape:[[0,0],[1,0],[1,1],[2,1]],station:[0,0],mount:[2,1]},
    beam:{shape:[[0,0],[1,0],[0,1]],station:[0,1],mount:[1,0]},
    heavyBeam:{shape:[[0,0],[1,0],[2,0]],station:[0,0],mount:[2,0]}
  };
  for(const [type,layout] of Object.entries(WEAPON_FOOTPRINTS))Object.assign(MODULES[type],layout,{muzzle:[layout.mount[0]+1,layout.mount[1]+.5]});
  MODULES.gatling.burstInterval=.09;MODULES.gauss.burstInterval=.12;MODULES.swarm.burstInterval=.1;
  MODULES.gatling.description='Three rounds fire in a timed burst, tracking the target between shots.';
  MODULES.gauss.description='Two magnetic slugs fire in sequence; each can pierce two aligned rooms.';
  MODULES.missile.description='Automatically launches at enemies anywhere in the arena, clears your hull, then homes and explodes.';
  MODULES.swarm.description='Four guided rockets launch in sequence, then track enemies anywhere in the arena.';
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
  const BUYABLE = [...ENGINE_TYPES,...WEAPON_TYPES,'ammoAssembly','shield','focusShield','generator','teleporter','droneControl','droneAssembly','armor'];
  const CREW = [
    { id: 'vega', name: 'VEGA', initial: 'V', color: '#f4bd77', task: 'gun', x: 5.5, y: 4.5 },
    { id: 'moss', name: 'MOSS', initial: 'M', color: '#8fddb5', task: 'repair', x: 6.5, y: 4.5 },
    { id: 'iris', name: 'IRIS', initial: 'I', color: '#c4acf1', task: 'load', x: 5.5, y: 5.5 }
  ];
  const TASKS = { pilot:'Pilot ship', engine:'Operate engines', gun: 'Operate weapons', shield: 'Operate shields', repair: 'Repair systems', load: 'Deliver ammo / drones', drone:'Deliver drones', idle: 'Stand by' };
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
    const count=4+Math.floor(Math.random()*5);
    for(let i=0;i<count;i++){
      const type=BUYABLE[Math.floor(Math.random()*BUYABLE.length)],existing=stock.find((offer)=>offer.type===type);
      if(existing)existing.qty++;else stock.push({type,qty:1,price:Math.max(1,MODULES[type].cost+Math.floor(rand(-5,11)))});
    }
    return ensureDroneStock(stock);
  }
  function ensureDroneStock(stock){
    for(const type of ['droneControl','droneAssembly'])if(!stock.some((offer)=>offer.type===type))stock.push({type,qty:1,price:MODULES[type].cost});
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
    save.crew.push({id:crewId,name:recruit.name,initial:recruit.initial,color:recruit.color,task:'idle',hp:100,hurtTime:0,...point});
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
      nodes.push({id:`${col}-${row}`,col,row,mapX:80+col*168+rand(-16,16),mapY:110+row*190+rand(-31,31),type,variant,links:[],stockVersion:type==='trader'?10:undefined,stock:type==='trader'?traderStock():undefined});
    }
    nodes.push({id:'5-1',col:5,row:1,mapX:920,mapY:300,type:'exit',links:[]});
    return reshapeMap({version:2,base,nodes,current:'0-1',visited:['0-1'],resolved:['0-1']});
  }
  function reshapeMap(map){
    const nodes=map.nodes,heading=rand(0,TAU),start=nodes.find((node)=>node.type==='start')||nodes[0],exit=nodes.find((node)=>node.type==='exit')||nodes.at(-1);
    Object.assign(start,{mapX:500+380*Math.cos(heading),mapY:300+225*Math.sin(heading)});
    Object.assign(exit,{mapX:500-380*Math.cos(heading),mapY:300-225*Math.sin(heading)});
    const placed=[start,exit];
    for(const node of nodes)if(node!==start&&node!==exit){
      let best=null,bestScore=-Infinity;
      for(let attempt=0;attempt<400;attempt++){
        const angle=rand(0,TAU),radius=Math.sqrt(Math.random()),point={x:500+330*radius*Math.cos(angle),y:300+205*radius*Math.sin(angle)};
        const score=Math.min(...placed.map((other)=>Math.hypot((point.x-other.mapX)/118,(point.y-other.mapY)/82)));
        if(score>bestScore){best=point;bestScore=score;}
        if(score>=1.1)break;
      }
      node.mapX=best.x;node.mapY=best.y;placed.push(node);
    }
    const byId=new Map(nodes.map((node)=>[node.id,node]));
    for(const node of nodes)node.links=[];
    const connect=(a,b)=>{if(!a.links.includes(b.id)){a.links.push(b.id);b.links.push(a.id);}};
    const crossed=(a,b)=>{
      const side=(p,q,r)=>(q.mapX-p.mapX)*(r.mapY-p.mapY)-(q.mapY-p.mapY)*(r.mapX-p.mapX);
      return nodes.some((c)=>c.links.some((id)=>{
        const d=byId.get(id);if(!d||c.id>=d.id||[c.id,d.id].includes(a.id)||[c.id,d.id].includes(b.id))return false;
        return side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0;
      }));
    };
    const linked=new Set([start]);
    while(linked.size<nodes.length){
      let best=null,shortest=Infinity;
      for(const a of linked)for(const b of nodes)if(!linked.has(b)){
        const d=distance({x:a.mapX,y:a.mapY},{x:b.mapX,y:b.mapY});
        if(d<shortest){best=[a,b];shortest=d;}
      }
      connect(...best);linked.add(best[1]);
    }
    const shuffled=[...nodes];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    for(const node of shuffled){
      const candidates=nodes.filter((other)=>other!==node&&!node.links.includes(other.id))
        .sort((a,b)=>Math.hypot(node.mapX-a.mapX,node.mapY-a.mapY)-Math.hypot(node.mapX-b.mapX,node.mapY-b.mapY));
      for(const other of candidates){
        if(node.links.length>=2&&!(node.links.length<4&&other.links.length<4&&Math.random()<.28))break;
        if(Math.hypot(node.mapX-other.mapX,node.mapY-other.mapY)>330||crossed(node,other))continue;
        connect(node,other);break;
      }
    }
    map.version=3;return map;
  }
  function commandCore(data=save){return data.modules.find((module)=>module.type==='core');}
  function systemDemand(module){const def=MODULES[module.type];return module.type==='ammoAssembly'||ENGINE_TYPES.includes(module.type)||def.range||SHIELD_TYPES.includes(module.type)||['teleporter','droneControl','droneAssembly'].includes(module.type)?2:0;}
  function coreOutput(data=save){return commandCore(data)?.hp>0?8+2*((data.reactorLevel||1)-1):0;}
  function generatorOutput(module){const base=MODULES[module.type].generation;return module.hp>0&&base?base+module.level-1:0;}
  function auxiliaryOutput(data=save){return data.modules.reduce((sum,module)=>sum+generatorOutput(module),0);}
  function totalPower(data=save){return coreOutput(data)+auxiliaryOutput(data);}
  function poweredSystems(data=save){return data.modules.filter((module)=>module.hp>0&&systemDemand(module));}
  function sharedPower(data=save){const count=poweredSystems(data).length;return count?Math.min(2,totalPower(data)/count):0;}
  function powerUsed(){return poweredSystems().length*sharedPower();}
  function systemSupply(module){return module.hp>0&&systemDemand(module)?sharedPower():0;}
  function systemPower(module){return systemDemand(module)?systemSupply(module)/2:module.hp>0?1:0;}
  function normalizeSystems(data){
    const core=commandCore(data),valid=(level)=>Number.isInteger(level)&&level>0?level:1;
    if(data.powerVersion!==2)data.reactorLevel=Math.max(valid(data.reactorLevel),valid(core?.powerLevel));
    else data.reactorLevel=valid(data.reactorLevel);
    data.powerVersion=2;
    for(const module of data.modules){delete module.power;delete module.powerLevel;if(module.type==='focusShield')module.shieldFacing=shieldDirection(module);}
  }
  function canUpgradeCorePower(cost){return mode!=='combat'&&commandCore()?.hp>0&&save.metal>=cost;}
  function upgradeCorePower(){
    const core=commandCore(),cost=40+20*((save.reactorLevel||1)-1);
    if(!canUpgradeCorePower(cost))return false;
    save.metal-=cost;save.reactorLevel=(save.reactorLevel||1)+1;persist();renderAll();toast('Ship reactor upgraded · +2 shared power');return true;
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
    const count=poweredSystems().length,share=sharedPower(),cost=40+20*((save.reactorLevel||1)-1);
    panel.innerHTML=`<div class="reactor-summary"><strong>SHIP POWER · ${totalPower()}</strong><span>REACTOR LV ${save.reactorLevel||1} · ${coreOutput()} + GENERATORS ${auxiliaryOutput()}<br>AUTO SHARE · ${count} SYSTEMS · ${share.toFixed(2)} EACH<br>${Math.round(evasionChance()*100)}% EVADE</span></div><button id="upgradeCorePower" type="button" ${!canUpgradeCorePower(cost)?'disabled':''}>UPGRADE REACTOR +2 · ◆ ${cost}</button><div class="power-rows">${save.modules.filter((module)=>systemDemand(module)).map((module)=>{
      const performance=systemPower(module),shield=SHIELD_TYPES.includes(module.type),stats=shield?shieldStats(module):null;
      const strength=shield?(battle?shieldState(module).charge:module.hp>0?stats.capacity:0):0;
      return `<div class="power-row"><span title="Grid ${module.x}, ${module.y}">${MODULES[module.type].name} <small>(${module.x}, ${module.y})</small></span><strong>${module.hp>0?`${Math.round(performance*100)}% POWER`:'OFFLINE'}</strong><div class="power-meter" role="meter" aria-label="${MODULES[module.type].name} performance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(performance*100)}"><span style="width:${performance*100}%"></span></div>${shield?`<span class="shield-strength">SHIELD ${Math.round(strength)} / ${stats.capacity}</span><div class="power-meter shield-meter"><span style="width:${strength/stats.capacity*100}%"></span></div>`:''}</div>`;
    }).join('')}</div><small>The ship reactor and generators share power evenly. Reactor upgrades are separate from command-room hull upgrades. Lower power slows weapons, engine thrust, shield recharge, drone actions, and teleporter recharge.</small>`;
    const rows=panel.querySelector?.('.power-rows');if(rows)rows.scrollTop=scrollTop;
    $('upgradeCorePower').addEventListener('click',upgradeCorePower);
  }

  function retireAmmoHolds(data){
    for(const module of data.modules)if(module.type==='cargo'){
      // Keep all occupied cells, even for rotated/mirrored legacy rooms.
      const old=module.footprint||{shape:[[0,0],[1,0],[2,0]]};
      module.type='armor';module.footprint={...old,station:null,mount:null,muzzle:null};
    }
    if(data.inventory){
      const held=data.inventory.cargo;
      if(Number.isFinite(held)&&held>0)data.inventory.armor=(data.inventory.armor||0)+Math.floor(held);
      delete data.inventory.cargo;
    }
    for(const node of data.map?.nodes||[])if(Array.isArray(node.stock))node.stock=node.stock.filter((item)=>item.type!=='cargo');
  }
  function normalizeAmmo(data){
    const count=(n)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
    if(data.ammoVersion!==1){
      data.ammunition={heavy:8,missile:4};
      const crates=count(data.ammoCrates);data.ammunition.heavy+=crates*8;data.ammunition.missile+=crates*4;
      data.ammoVersion=1;
    }
    data.ammunition??={};
    delete data.ammunition.supplies;
    for(const node of data.map?.nodes||[])delete node.supplyPacks;
    for(const key of ['heavy','missile'])data.ammunition[key]=count(data.ammunition[key]);
    delete data.ammoCrates;
    for(const module of data.modules){
      const def=MODULES[module.type];
      if(def.ammoType)module.magazine=Math.min(def.magazine,count(module.magazine));
      if(module.type==='ammoAssembly'){
        if(!AMMO[module.ammoRecipe])module.ammoRecipe='heavy';
        module.ammoStock??={};for(const type of Object.keys(AMMO))module.ammoStock[type]=count(module.ammoStock[type]);
        module.ammoProgress=Number.isFinite(module.ammoProgress)?clamp(module.ammoProgress,0,4):0;
      }
    }
    for(const person of data.crew)if(person.carrying){
      if(!AMMO[person.carrying.type]||!count(person.carrying.amount))delete person.carrying;
      else person.carrying.amount=Math.min(4,count(person.carrying.amount));
    }
  }
  function magazineCount(module){return Math.max(0,Math.min(MODULES[module.type].magazine||0,Math.floor(module.magazine||0)));}
  function ammoLabel(def){return def.ammoType?`${def.ammo} ${def.ammoType.toUpperCase()} / TRIGGER`:'NO AMMO';}
  function recoverAmmoCrate(){
    const stock=save.ammunition;stock.heavy+=8;stock.missile+=4;
    persist();return '8 heavy rounds and 4 missile rounds added to your stores.';
  }
  function updateAmmoProduction(dt){
    for(const assembly of activeModules('ammoAssembly')){
      const type=assembly.ammoRecipe||'heavy',recipe=AMMO[type];assembly.ammoStock??={heavy:0,missile:0};
      const power=systemPower(assembly);
      if(power<=0||(assembly.ammoStock[type]||0)+recipe.batch>24)continue;
      assembly.ammoProgress=(assembly.ammoProgress||0)+dt*power*(1+(assembly.level-1)*.25);
      if(assembly.ammoProgress>=4){
        assembly.ammoProgress-=4;assembly.ammoStock[type]=(assembly.ammoStock[type]||0)+recipe.batch;persist();
      }
    }
  }
  function ammoSources(type){
    const stores=save.ammunition;
    return [...activeModules('ammoAssembly').filter((module)=>(module.ammoStock?.[type]||0)>0).map((module)=>({module,stock:module.ammoStock})),
      ...activeModules('core').filter(()=>stores[type]>0).map((module)=>({module,stock:stores}))];
  }
  function reachableAmmoSources(person,type){
    return ammoSources(type).filter(({module})=>{const point=moduleStation(module);return distance(person,point)<.12||walkPath(person,point).length>0;})
      .sort((a,b)=>distance(person,moduleStation(a.module))-distance(person,moduleStation(b.module)));
  }
  function renderAmmo(){
    const panel=$('ammoPanel');if(!panel)return;
    const stores=$('ammoStores');if(stores)stores.textContent=`H ${save.ammunition.heavy} · M ${save.ammunition.missile}`;
    const stock=save.ammunition,assemblies=save.modules.filter((room)=>room.type==='ammoAssembly'),weapons=save.modules.filter((room)=>MODULES[room.type].ammoType);
    panel.innerHTML=`<strong>POWERED AMMO PRODUCTION</strong><p class="muted small">Power → assembly → crew → magazine. Assign Deliver ammo / drones; empty magazines stop firing.</p><div class="ammo-stores">HEAVY ${stock.heavy} · MISSILE ${stock.missile}<small>Recovered stock · pickup at command core</small></div>${assemblies.map((room)=>`<div class="ammo-row"><strong>ASSEMBLY ${room.id} · ${(room.ammoRecipe||'heavy').toUpperCase()}</strong><small>${room.hp<=0?'OFFLINE':systemPower(room)<=0?'NO POWER':(room.ammoStock?.[room.ammoRecipe||'heavy']||0)+AMMO[room.ammoRecipe||'heavy'].batch>24?'OUTPUT FULL':`${Math.floor((room.ammoProgress||0)/4*100)}% · ${Math.round(systemPower(room)*100)}% POWER`} · STOCK H ${room.ammoStock?.heavy||0} / M ${room.ammoStock?.missile||0}</small></div>`).join('')}${assemblies.length?'':'<p class="muted small">Buy an Ammo Assembly at a trader to make rounds.</p>'}${weapons.map((room)=>`<div class="ammo-row"><strong>${MODULES[room.type].name}</strong><small>${MODULES[room.type].ammoType.toUpperCase()} MAG ${magazineCount(room)} / ${MODULES[room.type].magazine}${room.hp<=0?' · OFFLINE':magazineCount(room)<MODULES[room.type].ammo?' · EMPTY · NEEDS LOADER':''}</small></div>`).join('')}${weapons.length?'':'<p class="muted small">Current weapons are ammo-free.</p>'}`;
  }
  const STARTER_SHIPS = [
    {id:'wayfarer',name:'Wayfarer',role:'LIGHT PATROL',description:'Twin pulse cannons. Ammo-free weapons and agile handling.'},
    {id:'arsenal',name:'Arsenal',role:'MISSILE FRIGATE',description:'Twin missile racks, two upgraded missile assemblies and two loaders. Six crew.'},
    {id:'bulwark',name:'Bulwark',role:'HEAVY GUNSHIP',description:'Twin railguns, two heavy-ammo assemblies and two loaders. Six crew.'},
    {id:'drones',name:'Drones',role:'DRONE CARRIER',description:'Combat and beam drones, two assemblies, an exterior bay and two drone carriers. Laser support and five crew.'}
  ];
  function starterModules(starterId){
    const rooms=[['core',5,4,0],['engine',4,2,0],['engine',4,5,0]];
    if(starterId==='arsenal')rooms.push(['missile',6,2,0],['missile',6,6,0],['generator',7,4,1],['ammoAssembly',5,6,0],['ammoAssembly',5,2,0],['shield',8,4,0]);
    else if(starterId==='bulwark')rooms.push(['railgun',5,2,0],['railgun',5,7,0],['ammoAssembly',5,3,1],['ammoAssembly',5,6,1],['shield',7,4,0]);
    else if(starterId==='drones')rooms.push(['droneAssembly',5,2,0],['droneAssembly',5,6,0],['droneControl',7,4,0],['laser',7,2,0],['generator',7,3,0],['shield',7,6,0]);
    else rooms.push(['weapon',6,3,0],['weapon',6,5,1],['shield',8,4,0]);
    return rooms.map(([type,x,y,rotation],i)=>({id:i+1,type,x,y,rotation,hp:MODULES[type].hp+(type==='ammoAssembly'&&starterId==='arsenal'?25:0),level:type==='ammoAssembly'&&starterId==='arsenal'?2:1,...(i===4&&starterId==='wayfarer'?{weaponFacing:1}:{}),...(type==='ammoAssembly'?{ammoRecipe:starterId==='arsenal'?'missile':'heavy'}:{}),...(type==='droneAssembly'?{droneType:y===2?'combat':'beam'}:{}),...(MODULES[type].ammoType?{magazine:MODULES[type].magazine}:{})}));
  }
  function starterCrew(starterId){
    const people=CREW.map((person)=>({...person,hp:100,hurtTime:0}));
    if(starterId==='drones'){
      const modules=starterModules(starterId),assemblies=modules.filter((room)=>room.type==='droneAssembly');
      Object.assign(people[0],moduleStation(modules.find((room)=>room.type==='laser')));
      Object.assign(people[1],{x:6.5,y:5.5});Object.assign(people[2],moduleStation(assemblies[0]),{task:'drone'});
      people.push({id:'lyra',name:'LYRA',initial:'L',color:'#ea9baf',task:'drone',hp:100,hurtTime:0,...moduleStation(assemblies[1])},
        {id:'nova',name:'NOVA',initial:'N',color:'#efc27c',task:'pilot',hp:100,hurtTime:0,...moduleStation(modules[0])});
    }else if(starterId!=='wayfarer'){
      const modules=starterModules(starterId),weapons=modules.filter((room)=>MODULES[room.type].ammoType),factories=modules.filter((room)=>room.type==='ammoAssembly');
      Object.assign(people[0],moduleStation(weapons[0]));
      Object.assign(people[2],moduleStation(factories[1]));
      people.push({id:'orion',name:'ORION',initial:'O',color:'#81cee4',task:'gun',hp:100,hurtTime:0,...moduleStation(weapons[1])},
        {id:'lyra',name:'LYRA',initial:'L',color:'#ea9baf',task:'load',hp:100,hurtTime:0,...moduleStation(factories[0])},
        {id:'nova',name:'NOVA',initial:'N',color:'#efc27c',task:'pilot',hp:100,hurtTime:0,...moduleStation(modules[0])});
    }
    return people;
  }
  function newSave(starterId='wayfarer') {
    if(!STARTER_SHIPS.some((ship)=>ship.id===starterId))starterId='wayfarer';
    const modules=starterModules(starterId);
    const data={metal:90,sector:1,wins:0,nextId:modules.length+1,starterId,starterLayoutVersion:2,weaponFootprintsVersion:2,inventory:{ion:1},passengers:0,
      modules,crew:starterCrew(starterId),map:makeMap(1)};
    data.drones=[];
    if(starterId==='drones'){
      data.reactorLevel=2;const bay=modules.find((room)=>room.type==='droneControl');
      data.drones=modules.filter((room)=>room.type==='droneAssembly').map((assembly,i)=>({id:i+1,assembly:assembly.id,bay:bay.id,type:assembly.droneType,hp:60,phase:'ready',cooldown:.5,angle:0,path:[],...moduleStation(bay)}));data.nextDroneId=2;
    }
    normalizeSystems(data);normalizeAmmo(data);return data;
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
      if(data.map?.version===2)reshapeMap(data.map);
      else if(data.map?.version!==3)data.map=makeMap(data.sector||1);
      if(!data.inventory||typeof data.inventory!=='object')data.inventory={};
      retireAmmoHolds(data);
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
      normalizeSystems(data);normalizeCrew(data);normalizeAmmo(data);
      return data;
    } catch (_) { return null; }
  }

  const missileLaunchCache=new WeakMap();
  const droneFlightCache=new WeakMap();
  const DRONE_PROGRAMS={combat:{name:'Combat',color:'#efb77d'},beam:{name:'Beam',color:'#ed967e'},defense:{name:'Defense',color:'#89ddd8'},repair:{name:'Repair',color:'#a6ddb0'},boarding:{name:'Boarding',color:'#d8a2df'}};
  function crewAlive(person){return person.hp===undefined||person.hp>0;}
  function crewHome(person){return crewAlive(person)&&!person.aboard;}
  function normalizeCrew(data){
    normalizeDrones(data);
    for(const person of data.crew){
      person.hp=Number.isFinite(person.hp)?clamp(person.hp,0,100):100;
      person.hurtTime=Number.isFinite(person.hurtTime)?Math.max(0,person.hurtTime):0;
      delete person.aboard;delete person.boardOrder;delete person.manualGoal;
    }
  }
  const storedSave = loadSave();
  let save = storedSave || newSave(), hasSave = !!storedSave, screen = 'menu', mode = 'hangar', selectedCatalog = null, selectedModuleId = 1;
  let movingModuleId=null, refittingFootprint=false, selectedCrewId=null;
  let rearrangingShip=false, roomDrag=null, suppressBuildClick=false;
  const BUILD_ZOOMS=[.4,.5,.65,.8,1,1.25,1.6,2];
  const buildView={x:0,y:0,cols:GRID_W,rows:GRID_H,zoomIndex:4};
  const COMBAT_ZOOMS=[1,1.25,1.5,1.75,2,2.5];
  let combatZoomIndex=0;
  let tradeNode=null, marketFilter='all';
  let buildRotation = 0, buildWeaponFacing = 0, buildFlipped = false, hoverCell = null, battle = null, eventOpen = false, pendingNodeId = null;
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
  function rotatedGeometry(type, rotation,layout=MODULES[type],flipped=false) {
    const transform=([x,y])=>rotateRaw(flipped?-x:x,y,rotation);
    const def = layout, raw = def.shape.map(transform);
    const minX = Math.min(...raw.map(([x]) => x)), minY = Math.min(...raw.map(([,y]) => y));
    const turn = ([x,y]) => { const [rx,ry] = transform([x,y]); return [rx-minX,ry-minY]; };
    // Cell indices rotate about their centers; muzzle coordinates lie on cell edges.
    const turnPoint = ([x,y]) => { const [rx,ry] = transform([x-.5,y-.5]); return [rx+.5-minX,ry+.5-minY]; };
    return { cells: raw.map(([x,y]) => [x-minX,y-minY]), station: def.station && turn(def.station), mount: def.mount && turn(def.mount), muzzle: def.muzzle && turnPoint(def.muzzle), door:def.door&&turnPoint(def.door) };
  }
  function moduleGeometry(module){return rotatedGeometry(module.type,module.rotation,module.footprint||MODULES[module.type],!!module.flipped);}
  function placementFootprint(type){return !refittingFootprint&&movingModuleId!==null?save.modules.find((module)=>module.id===movingModuleId&&module.type===type)?.footprint:null;}
  function placementFlipped(type){return !!MODULES[type].range&&buildFlipped;}
  function placementGeometry(type,rotation){return rotatedGeometry(type,rotation,placementFootprint(type)||MODULES[type],placementFlipped(type));}
  function weaponRange(module) {
    if(MODULES[module.type].guidance)return Infinity;
    const maximum=MODULES[module.type].range;
    return Number.isFinite(module.range)?clamp(module.range,30,maximum):maximum;
  }
  function weaponFacingQuarter(module){
    const facing=MODULES[module.type].mountFacings===2&&module.weaponFacing===1?-1:0;
    return (module.rotation+(module.flipped?2-facing:facing)+4)%4;
  }
  function weaponGeometry(module) {
    const geometry=moduleGeometry(module),direction=weaponFacingQuarter(module)*Math.PI/2;
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
    if(!cells.size)return false;
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
        const candidate={...moving,x,y,rotation,weaponFacing:buildWeaponFacing,flipped:placementFlipped(type),footprint:refittingFootprint?null:moving.footprint};
        return canPlaceFootprint(type,x,y,rotation,candidate.footprint,mode!=='trade')&&(mode==='trade'||connectedHull([...save.modules,candidate]))&&weaponsHaveClearArc([...save.modules,candidate])&&droneLanesPreserved([...save.modules,candidate],original);
      } finally {save.modules=original;}
    }
    if(!canPlaceFootprint(type,x,y,rotation))return false;
    const modules=[...save.modules,{type,x,y,rotation,weaponFacing:buildWeaponFacing,flipped:placementFlipped(type)}];
    return weaponsHaveClearArc(modules)&&droneLanesPreserved(modules,save.modules);
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
  function centerBuildView(redraw=true){const b=shipBounds();buildView.x=Math.floor(b.cx-buildView.cols/2);buildView.y=Math.floor(b.cy-buildView.rows/2);hoverCell=null;if(redraw)renderGrid();}
  function zoomBuild(direction,anchorX=.5,anchorY=.5){
    const next=clamp(buildView.zoomIndex+direction,0,BUILD_ZOOMS.length-1);
    if(next===buildView.zoomIndex)return;
    const ax=clamp(anchorX,0,1),ay=clamp(anchorY,0,1);
    const focusX=buildView.x+ax*buildView.cols,focusY=buildView.y+ay*buildView.rows;
    buildView.zoomIndex=next;buildView.cols=Math.round(GRID_W/BUILD_ZOOMS[next]);buildView.rows=Math.round(GRID_H/BUILD_ZOOMS[next]);
    buildView.x=Math.floor(focusX-ax*buildView.cols);buildView.y=Math.floor(focusY-ay*buildView.rows);
    hoverCell={x:Math.floor(buildView.x+ax*buildView.cols),y:Math.floor(buildView.y+ay*buildView.rows)};
    rebuildGridCells();renderGrid();
  }

  function moduleClearance(module){
    if(ENGINE_TYPES.includes(module.type)){
      const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][module.rotation],cells=moduleCells(module);
      const own=new Set(cells.map(([x,y])=>`${x},${y}`));
      const station=moduleGeometry(module).station;
      // The standard engine's two nozzles share its middle cell. Its outer
      // cells have no exhaust, so rooms may sit beside that central plume.
      const rear=module.type==='heavyEngine'
        ?cells.filter(([x,y])=>!own.has(`${x-dx},${y-dy}`)).map(([x,y])=>[x-dx,y-dy])
        :[[module.x+station[0]-dx,module.y+station[1]-dy]];
      rear.push([module.x+station[0]-2*dx,module.y+station[1]-2*dy]);
      return rear;
    }
    if(module.type==='droneControl'){const door=droneBayDoor(module),dx=Math.cos(door.direction),dy=Math.sin(door.direction);return [0,1].map((step)=>[Math.floor(door.x+dx*(step+1e-7)),Math.floor(door.y+dy*(step+1e-7))]);}
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
  function canPlaceFootprint(type,x,y,rotation,footprint=null,requireConnection=true) {
    const occupied=occupancy(),candidate={type,x,y,rotation,weaponFacing:buildWeaponFacing,flipped:placementFlipped(type),footprint},cells=moduleCells(candidate);
    if(cells.some(([cx,cy])=>occupied.has(`${cx},${cy}`)))return false;
    const reserved=new Set(save.modules.flatMap(moduleClearance).map(([cx,cy])=>`${cx},${cy}`));
    if(cells.some(([cx,cy])=>reserved.has(`${cx},${cy}`)))return false;
    if(requireConnection&&!cells.some(([cx,cy])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>occupied.has(`${cx+dx},${cy+dy}`))))return false;
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

  function buildPointerPoint(event){
    const rect=$('buildGrid').getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>=rect.right||event.clientY<rect.top||event.clientY>=rect.bottom)return null;
    return {x:buildView.x+Math.floor((event.clientX-rect.left)/rect.width*buildView.cols),y:buildView.y+Math.floor((event.clientY-rect.top)/rect.height*buildView.rows)};
  }
  function startRoomDrag(event){
    suppressBuildClick=false;
    if(mode!=='trade'||selectedCatalog||event.button!==0||event.pointerType==='touch')return;
    const point=buildPointerPoint(event),module=point&&occupancy().get(`${point.x},${point.y}`);
    if(!module)return;
    roomDrag={id:module.id,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX:point.x-module.x,offsetY:point.y-module.y,active:false};
  }
  function updateRoomDrag(event){
    const drag=roomDrag;if(!drag||drag.pointer!==event.pointerId||mode!=='trade')return;
    if(!drag.active){
      if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<5)return;
      selectedModuleId=drag.id;if(!beginModuleMove()){roomDrag=null;return;}
      drag.active=true;$('buildGrid').setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();const point=buildPointerPoint(event);
    hoverCell=point?{x:point.x-drag.offsetX,y:point.y-drag.offsetY}:null;renderGrid();
  }
  function finishRoomDrag(event){
    const drag=roomDrag;if(!drag||drag.pointer!==event.pointerId)return;
    roomDrag=null;if(!drag.active)return;
    event.preventDefault();suppressBuildClick=true;
    const grid=$('buildGrid');if(grid.hasPointerCapture?.(event.pointerId))grid.releasePointerCapture(event.pointerId);
    const point=buildPointerPoint(event);
    if(mode==='trade'&&point)onGridClick(point.x-drag.offsetX,point.y-drag.offsetY);else cancelRoomMove();
  }
  function cancelRoomMove(){
    if(movingModuleId===null)return false;
    roomDrag=null;movingModuleId=null;selectedCatalog=null;refittingFootprint=false;hoverCell=null;renderAll();return true;
  }
  function toggleRearrangeShip(){
    if(mode!=='trade')return false;
    roomDrag=null;movingModuleId=null;selectedCatalog=null;refittingFootprint=false;selectedCrewId=null;hoverCell=null;
    rearrangingShip=!rearrangingShip;renderAll();return true;
  }
  function renderRefitControls(){
    const moving=save.modules.find((module)=>module.id===movingModuleId),grid=$('buildGrid'),disconnected=!connectedHull(save.modules);
    $('leaveTrader').disabled=disconnected;
    $('leaveTrader').title=disconnected?'Reconnect every room before leaving the trader.':'';
    $('rearrangeShip').textContent=rearrangingShip?'FINISH REARRANGING':'REARRANGE SHIP · FREE';
    $('rearrangeShip').setAttribute('aria-pressed',String(rearrangingShip));
    $('cancelRoomMove').hidden=!moving;
    $('refitStatus').textContent=(disconnected?'ROOMS DISCONNECTED · Reconnect every room by an edge before leaving. ':'')+(moving?`Moving ${MODULES[moving.type].name}. Click clear space to place it. Q / E rotate${MODULES[moving.type].range?' · F flips':''}. Escape cancels.`:rearrangingShip?'Click a room to pick it up, then click its new position. Temporary gaps are allowed while docked.':'Drag any room to move it, or choose Rearrange Ship to use clicks. Temporary gaps are allowed while docked.');
    grid.classList[mode==='trade'&&rearrangingShip?'add':'remove']('rearranging-ship');
    grid.classList[moving?'add':'remove']('moving-room');
  }

  function rebuildGridCells(){
    const grid=$('buildGrid');
    grid.textContent='';gridButtons.length=0;
    const stack=$('shipGridStack');
    stack.style.setProperty('--view-cols',buildView.cols);
    stack.style.setProperty('--view-rows',buildView.rows);
    stack.style.setProperty('--build-zoom',BUILD_ZOOMS[buildView.zoomIndex]);
    for(let y=0;y<buildView.rows;y++)for(let x=0;x<buildView.cols;x++){
      const cell=document.createElement('button');cell.type='button';cell.className='grid-cell';cell.setAttribute('role','gridcell');
      cell.dataset.x=x;cell.dataset.y=y;
      const point=()=>({x:+cell.dataset.x,y:+cell.dataset.y});
      cell.addEventListener('mouseenter',()=>{hoverCell=point();renderGrid();});
      cell.addEventListener('focus',()=>{hoverCell=point();renderGrid();});
      cell.addEventListener('click',(event)=>{const p=point(),rect=cell.getBoundingClientRect(),click={x:p.x+(event.clientX-rect.left)/rect.width,y:p.y+(event.clientY-rect.top)/rect.height};const person=!selectedCatalog&&!(mode==='trade'&&rearrangingShip)&&save.crew.find((person)=>crewHome(person)&&distance(person,click)<.32);if(person){selectCrew(person.id);return;}onGridClick(p.x,p.y);});
      cell.addEventListener('contextmenu',(event)=>{event.preventDefault();const p=point();orderCrewMove(p.x,p.y);});
      grid.append(cell);gridButtons.push(cell);
    }
  }
  function createGrid() {
    const grid=$('buildGrid');rebuildGridCells();
    grid.addEventListener('pointerdown',startRoomDrag);
    grid.addEventListener('pointermove',updateRoomDrag);
    grid.addEventListener('pointerup',finishRoomDrag);
    grid.addEventListener('pointercancel',()=>{const active=roomDrag?.active;roomDrag=null;if(active)cancelRoomMove();});
    grid.addEventListener('click',(event)=>{if(suppressBuildClick&&event.detail){suppressBuildClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
    grid.addEventListener('mouseleave',()=>{hoverCell=null;renderGrid();});
    let wheelAccum=0;
    $('buildViewport').addEventListener('wheel',(event)=>{
      event.preventDefault();wheelAccum+=(event.deltaMode===1?event.deltaY*16:event.deltaY);
      if(Math.abs(wheelAccum)<50)return;
      const rect=grid.getBoundingClientRect(),inside=event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
      const ax=inside?(event.clientX-rect.left)/rect.width:.5,ay=inside?(event.clientY-rect.top)/rect.height:.5;
      zoomBuild(wheelAccum<0?1:-1,ax,ay);wheelAccum=0;
    },{passive:false});
    document.querySelectorAll('[data-pan]').forEach((button)=>button.addEventListener('click',()=>{const [x,y]=button.dataset.pan.split(',').map(Number);panBuild(x,y);}));
    $('centerBuild').addEventListener('click',()=>centerBuildView());
  }

  function weaponBehavior(type){
    const d=MODULES[type],rules=[];
    if(d.beamDuration)rules.push(`Left-to-right sweep · ${d.beamDuration}s · ${d.damage} per room once · ${+(d.damage/3).toFixed(2)} shield damage (⅓)`);
    if(d.burstInterval)rules.push(`${d.salvo} rounds · ${d.burstInterval}s apart`);
    else if(d.salvo>1)rules.push(`${d.salvo}-shot spread`);
    if(d.guidance)rules.push('Unlimited range · Homing after hull clearance');
    else if(d.family==='missile')rules.push('Unguided explosive');
    if(d.splash)rules.push(`Blast radius ${d.splash}`);
    if(d.ion)rules.push(`${d.systemPulse?'Nearby systems':'Struck system'} ${Math.round(d.ion*100)}% for ${d.ionDuration}s`);
    if(d.systemPulse)rules.push(`System pulse radius ${d.systemPulse}`);
    if(d.chainSystems)rules.push(`Up to ${d.chainSystems+1} systems · ${Math.round(d.chainFalloff*100)}% per hop`);
    if(d.slow)rules.push(`Movement ${Math.round(d.slow*100)}% for ${d.slowDuration}s`);
    if(d.burn)rules.push(`Burn ${d.burn}/s for ${d.burnDuration}s`);
    if(d.chain)rules.push(`Chain within ${d.chain} · 50% damage`);
    if(d.pierce)rules.push(`Pierces up to ${d.pierce+1} aligned rooms`);
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
    movingModuleId=null;rearrangingShip=false;roomDrag=null;selectedCatalog=type;buildFlipped=false;selectedModuleId=null;persist();log(`${MODULES[type].name} purchased at a trader.`);renderAll();toast('Purchased · choose a clear hull position to install');return true;
  }
  function renderCatalog() {
    if(mode!=='trade'||!tradeNode){$('catalog').innerHTML='';return;}
    $('marketFilters').querySelectorAll('button').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.filter===marketFilter)));
    const stock=tradeNode.stock||[],types=BUYABLE.filter((type)=>stock.some((item)=>item.type===type)||(save.inventory[type]||0)>0);
    const visible=types.filter((type)=>marketFilter==='all'||(marketFilter==='crew'?false:marketFilter==='drones'?['droneControl','droneAssembly'].includes(type):marketFilter==='shields'?SHIELD_TYPES.includes(type):(marketFilter==='weapons')===!!MODULES[type].range))
      .sort((a,b)=>Number(SHIELD_TYPES.includes(b))-Number(SHIELD_TYPES.includes(a)));
    $('marketSummary').textContent=`${stock.filter((item)=>item.qty>0).length} PART OFFERS · ${(tradeNode.recruits||[]).filter((person)=>!person.hired).length} CREW FOR HIRE`;
    const partCards=visible.map((type)=>{
      const def=MODULES[type],held=save.inventory[type]||0,item=stock.find((entry)=>entry.type===type);
      return `<div class="catalog-item ${selectedCatalog===type?'active':''}">${miniShape(type)}<div class="market-description"><strong>${def.name.toUpperCase()}</strong><small>${def.description}</small>${def.thrust?`<small class="weapon-fit">${footprintBadge(type)}</small><small class="weapon-spec">${def.thrust} BASE THRUST · 2 POWER AT FULL OUTPUT</small>`:''}${def.range?`<small class="weapon-fit">${footprintBadge(type)}</small><small class="weapon-spec">${def.damage} DMG × ${def.salvo||1} · ${def.reload}s · ${def.guidance?'UNLIMITED RANGE':`${def.range} RANGE`} · ${def.arc}°${def.guidance?' LAUNCH · AUTO TRACK':''} · ${ammoLabel(def)}</small>`:''}<small class="weapon-rules">${def.range?weaponBehavior(type):''}</small><small>${held} IN HOLD${item?` · ${item.qty} IN STOCK`:''}</small><div class="market-actions">${item?`<button type="button" data-buy="${type}" ${item.qty<1||save.metal<item.price?'disabled':''}>${item.qty?`BUY ◆ ${item.price}`:'SOLD OUT'}</button>`:''}${held?`<button type="button" data-install="${type}" aria-pressed="${selectedCatalog===type}">${selectedCatalog===type?'CANCEL':'INSTALL HELD'}</button>`:''}</div></div></div>`;
    }).join('');
    $('catalog').innerHTML=(partCards+recruitCards())||'<p class="muted small">No offers in this category at this trader.</p>';
    $('catalog').querySelectorAll('[data-recruit]').forEach((button)=>button.addEventListener('click',()=>buyRecruit(button.dataset.recruit)));
    $('catalog').querySelectorAll('[data-buy]').forEach((button)=>button.addEventListener('click',()=>buyTraderItem(button.dataset.buy)));
    $('catalog').querySelectorAll('[data-install]').forEach((button)=>button.addEventListener('click',()=>{movingModuleId=null;rearrangingShip=false;roomDrag=null;selectedCatalog=selectedCatalog===button.dataset.install?null:button.dataset.install;buildFlipped=false;selectedModuleId=null;renderAll();}));
    paintWeaponThumbnails($('catalog'));
    $('traderRepair').disabled=save.metal<15||hullRatio()>=.999;
  }
  function renderGrid() {
    const occupied=occupancy(),ghost=new Set(),reserved=new Map();let valid=false;
    for(const module of save.modules)for(const [rx,ry] of moduleClearance(module))reserved.set(`${rx},${ry}`,module.type);
    if(selectedCatalog&&hoverCell){const place=placementAt(selectedCatalog,hoverCell.x,hoverCell.y,buildRotation);valid=place.valid;for(const [dx,dy] of placementGeometry(selectedCatalog,buildRotation).cells)ghost.add(`${place.x+dx},${place.y+dy}`);}
    for(const [index,cell] of gridButtons.entries()){
      cell.dataset.x=buildView.x+index%buildView.cols;cell.dataset.y=buildView.y+Math.floor(index/buildView.cols);
      const x=+cell.dataset.x,y=+cell.dataset.y,key=`${x},${y}`,module=occupied.get(key);
      cell.className='grid-cell';cell.style.removeProperty('--module-color');cell.textContent='';
      if(module){cell.classList.add('occupied');if(module.id===selectedModuleId)cell.classList.add('selected');if(module.id===movingModuleId)cell.classList.add('moving-source');cell.style.setProperty('--module-color',MODULES[module.type].color);cell.setAttribute('aria-label',`${MODULES[module.type].name}, level ${module.level}, ${Math.ceil(module.hp)} health`);}
      else if(ghost.has(key)){cell.classList.add('ghost');if(!valid)cell.classList.add('invalid');cell.style.setProperty('--module-color',MODULES[selectedCatalog].color);cell.setAttribute('aria-label',`${MODULES[selectedCatalog].name} placement ${valid?'valid':'invalid'}`);}
      else if(reserved.has(key)){cell.classList.add('reserved');cell.setAttribute('aria-label',`${ENGINE_TYPES.includes(reserved.get(key))?'Engine exhaust':reserved.get(key)==='droneControl'?'Drone launch':'Weapon mount'} clearance, keep empty`);}
      else cell.setAttribute('aria-label',`Empty cell ${x+1}, ${y+1}`);
    }
    $('placementHint').textContent=mode!=='trade'?'CLICK A ROOM TO INSPECT · VISIT A TRADER TO REFIT':selectedCatalog?(hoverCell?(valid?(movingModuleId!==null?'CLICK TO MOVE ROOM':'CLICK TO INSTALL HELD MODULE'):'ROOMS NEED OPEN HULL SPACE AND CLEAR EXHAUST'):'HOVER OVER THE GRID TO INSTALL MODULE'):'CLICK A ROOM TO INSPECT OR MOVE · INSTALL STORED PARTS';
    $('buildWeaponFacing').hidden=!selectedCatalog||MODULES[selectedCatalog].mountFacings!==2;
    $('buildWeaponFacing').textContent=`MOUNT: ${['RIGHT','DOWN','LEFT','UP'][weaponFacingQuarter({type:selectedCatalog||'weapon',rotation:buildRotation,weaponFacing:buildWeaponFacing,flipped:buildFlipped})]} ↻`;
    $('buildFlipWeapon').hidden=!selectedCatalog||!MODULES[selectedCatalog].range;
    $('buildFlipWeapon').setAttribute('aria-pressed',String(buildFlipped));
    $('buildFlipWeapon').textContent=buildFlipped?'FLIP WEAPON ↔ · MIRRORED':'FLIP WEAPON ↔';
    $('buildCoordinates').textContent=`${Math.round(BUILD_ZOOMS[buildView.zoomIndex]*100)}% · X ${buildView.x}…${buildView.x+buildView.cols-1} · Y ${buildView.y}…${buildView.y+buildView.rows-1}`;
    renderRefitControls();drawHangar();
  }
  function onGridClick(x,y) {
    const existing=occupancy().get(`${x},${y}`);
    if(existing&&!selectedCatalog){selectedModuleId=existing.id;if(mode==='trade'&&rearrangingShip)beginModuleMove();else renderAll();return;}
    if(mode!=='trade'||!selectedCatalog){toast('Visit a trader to buy and install modules.');return;}
    const place=placementAt(selectedCatalog,x,y,buildRotation);
    if(!place.valid){toast(movingModuleId!==null?'Keep rooms clear of each other, exhaust, and weapon arcs.':'Connect rooms and keep exhaust and a weapon arc clear to space.');return;}
    if(movingModuleId!==null){
      const module=save.modules.find((part)=>part.id===movingModuleId),oldCells=new Set(moduleCells(module).map(([cx,cy])=>`${cx},${cy}`));
      const occupants=save.crew.filter((person)=>oldCells.has(`${Math.floor(person.x)},${Math.floor(person.y)}`));
      const floorDrones=(save.drones||[]).filter((drone)=>drone.phase==='stored'&&drone.pickupPoint&&oldCells.has(`${Math.floor(drone.pickupPoint.x)},${Math.floor(drone.pickupPoint.y)}`));
      Object.assign(module,{x:place.x,y:place.y,rotation:buildRotation,weaponFacing:buildWeaponFacing,flipped:placementFlipped(selectedCatalog)});
      if(refittingFootprint)delete module.footprint;refittingFootprint=false;
      for(const person of occupants)Object.assign(person,moduleStation(module));
      for(const drone of floorDrones){drone.pickupPoint=moduleStation(module);Object.assign(drone,drone.pickupPoint);}
      for(const id of Object.keys(crewRoutes))delete crewRoutes[id];
      selectedModuleId=module.id;movingModuleId=null;selectedCatalog=null;persist();renderAll();toast('Room moved');return;
    }
    const def=MODULES[selectedCatalog];if((save.inventory[selectedCatalog]||0)<1){toast('Buy this module from a trader first.');return;}
    const module={id:save.nextId++,type:selectedCatalog,x:place.x,y:place.y,rotation:buildRotation,weaponFacing:buildWeaponFacing,flipped:placementFlipped(selectedCatalog),hp:def.hp,level:1,...(selectedCatalog==='focusShield'?{shieldFacing:0}:{})};
    save.modules.push(module);save.inventory[selectedCatalog]--;selectedModuleId=module.id;selectedCatalog=null;
    persist();log(`${def.name} installed from the hold.`);toast(`${def.name} installed`);renderAll();
  }
  function beginModuleMove(refit=false){
    const module=selectedModule();if(mode!=='trade'||!module)return false;
    selectedCrewId=null;hoverCell={x:module.x,y:module.y};
    if(module.type==='focusShield')module.shieldFacing=shieldDirection(module);
    movingModuleId=module.id;refittingFootprint=refit;selectedCatalog=module.type;buildRotation=module.rotation;buildWeaponFacing=module.weaponFacing||0;buildFlipped=!!module.flipped;
    $('buildRotationLabel').textContent=`${buildRotation*90}°`;renderAll();return true;
  }
  function flipBuild(){
    if(mode!=='trade'||!selectedCatalog||!MODULES[selectedCatalog].range)return false;
    buildFlipped=!buildFlipped;renderGrid();return true;
  }
  function rotateBuild(step){buildRotation=(buildRotation+step+4)%4;$('buildRotationLabel').textContent=`${buildRotation*90}°`;renderGrid();}
  function renderInspector(){
    const module=selectedModule();
    if(!module){$('moduleInspector').innerHTML='<div class="empty-inspector">Click a ship room to inspect its station, firing arc, upgrade, or repair it.</div>';return;}
    const def=MODULES[module.type],maximum=maxHp(module),ratio=module.hp/maximum,upgradeCost=25*module.level+(module.type==='core'?10:0),repairCost=Math.ceil((maximum-module.hp)/10)*3;
    const direction=['RIGHT','DOWN','LEFT','UP'][def.range?weaponFacingQuarter(module):module.rotation];
    const shieldInfo=SHIELD_TYPES.includes(module.type)?`<div class="inspector-detail">${module.type==='shield'?'FULL HULL COVERAGE':`${def.arc}° LOCAL ARC · AIM ${shieldDirection(module)}°`} · ${module.type==='focusShield'?`${def.shieldRadius} RANGE FROM ROOM · `:''}${Math.round(battle?shieldState(module).charge:module.hp>0?shieldStats(module).capacity:0)} / ${shieldStats(module).capacity} STRENGTH · +${shieldStats(module).recharge.toFixed(1)}/s</div>`:null;
    const shieldAim=module.type==='focusShield'?`<label class="weapon-range">AIM SHIELD<select id="shieldDirection" aria-label="Shield direction">${[...new Set([0,45,90,135,180,225,270,315,shieldDirection(module)])].sort((a,b)=>a-b).map((degrees)=>`<option value="${degrees}" ${degrees===shieldDirection(module)?'selected':''}>${degrees}°${({0:' · RIGHT',90:' · DOWN',180:' · LEFT',270:' · UP'})[degrees]||''}</option>`).join('')}</select></label><div class="shield-aim-controls"><button data-shield-turn="-15" type="button" aria-label="Aim shield counterclockwise">↶ 15°</button><button data-shield-turn="15" type="button" aria-label="Aim shield clockwise">15° ↷</button></div><p class="muted small">Field starts at this room. Move the room to relocate protection; aim follows the ship. Re-aim at any time.</p>`:'';
    const detail=shieldInfo|| (def.range?`<div class="inspector-detail">${def.guidance?'LAUNCH ARC':'FIRING ARC'} ${def.arc}°${def.guidance?' · AUTO TRACK':''} · ${def.guidance?'UNLIMITED RANGE':`RANGE ${weaponRange(module)}`} · ${direction}${module.flipped?' · MIRRORED':''} · ${ammoLabel(def)}</div>`:def.thrust?`<div class="inspector-detail">THRUST → ${direction} · <span id="engineForce">${Math.round(engineThrusters().find((engine)=>engine.module.id===module.id)?.force||0)}</span> FORCE · ${def.thrust} BASE</div><div class="weapon-fit">${footprintBadge(module.type,module.footprint)}</div>`:def.station?'<div class="inspector-detail">WALKABLE FLOOR · 1 SYSTEM STATION</div>':'<div class="inspector-detail">OPEN WALKABLE FLOOR · NO STATION</div>');
    const ammoDetail=def.ammoType?`<div id="magazineDetail" class="inspector-detail">${def.ammoType.toUpperCase()} MAGAZINE ${magazineCount(module)} / ${def.magazine}${magazineCount(module)<def.ammo?' · EMPTY · NEEDS LOADER':''}</div>`:module.type==='ammoAssembly'?`<label class="weapon-range">PRODUCE <select id="ammoRecipe"><option value="heavy" ${module.ammoRecipe!=='missile'?'selected':''}>Heavy · 4 rounds / batch</option><option value="missile" ${module.ammoRecipe==='missile'?'selected':''}>Missile · 2 rounds / batch</option></select></label><p class="muted small">Uses energy only. One batch every 4 seconds at full power. Finished rounds stay here until a loader collects them.</p>`:'';
    const rangeControl=def.range?`<div class="weapon-fit">${footprintBadge(module.type,module.footprint)}</div><div class="weapon-rules">${weaponBehavior(module.type)}</div>${!def.guidance?`<label class="weapon-range" for="weaponRange">RANGE LIMIT <input id="weaponRange" type="number" min="30" max="${def.range}" step="1" value="${weaponRange(module)}" ${!['hangar','trade'].includes(mode)?'disabled':''}><span>MAX ${def.range}</span></label>`:''}${mode==='trade'?'<button id="flipWeapon" class="outline-button full-width" type="button">FLIP WEAPON ↔ · FREE</button>':''}${def.mountFacings===2?`<button id="rotateWeapon" class="outline-button full-width" type="button" ${!['hangar','trade'].includes(mode)?'disabled':''}>TURN MOUNT 90° ↻</button>`:''}`:'';
    const droneInfo=module.type==='droneControl'?`<div class="inspector-detail">LAUNCH → ${direction} · ${droneBayClear(module)?'CLEAR TO SPACE':'BLOCKED · MOVE BAY TO EXTERIOR'} · NO DRONE LIMIT</div>`:module.type==='droneAssembly'?`<label class="drone-assembly">DRONE DESIGN<select id="inspectorDroneDesign" ${mode==='combat'?'disabled':''}>${Object.entries(DRONE_PROGRAMS).map(([id,def])=>`<option value="${id}" ${id===(module.droneType||'combat')?'selected':''}>${def.name}</option>`).join('')}</select></label><div class="inspector-detail">CONTINUOUS PRODUCTION · ${assemblyTime(module).toFixed(1)}s PER DRONE AT FULL POWER</div>`:'';
    $('moduleInspector').innerHTML=`<div class="inspector-head">${def.range?miniShape(module.type):`<span class="inspector-swatch" style="--module-color:${def.color}"></span>`}<strong>${def.name.toUpperCase()} · LV ${module.level}</strong></div><div class="inspector-sub"><span>${def.description}</span><span>${Math.ceil(module.hp)}/${maximum}</span></div>${detail}${shieldAim}${ammoDetail}<div class="inspector-detail">${systemDemand(module)?`AUTO POWER ${systemSupply(module).toFixed(2)} · ${Math.round(systemPower(module)*100)}% PERFORMANCE`:module.type==='core'?'PILOT CONSOLE · ROOM UPGRADES ADD HULL ONLY':def.generation?`GENERATOR OUTPUT ${generatorOutput(module)} · SHARED EQUALLY · +1 PER UPGRADE`:'PASSIVE SYSTEM · NO POWER REQUIRED'}</div>${rangeControl}${droneInfo}${module.footprint&&mode==='trade'?'<button id="refitFootprint" class="outline-button full-width" type="button">REFIT TO NEW FOOTPRINT · FREE</button>':''}${mode==='trade'?`<button id="moveModule" class="outline-button full-width" type="button">${movingModuleId===module.id?'CANCEL MOVE':'MOVE ROOM'}</button>`:''}<div class="meter ${ratio<.35?'low':''}"><span style="width:${Math.round(ratio*100)}%"></span></div><div class="inspector-actions"><button id="upgradeModule" type="button" ${module.level>=3||save.metal<upgradeCost||mode==='combat'?'disabled':''}>${module.type==='core'?'REINFORCE ROOM':'UPGRADE'}<br>◆ ${upgradeCost}</button><button id="repairModule" type="button" ${repairCost===0||save.metal<repairCost||mode==='combat'?'disabled':''}>REPAIR<br>◆ ${repairCost}</button></div>`;
    if(module.type==='focusShield'){
      $('shieldDirection').addEventListener('change',(event)=>setShieldDirection(module.id,+event.target.value));
      $('moduleInspector').querySelectorAll('[data-shield-turn]').forEach((button)=>button.addEventListener('click',()=>setShieldDirection(module.id,shieldDirection(module)+ +button.dataset.shieldTurn)));
    }
    if(module.type==='droneAssembly')$('inspectorDroneDesign').addEventListener('change',(event)=>setDroneDesign(module.id,event.target.value));
    paintWeaponThumbnails($('moduleInspector'));
    if(module.type==='ammoAssembly')$('ammoRecipe').addEventListener('change',(event)=>{if(!AMMO[event.target.value])return;module.ammoRecipe=event.target.value;module.ammoProgress=0;persist();renderAmmo();});
    if(module.footprint&&mode==='trade')$('refitFootprint').addEventListener('click',()=>beginModuleMove(true));
    if(mode==='trade')$('moveModule').addEventListener('click',()=>{
      if(movingModuleId===module.id)cancelRoomMove();else beginModuleMove();
    });
    if(def.range&&!def.guidance)$('weaponRange').addEventListener('change',(event)=>{
      if(!['hangar','trade'].includes(mode))return;
      const value=event.target.valueAsNumber;
      if(Number.isFinite(value))module.range=Math.round(clamp(value,30,def.range));
      persist();renderInspector();drawHangar();
    });
    if(def.range&&mode==='trade')$('flipWeapon').addEventListener('click',()=>{beginModuleMove();flipBuild();});
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
    if(selectedCrewId&&!crewAlive(selectedCrew()||{hp:0}))selectedCrewId=null;
    $('crewList').innerHTML=save.crew.filter(crewAlive).map((person)=>{
      const template=crewAppearance(person);
      return `<div data-crew-id="${person.id}" class="crew-card ${selectedCrewId===person.id?'crew-selected':''}"><div class="crew-top"><button type="button" class="crew-avatar crew-select" data-select-crew="${person.id}" aria-label="Select ${template.name}" aria-pressed="${selectedCrewId===person.id}" style="--crew-color:${template.color}">${template.initial}</button><strong>${template.name}</strong><small>${crewStatus(person)}</small></div><div class="crew-health" role="meter" aria-label="${template.name} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.ceil(person.hp??100)}"><span style="width:${person.hp??100}%"></span><b>${Math.ceil(person.hp??100)} / 100</b></div><select ${!crewAlive(person)||person.aboard?'disabled':''} data-crew="${person.id}" aria-label="${template.name} assignment">${Object.entries(TASKS).map(([value,label])=>`<option value="${value}" ${person.task===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
    }).join('');
    $('crewList').querySelectorAll('[data-select-crew]').forEach((button)=>button.addEventListener('click',()=>selectCrew(button.dataset.selectCrew)));
    renderCrewOrders();
    $('crewList').querySelectorAll('select').forEach((select)=>select.addEventListener('change',()=>{
      const person=save.crew.find((member)=>member.id===select.dataset.crew);person.task=select.value;delete person.manualGoal;delete person.boardOrder;delete crewRoutes[person.id];updateCrew(0);
      persist();log(`${crewAppearance(person).name} assigned to ${TASKS[person.task].toLowerCase()}.`);renderCrew();
    }));
  }

  function renderHud(){
    renderSystems();renderOperations();renderAmmo();
    $('sectorDisplay').textContent=String(save.sector).padStart(2,'0');$('metalDisplay').textContent=save.metal;$('hullDisplay').textContent=`${Math.round(hullRatio()*100)}%`;
    $('jumpButton').disabled=mode==='combat'||eventOpen;
    $('jumpButton').textContent=mode==='combat'?'IN COMBAT':mode==='map'?'RETURN TO SHIP':'OPEN SECTOR MAP ↗';
    $('revisitTrader').hidden=mode!=='hangar'||currentMapNode()?.type!=='trader';
    const cells=save.modules.reduce((sum,module)=>sum+moduleCells(module).length,0),weapons=activeModules(...WEAPON_TYPES).length;
    $('shipStats').innerHTML=`<div class="stat-card"><span>HULL INTEGRITY</span><strong class="${hullRatio()<.35?'bad':'good'}">${Math.round(hullRatio()*100)}%</strong></div><div class="stat-card"><span>MODULES</span><strong>${save.modules.length} <small style="font-size:9px;color:var(--muted)">/ ${cells} CELLS</small></strong></div><div class="stat-card"><span>WEAPONS</span><strong class="${weapons?'good':'bad'}">${weapons} ACTIVE</strong></div><div class="stat-card"><span>AMMO STORES</span><strong id="ammoStores">H ${save.ammunition.heavy} · M ${save.ammunition.missile}</strong></div>`;
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
    const key=JSON.stringify([module.type,module.x,module.y,module.rotation,module.weaponFacing,module.flipped,module.footprint,weaponRange(module),modules.map(({type,x,y,rotation,flipped,footprint})=>[type,x,y,rotation,flipped,footprint])]);
    if(arcCache?.key!==key){
      const cells=MODULES[module.type].hullPass?[]:modules.flatMap(moduleCells),mount=weaponGeometry(module),limit=MODULES[module.type].guidance?3:weaponRange(module)/COMBAT_TILE;
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
    if(!crewAlive(person))return;
    const template=crewAppearance(person),x=Math.round(person.x*size),y=Math.round(person.y*size);
    g.fillStyle='#091421';g.fillRect(x-5,y-7,10,13);
    g.fillStyle='#53677c';g.fillRect(x-4,y-6,8,4);
    g.fillStyle=template.color;g.fillRect(x-3,y-6,6,3);g.fillRect(x-4,y-2,8,6);
    g.fillStyle='#f2fbec';g.fillRect(x-2,y-5,4,1);
    g.fillStyle='#294358';g.fillRect(x-2,y,2,3);g.fillRect(x+1,y,2,3);
    g.fillStyle='#101b2b';g.fillRect(x-4,y+4,3,3);g.fillRect(x+1,y+4,3,3);
    g.fillStyle='#fff1c6';g.fillRect(x+4,y,1,2);
    if(selectedCrewId===person.id){g.strokeStyle='#f7e7a6';g.lineWidth=1;g.strokeRect(x-7,y-9,14,18);}
    if((person.hp??100)<100){g.fillStyle='#291b28';g.fillRect(x-6,y-11,12,2);g.fillStyle='#8ce0b1';g.fillRect(x-6,y-11,12*person.hp/100,2);}
    if(person.droneCargo!==undefined){const drone=save.drones.find((drone)=>drone.id===person.droneCargo);g.fillStyle='#152331';g.fillRect(x+2,y-1,11,7);g.fillStyle=DRONE_PROGRAMS[drone?.type||'combat'].color;g.fillRect(x+4,y,7,4);g.fillStyle='#e2f4df';g.fillRect(x+6,y+1,2,1);}
    if(person.carrying){g.fillStyle='#17232e';g.fillRect(x+3,y-2,7,7);g.fillStyle=AMMO[person.carrying.type].color;g.fillRect(x+4,y-1,5,5);g.fillStyle='#fff0c9';g.fillRect(x+6,y-1,1,5);}
  }
  function stationConsole(module,occupied=occupancy()){
    const geometry=moduleGeometry(module),station=geometry.station;if(!station)return null;
    const x=module.x+station[0],y=module.y+station[1],own=new Set(moduleCells(module).map((cell)=>cell.join(',')));
    const sides=[[0,-1,0],[1,0,Math.PI/2],[0,1,Math.PI],[-1,0,-Math.PI/2]];
    const side=sides.filter(([dx,dy])=>!own.has(`${x+dx},${y+dy}`)).sort((a,b)=>Number(occupied.has(`${x+a[0]},${y+a[1]}`))-Number(occupied.has(`${x+b[0]},${y+b[1]}`)))[0]||sides[0];
    return {x:(x+.5)*TILE,y:(y+.5)*TILE,angle:side[2],shared:occupied.has(`${x+side[0]},${y+side[1]}`)};
  }
  function drawStation(g,module,throttle=0,occupied){
    const def=MODULES[module.type],console=stationConsole(module,occupied);if(!console)return;
    const live=module.hp>0,width=console.shared?7:14,left=console.shared?-10:-7;
    g.save();g.translate(console.x,console.y);g.rotate(console.angle);
    // A shallow monitor and keyboard sit against the wall, leaving the crew's
    // floor cell open. At a connecting doorway, use the short corner panel.
    g.fillStyle='#252d2d';g.fillRect(left-1,-11,width+2,7);
    g.fillStyle='#777f76';g.fillRect(left,-10,width,5);
    g.fillStyle='#bcc4ad';g.fillRect(left,-10,width,1);
    g.fillStyle='#173a39';g.fillRect(left+1,-9,width-2,3);
    g.fillStyle=live?(def.range?'#d18b73':def.color):'#52615a';g.fillRect(left+2,-8,width-4,1);
    g.fillStyle='#b5c7a3';g.fillRect(left+1,-5,2,1);g.fillRect(left+4,-5,1,1);
    if(width>7){g.fillRect(left+7,-5,2,1);g.fillStyle=live?'#8bd7ad':'#647263';g.fillRect(left+10,-8,1,1);}
    g.restore();
    const cells=moduleCells(module),station=moduleStation(module),machine=cells.find(([x,y])=>x!==Math.floor(station.x)||y!==Math.floor(station.y));
    if(machine&&['droneAssembly','ammoAssembly','generator','teleporter','droneControl'].includes(module.type)){
      const x=(machine[0]+.5)*TILE,y=(machine[1]+.5)*TILE;
      g.fillStyle='#37413d';g.fillRect(x-7,y-5,14,10);g.fillStyle='#798172';g.fillRect(x-6,y-4,12,8);
      if(module.type==='droneAssembly'){
        g.fillStyle='#b2a07b';g.fillRect(x-7,y-7,3,12);g.fillRect(x-5,y-7,10,3);g.fillStyle='#3d5757';g.fillRect(x-3,y-1,7,4);g.fillStyle='#b8d7b5';g.fillRect(x,y,2,1);
      }else if(module.type==='ammoAssembly'){
        g.fillStyle=AMMO[module.ammoRecipe||'heavy'].color;g.fillRect(x-4,y-2,3,5);g.fillRect(x+1,y-2,3,5);
      }else if(def.generation){
        g.fillStyle='#9a8b60';g.fillRect(x-4,y-3,8,6);g.fillStyle=live?'#ecd79b':'#675f4d';g.fillRect(x-1,y-3,2,6);
      }else{
        g.fillStyle='#3d6261';g.fillRect(x-4,y-3,8,6);g.fillStyle=live?'#a1d7c7':'#607970';g.fillRect(x-2,y-1,4,2);
      }
    }
    if(module.type==='focusShield'){
      g.save();g.translate(console.x,console.y);g.rotate(shieldDirection(module)*Math.PI/180);g.fillStyle=live?'#a4e9d4':'#526a62';g.fillRect(3,-.5,4,1);g.fillRect(5,-2,1,4);g.restore();
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
    if(module.type==='droneControl'){const door=droneBayDoor(module);g.save();g.translate(door.x*TILE,door.y*TILE);g.rotate(door.direction);g.fillStyle='#3e4c55';g.fillRect(-5,-9,8,18);g.fillStyle='#a0bfc4';g.fillRect(-3,-7,4,14);g.fillStyle=droneBayClear(module)?'#7cdec8':'#d68075';g.fillRect(1,-5,2,10);g.restore();}
    if(MODULES[module.type].muzzle){
      const mount=weaponGeometry(module);
      g.save();g.translate(mount.x*TILE,mount.y*TILE);g.rotate(mount.direction+(battle?module.aimOffset||0:0));if(module.flipped)g.scale(1,-1);
      drawWeaponSprite(g,module.type,module.hp>0,module.hp>0&&battle?(module.flash||0):0);g.restore();
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
      case 'beam':
        body(-6,-4,17,8);r(-4,-2,10,4,red);barrel(10,-1,14,2);r(16,-6,3,12,dark);r(23,-7,5,14,steel);r(26,-5,3,10,'#ed967e');r(29,-3,2,6,light);break;
      case 'heavyBeam':
        body(-7,-7,20,14);r(-5,-5,12,10,red);barrel(12,-2,12,4);for(const x of [13,18])r(x,-6,2,12,steel);r(23,-9,6,18,dark);r(26,-7,4,14,'#e9c986');r(30,-5,2,10,light);break;
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
      drawStation(g,module,thrusters[module.id]||0,occupied);
    }
    for(const module of save.modules)drawExteriorHardware(g,module,thrusters[module.id]||0);
    if(showSelection&&!selectedCatalog&&SHIELD_TYPES.includes(selectedModule()?.type))drawShieldCoverage(g,selectedModule(),TILE);
    for(const person of save.crew)if(crewHome(person))drawCrewSprite(g,person);
    for(const drone of save.drones||[])if(drone.hp>0){const point=drone.phase==='stored'?dronePickupPoint(drone):drone;
      if(['stored','ready'].includes(drone.phase)||drone.type==='repair'&&drone.phase==='active')drawDroneSprite(g,point.x*TILE,point.y*TILE,drone.type);}
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
    return {valid:place.valid,module:{level:1,hp:MODULES[selectedCatalog].hp,...original,footprint:refittingFootprint?null:original?.footprint,type:selectedCatalog,x:place.x,y:place.y,rotation:buildRotation,weaponFacing:buildWeaponFacing,flipped:placementFlipped(selectedCatalog),...(selectedCatalog==='focusShield'?{shieldFacing:original?shieldDirection(original):0}:{})}};
  }
  function drawHangar(){
    sizeArtCanvas(hangarCanvas,{w:buildView.cols,h:buildView.rows,scale:SPRITE_SCALE});
    drawInterior(hangarCtx,true,{},{x:buildView.x,y:buildView.y,w:buildView.cols,h:buildView.rows,scale:SPRITE_SCALE});
    const preview=placementPreview();if(!preview)return;
    const g=hangarCtx,module=preview.module,color=preview.valid?'rgba(111,235,196,.22)':'rgba(255,101,111,.25)';
    if(MODULES[module.type].range)drawWeaponArc(g,module,TILE,color,[...save.modules.filter((part)=>part.id!==movingModuleId),module]);
    g.globalAlpha=.7;
    for(const [x,y] of moduleCells(module)){g.fillStyle=preview.valid?'#81e4bb':'#ed7783';g.fillRect(x*TILE+1,y*TILE+1,TILE-2,TILE-2);}
    g.globalAlpha=1;drawStation(g,module);drawExteriorHardware(g,module);
    if(SHIELD_TYPES.includes(module.type))drawShieldCoverage(g,module,TILE,[...save.modules.filter((part)=>part.id!==movingModuleId),module]);
    if(MODULES[module.type].range){
      const mount=weaponGeometry(module);g.fillStyle='#fff2bd';g.fillRect(mount.x*TILE-2,mount.y*TILE-2,4,4);
    }
  }

  function walkPath(start,end){
    const occupied=occupancy(),from=`${Math.floor(start.x)},${Math.floor(start.y)}`,to=`${Math.floor(end.x)},${Math.floor(end.y)}`;
    if(from===to)return distance(start,end)>.08?[{x:end.x,y:end.y}]:[];
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

  function selectedCrew(){return save.crew.find((person)=>person.id===selectedCrewId);}
  function selectCrew(id){
    if(!save.crew.some((person)=>person.id===id&&crewAlive(person)))return false;
    selectedCrewId=id;selectedCatalog=null;movingModuleId=null;rearrangingShip=false;roomDrag=null;
    if(battle)battle.player.selected=false;
    renderCrew();renderGrid();
    if(mode==='combat')$('combatHint').textContent='CREW SELECTED · RIGHT CLICK A FLOOR CELL TO MOVE';
  }
  function orderCrewMove(x,y){
    const person=selectedCrew(),point={x:Math.floor(x)+.5,y:Math.floor(y)+.5};
    if(!person||!crewAlive(person)){toast('Select a living crew member first.');return false;}
    if(person.aboard){toast('Recall this crew member before giving home-ship orders.');return false;}
    if(!occupancy().has(`${Math.floor(x)},${Math.floor(y)}`)||(!walkPath(person,point).length&&distance(person,point)>.12)){toast('Choose a reachable floor cell on your ship.');return false;}
    person.manualGoal=point;person.workModuleId=null;delete person.boardOrder;delete crewRoutes[person.id];updateCrew(0);persist();renderCrew();return true;
  }
  function resumeCrewJob(){
    const person=selectedCrew();if(!person||!crewHome(person))return;
    delete person.manualGoal;delete person.boardOrder;delete crewRoutes[person.id];updateCrew(0);persist();renderCrew();
  }
  function enemyLocal(point,enemy){const dx=point.x-enemy.x,dy=point.y-enemy.y,c=Math.cos(enemy.angle),s=Math.sin(enemy.angle);return {x:(dx*c+dy*s)/ENEMY_TILE,y:(-dx*s+dy*c)/ENEMY_TILE};}
  function actorWorld(actor,enemy){const c=Math.cos(enemy.angle),s=Math.sin(enemy.angle);return {x:enemy.x+(actor.x*c-actor.y*s)*ENEMY_TILE,y:enemy.y+(actor.x*s+actor.y*c)*ENEMY_TILE};}
  function selectCrewAtWorld(point){
    let nearest=null,best=14;
    for(const person of save.crew)if(crewAlive(person)){
      const pos=person.aboard?actorWorld(person.aboard,battle.enemies[person.aboard.enemy]):hullPointWorld(person,battle.player);
      const d=distance(pos,point);if(d<best){best=d;nearest=person;}
    }
    if(nearest){selectCrew(nearest.id);return true;}return false;
  }
  function hullPointWorld(point,player){const b=shipBounds(),x=(point.x-b.cx)*COMBAT_TILE,y=(point.y-b.cy)*COMBAT_TILE,c=Math.cos(player.angle),s=Math.sin(player.angle);return {x:player.x+x*c-y*s,y:player.y+x*s+y*c};}
  function orderCrewWorld(point){
    const person=selectedCrew();if(!person||!crewAlive(person))return false;
    if(person.aboard){
      const enemy=battle.enemies[person.aboard.enemy],local=enemyLocal(point,enemy);
      const room=enemy.modules.findIndex((room)=>room.cells.some(([x,y])=>Math.abs(x-local.x)<=.5&&Math.abs(y-local.y)<=.5));
      if(room<0){toast('Right click a floor cell on the boarded ship, or use RECALL.');return false;}
      return orderBoardedRoom(person,room);
    }
    const local=worldToHull(point,battle.player);return orderCrewMove(local.x,local.y);
  }
  function hurtCrew(person,amount){
    if(!crewAlive(person)||amount<=0)return;
    person.hp=Math.max(0,(person.hp??100)-amount);person.hurtTime=5;
    if(person.hp===0){delete person.manualGoal;delete person.boardOrder;delete person.aboard;person.workModuleId=null;delete crewRoutes[person.id];log(`${crewAppearance(person).name} was killed.`);if(selectedCrewId===person.id)selectedCrewId=null;persist();renderCrew();}
  }
  function boardingPad(){return activeModules('teleporter')[0];}
  function boardingReady(enemy){return !!battle&&!!enemy&&!!boardingPad()&&(battle.teleportCooldown||0)<=0&&enemyAlive(enemy)&&distance(enemy,battle.player)<=600;}
  function boardCrew(id,enemyIndex,teamSize=1){
    const person=save.crew.find((person)=>person.id===id),pad=boardingPad(),enemy=battle?.enemies[enemyIndex];
    if(!person||!crewHome(person)||!pad||!enemy||!enemyAlive(enemy))return false;
    const point=moduleStation(pad);if(!walkPath(person,point).length&&distance(person,point)>.12)return false;
    const team=[person,...save.crew.filter((other)=>other!==person&&crewHome(other)&&!other.boardOrder&&!other.manualGoal).sort((a,b)=>distance(a,point)-distance(b,point))].slice(0,teamSize);
    const members=team.filter((member)=>walkPath(member,point).length||distance(member,point)<.12);
    for(const member of members){delete member.manualGoal;member.boardOrder={enemy:enemyIndex,pad:pad.id,team:members.map((member)=>member.id)};member.workModuleId=null;delete crewRoutes[member.id];}
    updateCrew(0);renderCrew();return true;
  }
  function tryBoardCrew(person){
    const order=person.boardOrder,enemy=battle?.enemies[order?.enemy];
    if(!order)return;
    const pad=save.modules.find((module)=>module.id===order.pad);
    if(!enemy||!enemyAlive(enemy)||!pad||pad.hp<=0){delete person.boardOrder;return;}
    if(!boardingReady(enemy)||systemPower(pad)<=0)return;
    const team=save.crew.filter((member)=>crewHome(member)&&order.team.includes(member.id)&&member.boardOrder?.enemy===order.enemy&&member.boardOrder.pad===order.pad);
    if(team.some((member)=>distance(member,moduleStation(pad))>=.12))return;
    const room=Math.max(0,enemy.modules.findIndex((room)=>room.type==='weapon'&&room.hp>0));
    team.forEach((member,i)=>{const [x,y]=enemy.modules[room].cells[i%enemy.modules[room].cells.length];member.aboard={enemy:order.enemy,room,x,y,path:[]};delete member.boardOrder;delete crewRoutes[member.id];});
    battle.teleportCooldown=12;renderCrew();
  }
  function recallCrew(id,emergency=false){
    const person=save.crew.find((person)=>person.id===id);if(!person?.aboard||!crewAlive(person))return false;
    const enemy=battle?.enemies[person.aboard.enemy];
    if(!emergency&&(!enemy||!boardingReady(enemy)))return false;
    const pad=boardingPad()||commandCore();Object.assign(person,moduleStation(pad));delete person.aboard;delete person.manualGoal;delete crewRoutes[person.id];
    if(battle&&!emergency)battle.teleportCooldown=12;return true;
  }
  function recoverBoarders(){for(const person of save.crew){if(person.aboard)recallCrew(person.id,true);delete person.boardOrder;}}
  function enemyPath(enemy,start,end){
    const cells=new Set(enemy.modules.flatMap((room)=>room.cells.map(([x,y])=>`${x},${y}`))),key=(p)=>`${Math.round(p.x)},${Math.round(p.y)}`,from=key(start),to=key(end);
    if(from===to)return distance(start,end)>.08?[{...end}]:[];
    const queue=[from],previous=new Map([[from,null]]);
    for(let i=0;i<queue.length&&!previous.has(to);i++){
      const [x,y]=queue[i].split(',').map(Number);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=`${x+dx},${y+dy}`;if(cells.has(next)&&!previous.has(next)){previous.set(next,queue[i]);queue.push(next);}}
    }
    if(!previous.has(to))return null;
    const path=[];for(let cell=to;cell!==from;cell=previous.get(cell)){const [x,y]=cell.split(',').map(Number);path.unshift({x,y});}return path;
  }
  function orderBoardedRoom(person,roomIndex){
    if(!person.aboard||!battle)return false;const enemy=battle.enemies[person.aboard.enemy],room=enemy.modules[roomIndex];if(!room)return false;
    const [x,y]=room.cells[0],path=enemyPath(enemy,person.aboard,{x,y});if(path===null)return false;
    person.aboard.path=path;person.aboard.destination=roomIndex;return true;
  }
  function moveActor(actor,path,travel){
    while(path?.length&&travel>0){const next=path[0],d=distance(actor,next);if(d<=travel){Object.assign(actor,next);travel-=d;path.shift();}else{actor.x+=(next.x-actor.x)/d*travel;actor.y+=(next.y-actor.y)/d*travel;break;}}
  }
  function updateBoarding(dt){
    if(!battle)return;
    const pad=boardingPad();battle.teleportCooldown=Math.max(0,(battle.teleportCooldown||0)-dt*(pad?systemPower(pad):0));
    battle.enemies.forEach((enemy,index)=>{
      const boarders=save.crew.filter((person)=>crewAlive(person)&&person.aboard?.enemy===index),bots=(battle.drones||[]).filter((drone)=>drone.type==='boarding'&&drone.phase==='boarding'&&drone.enemy===index&&drone.hp>0);
      if(!enemyAlive(enemy)){for(const person of boarders)recallCrew(person.id,true);for(const drone of bots)drone.hp=0;return;}
      const attackers=[...boarders.map((person)=>({actor:person.aboard,person})),...bots.map((actor)=>({actor}))];
      for(const {actor,person} of attackers){
        if(!person){const bay=save.modules.find((module)=>module.id===actor.bay);if(!bay||!systemPower(bay))continue;}
        if(!person&&!actor.path?.length&&enemy.modules[actor.room]?.hp===0){const next=enemy.modules.findIndex((room)=>room.type!=='armor'&&room.hp>0);if(next>=0){const [x,y]=enemy.modules[next].cells[0];actor.path=enemyPath(enemy,actor,{x,y})||[];actor.destination=next;}}
        moveActor(actor,actor.path,dt*2.1*(person?1:systemPower(save.modules.find((module)=>module.id===actor.bay))));
        if(actor.destination!==undefined&&!actor.path?.length){actor.room=actor.destination;delete actor.destination;}
        const room=enemy.modules.findIndex((room)=>room.cells.some(([x,y])=>Math.round(actor.x)===x&&Math.round(actor.y)===y));if(room>=0)actor.room=room;
      }
      const guards=(enemy.crew||[]).filter((guard)=>guard.hp>0);
      for(const guard of guards){
        const target=attackers.filter(({actor})=>actor.hp===undefined||actor.hp>0).sort((a,b)=>distance(a.actor,guard)-distance(b.actor,guard))[0];if(!target)continue;
        const dest=target.actor;
        if(distance(guard,dest)>.7){const path=enemyPath(enemy,guard,{x:Math.round(dest.x),y:Math.round(dest.y)});moveActor(guard,path,dt*1.8);}
        const room=enemy.modules.findIndex((room)=>room.cells.some(([x,y])=>Math.round(guard.x)===x&&Math.round(guard.y)===y));if(room>=0)guard.room=room;
        if(distance(guard,dest)<=1.1){if(target.person)hurtCrew(target.person,dt*8);else dest.hp=Math.max(0,dest.hp-dt*8);}
      }
      for(const {actor,person} of attackers){
        if(person&&!crewAlive(person)||actor.hp===0||actor.path?.length)continue;
        if(!person){const bay=save.modules.find((module)=>module.id===actor.bay);if(!bay||!systemPower(bay))continue;}
        const power=person?1:systemPower(save.modules.find((module)=>module.id===actor.bay));
        const guard=guards.filter((guard)=>guard.hp>0&&distance(actor,guard)<=1.2)[0];
        if(guard){guard.hp=Math.max(0,guard.hp-dt*10*power);}
        else{const room=enemy.modules[actor.room];if(room?.hp>0)hurtEnemy(enemy,dt*5*power,room,null,false);}
      }
      if(attackers.length&&enemy.crew?.length&&enemy.crew.every((guard)=>guard.hp<=0)){enemy.captured=true;const core=enemy.modules.find((room)=>room.type==='core');if(core)core.hp=0;enemy.hp=0;for(const person of boarders)if(crewAlive(person))recallCrew(person.id,true);}
    });
  }
  function droneBayCapacity(){return Infinity;}
  function droneBayDoor(bay){const [x,y]=moduleGeometry(bay).door;return {x:bay.x+x,y:bay.y+y,direction:bay.rotation*Math.PI/2};}
  function droneBayClear(bay,modules=save.modules){
    const door=droneBayDoor(bay),cells=modules.flatMap(moduleCells),limit=hullEscapeLimit(door,cells);
    return hullRay(door,door.direction,cells,limit)>=limit;
  }
  function droneLanesPreserved(modules,previous){
    return modules.filter((module)=>module.type==='droneControl').every((bay)=>{
      const old=previous.find((module)=>module.id===bay.id&&module.type==='droneControl');
      return old&&old.x===bay.x&&old.y===bay.y&&old.rotation===bay.rotation&&!droneBayClear(old,previous)?true:droneBayClear(bay,modules);
    });
  }
  function dronePickupPoint(drone,data=save){return drone.pickupPoint||moduleStation(data.modules.find((module)=>module.id===drone.assembly));}
  function droneCanReach(start,end){return distance(start,end)<.12||walkPath(start,end).length>0;}
  function dropCrewDrone(person,data=save){
    const drone=data.drones?.find((drone)=>drone.id===person.droneCargo);
    if(drone){drone.phase='stored';drone.pickupPoint={x:Math.floor(person.x)+.5,y:Math.floor(person.y)+.5};Object.assign(drone,drone.pickupPoint);delete drone.carrier;delete drone.bay;}
    delete person.droneCargo;delete person.droneJob;
  }
  function syncDroneCarriers(){
    for(const person of save.crew){
      if(person.droneCargo!==undefined){
        const drone=save.drones?.find((drone)=>drone.id===person.droneCargo&&drone.hp>0);
        if(!drone||!crewHome(person)||person.boardOrder||!['load','drone'].includes(person.task)||person.carrying){dropCrewDrone(person);continue;}
        drone.phase='carried';drone.carrier=person.id;drone.x=person.x;drone.y=person.y;
      }
    }
    for(const drone of save.drones||[])if(drone.carrier){
      const person=save.crew.find((person)=>person.id===drone.carrier);
      if(drone.phase==='carried'&&person?.droneCargo===drone.id)continue;
      if(drone.phase==='stored'&&person&&crewHome(person)&&!person.manualGoal&&!person.boardOrder&&!person.carrying&&['load','drone'].includes(person.task)&&person.droneJob?.drone===drone.id)continue;
      if(person?.droneJob?.drone===drone.id)delete person.droneJob;delete drone.carrier;delete drone.bay;
    }
    for(const person of save.crew)if(person.droneJob&&!save.drones?.some((drone)=>drone.id===person.droneJob.drone&&drone.hp>0&&drone.carrier===person.id))delete person.droneJob;
  }
  function droneDeliveryBay(person,drone){
    const point=person.droneCargo===drone.id?person:dronePickupPoint(drone);
    const bays=save.modules.filter((bay)=>bay.type==='droneControl'&&bay.hp>0&&droneBayClear(bay)&&droneCanReach(point,moduleStation(bay)));
    return bays.find((bay)=>bay.id===person.droneJob?.bay)||bays.sort((a,b)=>distance(point,moduleStation(a))-distance(point,moduleStation(b)))[0];
  }
  function planDroneDeliveries(people,assignments){
    syncDroneCarriers();
    if(!(save.drones||[]).some((drone)=>drone.hp>0&&['stored','carried'].includes(drone.phase))){for(const person of people)if(person.task==='drone'){person.workModuleId=null;assignments.set(person,null);}return;}
    const hasAmmoWork=(person)=>save.modules.some((weapon)=>weapon.hp>0&&MODULES[weapon.type].ammoType&&magazineCount(weapon)<MODULES[weapon.type].magazine&&droneCanReach(person,moduleStation(weapon))&&reachableAmmoSources(person,MODULES[weapon.type].ammoType).length);
    const loaders=people.filter((person)=>['load','drone'].includes(person.task)&&!person.carrying)
      .sort((a,b)=>Number(b.droneCargo!==undefined)-Number(a.droneCargo!==undefined)||Number(!!b.droneJob)-Number(!!a.droneJob)||Number(b.task==='drone')-Number(a.task==='drone'));
    for(const person of loaders){
      let drone=(save.drones||[]).find((drone)=>drone.hp>0&&drone.carrier===person.id&&(drone.phase==='stored'||drone.phase==='carried'));
      let bay=drone&&droneDeliveryBay(person,drone);
      if(drone&&(!bay||drone.phase==='stored'&&!droneCanReach(person,dronePickupPoint(drone)))){
        if(person.droneCargo===drone.id){delete drone.bay;delete person.droneJob;assignments.set(person,null);person.workModuleId=null;continue;}
        delete drone.carrier;delete drone.bay;delete person.droneJob;drone=null;
      }
      if(!drone&&(person.task==='drone'||!hasAmmoWork(person))){
        const options=(save.drones||[]).filter((part)=>part.hp>0&&part.phase==='stored'&&!part.carrier&&(part.pickupPoint||save.modules.some((module)=>module.id===part.assembly&&module.hp>0))&&droneCanReach(person,dronePickupPoint(part)))
          .map((part)=>({drone:part,bay:droneDeliveryBay(person,part)})).filter((job)=>job.bay)
          .sort((a,b)=>distance(person,dronePickupPoint(a.drone))-distance(person,dronePickupPoint(b.drone)));
        if(options.length)({drone,bay}=options[0]);
      }
      if(drone&&bay){drone.carrier=person.id;drone.bay=bay.id;person.droneJob={drone:drone.id,bay:bay.id};person.workModuleId=bay.id;person.workTask=person.task;assignments.set(person,bay);}
      else if(person.task==='drone'){person.workModuleId=null;person.workTask='drone';assignments.set(person,null);}
    }
  }
  function handleDroneDelivery(person,goal,route){
    const drone=save.drones?.find((drone)=>drone.id===(person.droneCargo??person.droneJob?.drone)&&drone.hp>0);
    if(!drone||person.manualGoal||person.boardOrder||route.path.length||distance(person,goal.point)>=.12)return;
    if(person.droneCargo===drone.id){
      const bay=save.modules.find((module)=>module.id===person.droneJob?.bay);
      if(!bay||bay!==goal.module||bay.hp<=0||!droneBayClear(bay))return;
      drone.phase='ready';drone.bay=bay.id;delete drone.carrier;delete drone.pickupPoint;Object.assign(drone,moduleStation(bay));delete person.droneCargo;delete person.droneJob;person.workModuleId=null;
    }else if(drone.phase==='stored'&&drone.carrier===person.id){
      drone.phase='carried';person.droneCargo=drone.id;delete drone.pickupPoint;drone.x=person.x;drone.y=person.y;
    }else return;
    route.target='';persist();
  }
  function normalizeDrones(data){
    delete data.droneParts;for(const node of data.map?.nodes||[])delete node.dronePacks;
    data.drones=(Array.isArray(data.drones)?data.drones:[]).filter((drone)=>{
      const assembly=data.modules.find((module)=>module.id===drone.assembly&&module.type==='droneAssembly');
      if(!assembly||!(drone.hp>0))return false;
      drone.type=DRONE_PROGRAMS[drone.type]?drone.type:'combat';drone.hp=clamp(drone.hp,0,60);drone.path=[];delete drone.enemy;delete drone.room;
      const bay=data.modules.find((module)=>module.id===drone.bay&&module.type==='droneControl'),person=data.crew.find((person)=>person.id===drone.carrier);
      if(drone.phase==='carried'&&person&&crewAlive(person)&&['load','drone'].includes(person.task)&&!person.carrying&&person.droneCargo===drone.id){
        Object.assign(drone,{x:person.x,y:person.y});person.droneJob=bay?{drone:drone.id,bay:bay.id}:undefined;
      }else if(drone.phase==='stored'){
        const point=drone.pickupPoint&&Number.isFinite(drone.pickupPoint.x)&&Number.isFinite(drone.pickupPoint.y)?drone.pickupPoint:moduleStation(assembly);Object.assign(drone,point);
        if(!person||!crewAlive(person)||!['load','drone'].includes(person.task)||person.droneJob?.drone!==drone.id){delete drone.carrier;delete drone.bay;}
      }else{
        if(drone.phase==='carried')drone.pickupPoint=person?{x:Math.floor(person.x)+.5,y:Math.floor(person.y)+.5}:moduleStation(assembly);
        drone.phase=drone.phase!=='carried'&&bay?'ready':'stored';delete drone.carrier;
        Object.assign(drone,drone.phase==='ready'?moduleStation(bay):drone.pickupPoint||moduleStation(assembly));
        if(drone.phase==='stored')delete drone.bay;
      }
      return true;
    });
    for(const person of data.crew){
      if(!data.drones.some((drone)=>drone.id===person.droneCargo&&drone.phase==='carried'&&drone.carrier===person.id))delete person.droneCargo;
      if(!data.drones.some((drone)=>drone.id===person.droneJob?.drone&&drone.carrier===person.id))delete person.droneJob;
    }
    data.nextDroneId=Math.max(data.nextDroneId||0,...data.drones.map((drone)=>drone.id||0));
    for(const module of data.modules){delete module.aimOffset;if(module.type==='droneAssembly'){module.droneType=DRONE_PROGRAMS[module.droneType]?module.droneType:'combat';module.buildProgress=clamp(module.buildProgress||0,0,assemblyTime(module));module.buildPaused=!!module.buildPaused;}}
  }
  function recoverDrones(){
    save.drones??=[];
    for(const drone of save.drones){
      if(['stored','carried','ready'].includes(drone.phase))continue;
      const assembly=save.modules.find((module)=>module.id===drone.assembly),bay=save.modules.find((module)=>module.id===drone.bay&&module.type==='droneControl');if(!assembly)continue;
      drone.phase=bay?'ready':'stored';drone.path=[];delete drone.enemy;delete drone.room;delete drone.target;delete drone.carrier;
      Object.assign(drone,moduleStation(bay||assembly));
    }
  }
  function droneCount(bay){return (save.drones||[]).filter((drone)=>drone.bay===bay.id&&drone.hp>0&&(drone.phase!=='stored'||drone.carrier)).length;}
  function assemblyTime(assembly){return 4/(1+.25*(assembly.level-1));}
  function updateDroneAssembly(dt){
    save.drones??=[];let changed=false;
    for(let i=save.drones.length-1;i>=0;i--)if(save.drones[i].hp<=0||!save.modules.some((module)=>module.id===save.drones[i].assembly&&module.type==='droneAssembly')){save.drones.splice(i,1);changed=true;}
    for(const assembly of save.modules.filter((module)=>module.type==='droneAssembly')){
      const power=systemPower(assembly);if(!power||assembly.buildPaused)continue;
      assembly.buildProgress=(assembly.buildProgress||0)+dt*power;
      const duration=assemblyTime(assembly),point=moduleStation(assembly);
      while(assembly.buildProgress+1e-7>=duration){
        assembly.buildProgress=Math.max(0,assembly.buildProgress-duration);
        save.nextDroneId=(save.nextDroneId||0)+1;
        save.drones.push({id:save.nextDroneId,assembly:assembly.id,type:DRONE_PROGRAMS[assembly.droneType]?assembly.droneType:'combat',hp:60,phase:'stored',cooldown:.5,angle:0,path:[],...point});changed=true;
      }
    }
    if(changed)persist();
  }
  function droneBayFor(drone){return activeModules('droneControl').find((bay)=>bay.id===drone.bay&&droneBayClear(bay));}
  function launchAssembledDrone(drone){
    if(drone.phase!=='ready')return false;
    const bay=droneBayFor(drone);if(!bay)return false;
    if(!battle&&drone.type!=='repair')return false;
    drone.bay=bay.id;drone.path=[];drone.target=null;drone.cooldown=.5;
    if(drone.type==='repair'){drone.phase='active';Object.assign(drone,moduleStation(bay));return true;}
    const door=droneBayDoor(bay),point=hullPointWorld(door,battle.player);
    drone.phase='launching';drone.launchProgress=0;Object.assign(drone,point);return true;
  }
  function setDroneDesign(id,type){
    if(mode==='combat'||!DRONE_PROGRAMS[type])return false;
    const assembly=save.modules.find((module)=>module.id===id&&module.type==='droneAssembly');if(!assembly)return false;
    if((assembly.droneType||'combat')===type)return true;
    assembly.droneType=type;assembly.buildProgress=0;
    persist();renderInspector();renderOperations();return true;
  }
  function toggleDroneProduction(id){
    const assembly=save.modules.find((module)=>module.id===id&&module.type==='droneAssembly');if(!assembly)return false;
    assembly.buildPaused=!assembly.buildPaused;persist();renderInspector();renderOperations();return true;
  }
  function moveAttackDrone(drone,enemy,dt,power){
    const player=battle.player,radius=enemy.r+65+(drone.id%3)*12,bearing=Math.atan2(drone.y-enemy.y,drone.x-enemy.x);
    const sign=drone.id%2?1:-1,orbiting=distance(drone,enemy)<=radius+25,angle=bearing+(orbiting?dt*power*sign:0);
    const obstacles=[...(battle.asteroids||[]),{x:player.x,y:player.y,r:player.r+4},{x:enemy.x,y:enemy.y,r:enemy.r+22}];
    const offsets=orbiting?[0,.4,.8,1.2,1.8,2.4,Math.PI,4,4.8,5.6]:[0,.4,-.4,.8,-.8,1.2,-1.2,1.8,-1.8,2.4,-2.4,Math.PI];
    const world=battle.world||{w:Infinity,h:Infinity},goals=offsets.map((offset)=>({x:enemy.x+Math.cos(angle+offset*sign)*radius,y:enemy.y+Math.sin(angle+offset*sign)*radius}));
    const goal=goals.find((point)=>point.x>17&&point.y>17&&point.x<world.w-17&&point.y<world.h-17&&obstacles.every((rock)=>distance(point,rock)>rock.r+9+WRECK_BERTH+1))||safePoint(goals[0],9,obstacles,world);
    let path=[goal],cached=droneFlightCache.get(drone);
    if(!clearSegment(drone,goal,9,obstacles)){
      if(!cached||cached.enemy!==enemy||(cached.time-=dt)<=0||!cached.path.length||!clearSegment(drone,cached.path[0],9,obstacles)){
        cached={enemy,time:.5,path:routeAroundRocks(drone,goal,9,obstacles,world)};droneFlightCache.set(drone,cached);
      }
      path=cached.path;
    }else droneFlightCache.delete(drone);
    moveActor(drone,path,dt*220*power);drone.angle=Math.atan2(drone.y-enemy.y,drone.x-enemy.x);
    drone.facing=Math.atan2(enemy.y-drone.y,enemy.x-drone.x);
  }
  function updateDrones(dt){
    updateDroneAssembly(dt);if(battle)battle.drones=save.drones;
    for(const drone of save.drones){
      if(drone.phase==='stored'){Object.assign(drone,dronePickupPoint(drone));continue;}
      if(drone.phase==='carried')continue;
      if(drone.phase==='ready'){const bay=save.modules.find((part)=>part.id===drone.bay);if(bay)Object.assign(drone,moduleStation(bay));launchAssembledDrone(drone);if(drone.phase==='ready')continue;}
      const bay=save.modules.find((module)=>module.id===drone.bay),power=bay&&droneBayClear(bay)?systemPower(bay):0;
      drone.powered=power>0;if(!power)continue;drone.cooldown=Math.max(0,drone.cooldown-dt*power);
      if(drone.type==='repair'){
        let room=save.modules.find((module)=>module.id===drone.target&&module.hp<maxHp(module));
        if(!room){room=save.modules.filter((module)=>module.hp<maxHp(module)).sort((a,b)=>a.hp/maxHp(a)-b.hp/maxHp(b))[0];drone.target=room?.id;drone.path=room?walkPath(drone,moduleStation(room)):[];}
        if(room){moveActor(drone,drone.path,dt*2.8*power);if(distance(drone,moduleStation(room))<.16)room.hp=Math.min(maxHp(room),room.hp+dt*4*power);}
        continue;
      }
      if(!battle)continue;const player=battle.player;
      if(drone.phase==='launching'){
        const door=droneBayDoor(bay);drone.launchProgress+=dt*4*power;
        const point=hullPointWorld({x:door.x+Math.cos(door.direction)*drone.launchProgress,y:door.y+Math.sin(door.direction)*drone.launchProgress},player);Object.assign(drone,point);
        if(drone.launchProgress>=2&&distance(drone,player)>=player.r+35){drone.phase='active';drone.angle=Math.atan2(drone.y-player.y,drone.x-player.x);}
        continue;
      }
      if(drone.phase==='boarding')continue;
      if(drone.phase==='outbound'){
        const enemy=battle.enemies[drone.enemy];if(!enemy||!enemyAlive(enemy)){drone.phase='active';drone.angle=Math.atan2(drone.y-player.y,drone.x-player.x);continue;}
        const room=enemy.modules[drone.room],target=enemyRoomPoint(enemy,room),range=distance(drone,target),step=Math.min(range,dt*180*power);
        if(range>0){drone.x+=(target.x-drone.x)/range*step;drone.y+=(target.y-drone.y)/range*step;}
        if(range<=Math.max(10,step)){[drone.x,drone.y]=room.cells[0];drone.phase='boarding';drone.path=[];}
        continue;
      }
      const chosen=battle.enemies[battle.droneTarget??0],enemy=chosen&&enemyAlive(chosen)?chosen:battle.enemies.filter(enemyAlive).sort((a,b)=>distance(a,drone)-distance(b,drone))[0];
      const attacking=['combat','beam'].includes(drone.type);
      if(attacking&&enemy)moveAttackDrone(drone,enemy,dt,power);
      else{drone.angle+=dt*1.1*power;const radius=player.r+35;drone.x=player.x+Math.cos(drone.angle)*radius;drone.y=player.y+Math.sin(drone.angle)*radius;drone.facing=drone.angle+Math.PI/2;}
      if(drone.type==='boarding'){
        if(enemy&&distance(enemy,player)<=600&&Math.abs(angleDifference(drone.angle,Math.atan2(enemy.y-player.y,enemy.x-player.x)))<.2){drone.enemy=battle.enemies.indexOf(enemy);drone.room=Math.max(0,enemy.modules.findIndex((room)=>room.type==='weapon'&&room.hp>0));drone.phase='outbound';}
        continue;
      }
      if(drone.cooldown>0)continue;
      if(attacking){
        if(enemy&&distance(enemy,drone)<enemy.r+220&&hullRay(worldToHull(drone,player),Math.atan2(enemy.y-drone.y,enemy.x-drone.x)-player.angle,save.modules.flatMap(moduleCells),distance(enemy,drone)/COMBAT_TILE)>=distance(enemy,drone)/COMBAT_TILE-1e-7){
          if(drone.type==='beam')startBeam(drone,enemy,{drone:true,damage:9,range:400,duration:1,color:DRONE_PROGRAMS.beam.color});
          else fireProjectile('player',drone.x,drone.y,enemy,6,800,750,{drone:true,color:'#f3ad7d',family:'laser'});
          drone.cooldown=drone.type==='beam'?3:1.6;
        }
      }else{
        const incoming=battle.projectiles.filter((shot)=>shot.owner==='enemy'&&!(shot.delay>0)&&distance(shot,player)<player.r+230).sort((a,b)=>distance(a,player)-distance(b,player))[0];
        if(incoming){battle.projectiles.splice(battle.projectiles.indexOf(incoming),1);(battle.effects??=[]).push({x:drone.x,y:drone.y,to:{x:incoming.x,y:incoming.y},color:'#89ddd8',time:.2,duration:.2});drone.cooldown=.8;}
      }
    }
  }
  function drawDroneSprite(g,x,y,type,facing=0){
    g.save();g.translate(x,y);g.rotate(facing);x=0;y=0;
    g.fillStyle='#132535';g.fillRect(x-7,y-5,14,10);g.fillRect(x-10,y-2,20,4);g.fillStyle=DRONE_PROGRAMS[type].color;g.fillRect(x-5,y-3,10,6);g.fillStyle='#e5f4df';g.fillRect(x-2,y-2,4,2);
    if(type==='beam'){g.fillStyle='#9aa79f';g.fillRect(x+5,y-5,3,10);g.fillStyle='#f7d8a7';g.fillRect(x+8,y-3,3,6);}
    g.restore();
  }
  function drawEnemyCrew(g,enemy){
    const index=battle.enemies.indexOf(enemy);
    for(const guard of enemy.crew||[])if(guard.hp>0)drawCrewSprite(g,{...guard,x:guard.x,y:guard.y,color:'#ed8580',initial:'P'},ENEMY_TILE);
    for(const person of save.crew)if(crewAlive(person)&&person.aboard?.enemy===index)drawCrewSprite(g,{...person,x:person.aboard.x,y:person.aboard.y},ENEMY_TILE);
    for(const drone of battle.drones||[])if(drone.type==='boarding'&&drone.phase==='boarding'&&drone.enemy===index&&drone.hp>0)drawDroneSprite(g,drone.x*ENEMY_TILE,drone.y*ENEMY_TILE,'boarding');
  }
  function renderCrewOrders(){
    const panel=$('crewOrders');if(!panel)return;const person=selectedCrew();
    if(!person){panel.innerHTML='<p class="muted small">Click a crew portrait or person. Right click a floor cell to send them there. Living crew heal 3 HP/s at home after 5 seconds without damage.</p>';return;}
    panel.innerHTML=`<strong>${crewAppearance(person).name} · ${crewStatus(person)}</strong><p class="muted small">Right click a floor cell to move. Manual orders pause the assigned job.</p>${crewAlive(person)?person.aboard?`<button data-recall="${person.id}" ${!boardingReady(battle.enemies[person.aboard.enemy])?'disabled':''}>RECALL CREW</button>${battle.enemies[person.aboard.enemy].modules.map((room,i)=>`<button data-board-room="${i}" type="button">MOVE TO ${room.type==='weapon'?MODULES[room.weaponType||'weapon'].name.toUpperCase():room.type.toUpperCase()}</button>`).join('')}`:`<button id="resumeCrewJob" type="button">RESUME ASSIGNED JOB</button>${battle?battle.enemies.map((enemy,i)=>enemyAlive(enemy)?`<button data-board-crew="${i}" ${!boardingPad()?'disabled':''}>BOARD TEAM (UP TO 2) · ${enemy.name} ${i+1}</button>`:'').join(''):''}`:'<p class="muted small">Crew lost. Recruit replacements at a trader.</p>'}`;
    panel.querySelector?.('#resumeCrewJob')?.addEventListener('click',resumeCrewJob);
    panel.querySelectorAll('[data-board-crew]').forEach((button)=>button.addEventListener('click',()=>boardCrew(person.id,+button.dataset.boardCrew,2)));
    panel.querySelectorAll('[data-recall]').forEach((button)=>button.addEventListener('click',()=>{recallCrew(person.id);renderCrew();}));
    panel.querySelectorAll('[data-board-room]').forEach((button)=>button.addEventListener('click',()=>orderBoardedRoom(person,+button.dataset.boardRoom)));
  }
  function renderOperations(){
    renderCrewOrders();const panel=$('dronePanel');if(!panel)return;
    const mapStatus=$('mapDroneStatus');
    if(mapStatus){
      const assemblies=save.modules.filter((module)=>module.type==='droneAssembly');
      mapStatus.hidden=!assemblies.length;
      if(assemblies.length){
        const loaded=(save.drones||[]).filter((drone)=>drone.phase==='ready'||drone.phase==='active').length;
        const waiting=(save.drones||[]).filter((drone)=>drone.phase==='stored'||drone.phase==='carried').length;
        const producing=assemblies.filter((assembly)=>assembly.hp>0&&!assembly.buildPaused&&systemPower(assembly)>0).length;
        mapStatus.textContent=`DRONES ${loaded} LOADED · ${waiting} WAITING · ${producing}/${assemblies.length} ASSEMBLIES PRODUCING`;
      }
    }
    const bays=save.modules.filter((module)=>module.type==='droneControl'),assemblies=save.modules.filter((module)=>module.type==='droneAssembly'),drones=save.drones||[];
    panel.innerHTML=`<strong>${bays.length} BAYS · ${assemblies.length} ASSEMBLIES · ${drones.filter((drone)=>drone.hp>0).length} DRONES</strong><p class="muted small">Assemblies build continuously, including while exploring. Assign Deliver drones or Deliver ammo / drones to carry them to a clear bay. Bays have no drone limit; loaded drones launch automatically in combat. Pause an assembly when you have enough.</p>${bays.map((bay)=>`<div class="drone-row">BAY (${bay.x}, ${bay.y}) · ${bay.hp<=0?'OFFLINE':!droneBayClear(bay)?'BLOCKED LAUNCH LANE':`${droneCount(bay)} DRONES · NO SLOT LIMIT · CLEAR EXIT`}</div>`).join('')}${assemblies.map((assembly)=>{
      const built=drones.filter((drone)=>drone.assembly===assembly.id&&drone.hp>0),stored=built.filter((drone)=>drone.phase==='stored').length,loaded=built.filter((drone)=>drone.phase==='ready').length,type=DRONE_PROGRAMS[assembly.droneType]?assembly.droneType:'combat';
      return `<div class="drone-assembly"><label>${MODULES.droneAssembly.name.toUpperCase()} (${assembly.x}, ${assembly.y})<select data-drone-design="${assembly.id}" ${mode==='combat'?'disabled':''}>${Object.entries(DRONE_PROGRAMS).map(([id,def])=>`<option value="${id}" ${id===type?'selected':''}>${def.name}</option>`).join('')}</select></label><small>${built.length} BUILT · ${stored} WAITING FOR CREW · ${loaded} LOADED · ${assembly.hp<=0?'OFFLINE':assembly.buildPaused?'PRODUCTION PAUSED':systemPower(assembly)<=0?'NO POWER':`${Math.min(100,Math.floor((assembly.buildProgress||0)/assemblyTime(assembly)*100))}% NEXT DRONE`}</small><button type="button" data-drone-production="${assembly.id}">${assembly.buildPaused?'RESUME':'PAUSE'} PRODUCTION</button></div>`;
    }).join('')}${!assemblies.length?'<p class="muted small">Build a Drone Assembly and an exterior Drone Bay at a trader.</p>':''}${battle?`<p class="muted small">TELEPORTER ${boardingPad()?`${Math.ceil(battle.teleportCooldown||0)}s RECHARGE · 600 RANGE`:'NOT INSTALLED / OFFLINE'}</p>${battle.enemies.map((enemy,i)=>enemyAlive(enemy)?`<button data-drone-target="${i}" aria-pressed="${(battle.droneTarget??0)===i}">TARGET ${enemy.name} ${i+1}</button>`:'').join('')}`:''}`;
    panel.querySelectorAll('[data-drone-design]').forEach((select)=>select.addEventListener('change',()=>setDroneDesign(+select.dataset.droneDesign,select.value)));
    panel.querySelectorAll('[data-drone-production]').forEach((button)=>button.addEventListener('click',()=>toggleDroneProduction(+button.dataset.droneProduction)));
    panel.querySelectorAll('[data-drone-target]').forEach((button)=>button.addEventListener('click',()=>{battle.droneTarget=+button.dataset.droneTarget;renderOperations();}));
  }

  function crewWorkPlan(extraPerson=null){
    const people=save.crew.filter((person)=>crewHome(person)&&!person.manualGoal&&!person.boardOrder);
    if(extraPerson&&crewHome(extraPerson)&&!extraPerson.manualGoal&&!extraPerson.boardOrder&&!people.includes(extraPerson))people.push(extraPerson);
    const assignments=new Map(),occupied=occupancy(),components=new Map();
    planDroneDeliveries(people,assignments);
    // Crew may only reserve consoles in their connected floor component.
    function component(point){
      const key=`${Math.floor(point.x)},${Math.floor(point.y)}`;
      if(components.has(key))return components.get(key);
      const cells=new Set(),queue=occupied.has(key)?[key]:[];
      for(let i=0;i<queue.length;i++){
        const cell=queue[i];if(cells.has(cell))continue;cells.add(cell);
        const [x,y]=cell.split(',').map(Number);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=`${x+dx},${y+dy}`;if(occupied.has(next)&&!cells.has(next))queue.push(next);}
      }
      for(const cell of cells)components.set(cell,cells);
      return cells;
    }
    const reachable=(person,module)=>{const point=moduleStation(module);return component(person).has(`${Math.floor(point.x)},${Math.floor(point.y)}`);};
    const canLoad=(person,module)=>person.task!=='load'||(person.carrying?person.carrying.type===MODULES[module.type].ammoType:ammoSources(MODULES[module.type].ammoType).some((source)=>reachable(person,source.module)));
    for(const task of ['pilot','engine','gun','shield','repair','load']){
      const modules=save.modules.filter((module)=>{
        if(module.hp<=0)return false;
        if(task==='pilot')return module.type==='core';
        if(task==='engine')return ENGINE_TYPES.includes(module.type);
        if(task==='gun')return WEAPON_TYPES.includes(module.type);
        if(task==='shield')return SHIELD_TYPES.includes(module.type);
        if(task==='repair')return module.hp<maxHp(module);
        return !!MODULES[module.type].ammoType&&magazineCount(module)<MODULES[module.type].magazine;
      });
      const crew=people.filter((person)=>person.task===task&&!assignments.has(person)),free=new Set(modules),waiting=new Set(crew);
      function reserve(person,module){assignments.set(person,module);free.delete(module);waiting.delete(person);}
      // Keep operators at work, then honor reservations made before arrival.
      for(const person of crew){
        const module=modules.find((module)=>free.has(module)&&canLoad(person,module)&&distance(person,moduleStation(module))<.16&&
          ((person.workTask===task&&person.workModuleId===module.id)||(person.workTask===undefined&&!['repair','load'].includes(task))));
        if(module)reserve(person,module);
      }
      for(const person of waiting){
        const module=modules.find((module)=>module.id===person.workModuleId);
        if(person.workTask===task&&free.has(module)&&reachable(person,module)&&canLoad(person,module))reserve(person,module);
      }
      for(const person of waiting){
        const options=[...free].filter((module)=>reachable(person,module)&&canLoad(person,module));
        options.sort((a,b)=>(task==='repair'?a.hp/maxHp(a)-b.hp/maxHp(b):task==='load'?magazineCount(a)/MODULES[a.type].magazine-magazineCount(b)/MODULES[b.type].magazine:0)||distance(person,moduleStation(a))-distance(person,moduleStation(b)));
        if(options.length)reserve(person,options[0]);
      }
      for(const person of crew){person.workTask=task;person.workModuleId=assignments.get(person)?.id??null;}
    }
    for(const person of people)if(person.task==='idle'){person.workTask='idle';person.workModuleId=null;}
    return assignments;
  }
  function crewGoal(person,route={},plan=crewWorkPlan(person)){
    const core=save.modules.find((module)=>module.type==='core'),work=plan.get(person);
    if(person.manualGoal||person.boardOrder){const point=person.manualGoal||moduleStation(save.modules.find((module)=>module.id===person.boardOrder.pad)||core);return {module:occupancy().get(`${Math.floor(point.x)},${Math.floor(point.y)}`)||core,point,working:false};}
    if(person.droneJob||person.droneCargo!==undefined){
      const drone=save.drones.find((drone)=>drone.id===(person.droneCargo??person.droneJob?.drone));
      if(drone){const bay=save.modules.find((part)=>part.id===person.droneJob?.bay),point=person.droneCargo!==undefined?(bay?moduleStation(bay):{x:person.x,y:person.y}):dronePickupPoint(drone);return {module:person.droneCargo!==undefined?bay||core:save.modules.find((part)=>part.id===drone.assembly)||core,point,working:!!bay};}
    }
    let module=work||core;
    if(person.task==='load'&&work&&!person.carrying)module=reachableAmmoSources(person,MODULES[work.type].ammoType)[0]?.module||core;
    return {module,point:moduleStation(module),working:!!work};
  }
  function crewStatus(person){
    if(!crewAlive(person))return 'DEAD';
    if(person.aboard)return 'BOARDING';
    if(person.boardOrder)return 'TO TELEPORTER';
    if(person.manualGoal)return 'MANUAL';
    const route=crewRoutes[person.id];
    if(person.droneCargo!==undefined)return 'CARRYING DRONE';
    if(person.droneJob)return 'FETCHING DRONE';
    if(person.carrying)return `CARRYING ${person.carrying.amount} ${person.carrying.type.toUpperCase()}`;
    if(route?.path?.length&&distance(person,route.path[0])>.08)return 'WALKING';
    if(person.task==='idle')return 'STAND BY';
    return route?.working===false?'WAITING':'AT STATION';
  }
  function updateCrew(dt){
    const plan=crewWorkPlan();
    for(const person of save.crew){
      if(!crewAlive(person))continue;
      const healingTime=Math.max(0,dt-(person.hurtTime||0));person.hurtTime=Math.max(0,(person.hurtTime||0)-dt);
      if(person.aboard)continue;
      person.hp=Math.min(100,(person.hp??100)+healingTime*3);
      let route=crewRoutes[person.id];
      if(!route){route={path:[],target:'',phase:'pickup'};crewRoutes[person.id]=route;}
      if(['load','drone'].includes(person.task))route.phase=person.carrying||person.droneCargo!==undefined?'drop':'pickup';
      const goal=crewGoal(person,route,plan),target=`${person.task}:${goal.module.id}:${route.phase}:${person.manualGoal?`${goal.point.x},${goal.point.y}`:person.boardOrder?'board':''}:${person.droneJob?`drone:${person.droneJob.drone}:${person.droneJob.bay}`:person.droneCargo!==undefined?'drone-wait':''}`;
      route.working=goal.working;
      if(route.target!==target){route.path=walkPath(person,goal.point);route.target=target;}
      let travel=dt*2.4;
      while(route.path.length&&travel>0){
        const next=route.path[0],d=distance(person,next);
        if(d<=travel){person.x=next.x;person.y=next.y;travel-=d;route.path.shift();}
        else {person.x+=(next.x-person.x)/d*travel;person.y+=(next.y-person.y)/d*travel;travel=0;}
      }
      if(person.boardOrder&&!route.path.length&&distance(person,goal.point)<.12)tryBoardCrew(person);
      if(person.droneCargo!==undefined){const drone=save.drones.find((drone)=>drone.id===person.droneCargo);if(drone){drone.x=person.x;drone.y=person.y;}}
      if(person.droneJob||person.droneCargo!==undefined){handleDroneDelivery(person,goal,route);continue;}
      if(person.task==='load'&&!person.manualGoal&&!person.boardOrder&&!route.path.length&&distance(person,goal.point)<.12){
        const weapon=plan.get(person);
        if(person.carrying){
          const carried=person.carrying;
          if(weapon&&goal.module===weapon&&MODULES[weapon.type].ammoType===carried.type){
            const amount=Math.min(carried.amount,MODULES[weapon.type].magazine-magazineCount(weapon));
            weapon.magazine=magazineCount(weapon)+amount;carried.amount-=amount;
          }else if(!weapon&&goal.module.type==='core'){
            save.ammunition[carried.type]+=carried.amount;carried.amount=0;
          }
          if(!carried.amount)delete person.carrying;
          route.target='';persist();
        }else if(weapon){
          const type=MODULES[weapon.type].ammoType,source=ammoSources(type).find(({module})=>module===goal.module);
          if(source){
            const amount=Math.min(4,source.stock[type],MODULES[weapon.type].magazine-magazineCount(weapon));
            if(amount>0){source.stock[type]-=amount;person.carrying={type,amount};route.target='';persist();}
          }
        }
      }
    }
  }
  function crewAtStation(task,module){
    const point=moduleStation(module);
    return Math.min(1,save.crew.filter((person)=>crewHome(person)&&!person.manualGoal&&!person.boardOrder&&person.task===task&&(person.workModuleId===undefined||person.workModuleId===module.id)&&distance(person,point)<.16).length);
  }

  function setMode(next){
    if(mode==='trade'&&next!=='trade'&&!connectedHull(save.modules)){
      toast('Reconnect every room by an edge before leaving the trader.');renderRefitControls();return false;
    }
    mode=next;
    if(next!=='trade'){selectedCatalog=null;movingModuleId=null;rearrangingShip=false;roomDrag=null;refittingFootprint=false;tradeNode=null;}
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
    container.innerHTML=map.nodes.map((node,index)=>{
      const isCurrent=node.id===current.id,isAvailable=available.has(node.id),visited=map.visited.includes(node.id);
      const info=EVENT_TYPES[node.type]||{name:'CURRENT',icon:'✦'};
      const cls=isCurrent?'current':isAvailable?`available${visited?' revisited':''}`:visited?'visited':'future';
      return `<button type="button" class="map-node ${cls} type-${node.type}" data-node="${node.id}" style="left:${node.mapX/10}%;top:${node.mapY/6}%" ${!isAvailable||!activeModules(...ENGINE_TYPES).length?'disabled':''} aria-label="Sector ${String(save.sector).padStart(2,'0')} ${info.name}${visited?', visited':''}${isAvailable?', available next':''}"><span>${info.icon}</span><strong>${info.name}</strong><small>${isCurrent?'YOU ARE HERE':visited?'VISITED':`BEACON ${String(index+1).padStart(2,'0')}`}</small></button>`;
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
    advanceRoute();hideEvent();openMap();log(`${title}: ${body}`);persist();renderAll();toast(`${icon} ${title}`);
  }
  function damageRandomModule(amount,localShields=false){
    const live=save.modules.filter((module)=>module.hp>0),target=live[Math.floor(Math.random()*live.length)];
    if(localShields){
      const cells=moduleCells(target),[x,y]=cells[Math.floor(Math.random()*cells.length)],point={x:(x+.5)*COMBAT_TILE,y:(y+.5)*COMBAT_TILE};
      if(activeModules(...SHIELD_TYPES).some((shield)=>shieldContains(shieldGeometry(shield),point)))return null;
    }
    target.hp=Math.max(1,target.hp-amount);return target;
  }
  function awardCrew(name,color){
    const core=commandCore(),point=moduleStation(core);
    save.nextCrewId??=1;
    let id;do{id=`crew-${save.nextCrewId++}`;}while(save.crew.some((person)=>person.id===id));
    let displayName=name,suffix=2;
    while(save.crew.some((person)=>person.name===displayName))displayName=`${name} ${suffix++}`;
    save.crew.push({id,name:displayName,initial:name[0],color,task:'idle',hp:100,hurtTime:0,...point});
    log(`${displayName} joined the crew.`);
    return displayName;
  }
  function awardWeapon(type){
    save.inventory[type]=(save.inventory[type]||0)+1;
    log(`${MODULES[type].name} recovered and stored in the hold.`);
    return MODULES[type].name;
  }
  function upgradeTraderStock(node){
    delete node.supplyPacks;
    node.stock??=traderStock();node.stock=ensureDroneStock(node.stock.filter((item)=>item.type!=='cargo'));delete node.dronePacks;
    if(!Array.isArray(node.recruits))node.recruits=traderRecruits();
    node.stockVersion=10;
  }

  function openTrader(node){
    upgradeTraderStock(node);persist();hideEvent();setMode('trade');tradeNode=node;marketFilter='all';renderAll();
  }
  function openOutpost(node){
    const choices=[];
    if(save.passengers>0)choices.push({label:`DELIVER ${save.passengers} SURVIVOR${save.passengers===1?'':'S'}`,action:()=>{
      const count=save.passengers,reward=count*20;save.passengers=0;save.metal+=reward;
      concludeEvent('SURVIVORS DELIVERED',`${count} survivors brought safely to the outpost; ${reward} metal paid for the rescue.`,'⌂');
    }});
    choices.push({label:'DOCK FOR REPAIRS · ◆ 12',disabled:save.metal<12||hullRatio()>=.999,action:()=>{
      save.metal-=12;repairAll(40);concludeEvent('HULL PATCHED','Outpost crew repaired damaged rooms for 12 metal.','⌂');
    }});
    choices.push({label:'LEAVE OUTPOST →',action:()=>{hideEvent();openMap();}});
    showEvent({type:'CIVILIAN SIGNAL // OUTPOST',icon:'⌂',title:'FRINGE OUTPOST',
      body:save.passengers?`The station has room for ${save.passengers} survivors aboard your ship. Its technicians also offer hull repairs.`:'The technicians can repair damaged rooms here. Return any time you need their help.',choices});
  }
  function chartShortcut(node){
    const candidates=save.map.nodes.filter((target)=>target.id!==node.id&&!node.links.includes(target.id)&&Math.hypot(target.mapX-node.mapX,target.mapY-node.mapY)>260);
    candidates.sort((a,b)=>Math.hypot(b.mapX-node.mapX,b.mapY-node.mapY)-Math.hypot(a.mapX-node.mapX,a.mapY-node.mapY));
    const target=candidates[0];if(!target)return null;
    node.links.push(target.id);target.links.push(node.id);return target;
  }
  function beaconNumber(node){return String(save.map.nodes.findIndex((item)=>item.id===node.id)+1).padStart(2,'0');}
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
      if(variant===1)eventScene(node,'DISABLED ORE HAULER','A hauler has lost its drive near drifting wreckage. Its mechanic hails your ship, asking for help with the heavy vessel.',[
        {label:'ATTACH A TOW LINE',action:()=>{const engine=activeModules(...ENGINE_TYPES)[0];if(engine)engine.hp=Math.max(1,engine.hp-12);const recruit=awardCrew('TAMSIN','#91d6b5');concludeEvent('HAULER DELIVERED',`${recruit} joins your crew after the tow. The heavy load strains one engine for 12 damage. Assign a job in the crew panel.`,'◇');}},
        {label:'TRANSFER REPAIR METAL · ◆ 10',disabled:save.metal<10,action:()=>{save.metal+=12;log('Hauler owner paid 22 metal for 10 metal of repairs.');concludeEvent('DRIVE RESTARTED','Your crew uses 10 metal to patch the drive; the owner pays 22 for the help.','◇');}},
        {label:'CONTINUE ON YOUR ROUTE',action:()=>concludeEvent('HAULER MARKED','You send its coordinates to the nearest outpost.','◇')}
      ]);
      if(variant===2)eventScene(node,'CONVOY REARGUARD','A small ore convoy needs time to reach a jump beacon. Pirate skiffs are gaining on its last ship.',[
        {label:'HOLD OFF THE SKIFFS →',action:()=>startBattle('rescue')},
        {label:'COVER WITH AMMO DECOYS · −8 METAL',disabled:save.metal<8,action:()=>{save.metal-=8;recoverAmmoCrate();log('Convoy escaped and left a munitions crate.');concludeEvent('CONVOY CLEAR','Your decoys cost 8 metal. The grateful crew leaves 8 heavy rounds and 4 missile rounds.','◇');}},
        {label:'STAY OUT OF THE FIGHT',action:()=>concludeEvent('CONVOY SIGNAL LOST','The convoy disappears from your scope.','◇')}
      ]);
      return;
    }
    if(node.type==='salvage'){
      if(variant===0)eventScene(node,'LOOSE ALLOY PALLETS','A broken freight rack has scattered clean alloy plates. The outer pallets are easy to collect.',[
        {label:'COLLECT OUTER PALLETS',action:()=>{save.metal+=18;log('18 metal collected from loose pallets.');concludeEvent('ALLOY SECURED','The crew hauls the accessible plates aboard.','✧');}},
        {label:'CUT OPEN THE INNER RACK',action:()=>{save.metal+=30;const target=damageRandomModule(12);log('Inner rack yielded 30 metal but struck a room.');concludeEvent('RACK OPENED',`You gain 30 metal; tumbling cargo damages your ${MODULES[target.type].name.toLowerCase()} by 12.`,'✧');}}
      ]);
      if(variant===1)eventScene(node,'SEALED MUNITIONS POD','A military supply pod still has an intact ammunition seal. Its metal casing can also be recycled.',[
        {label:'OPEN THE AMMUNITION POD',action:()=>{recoverAmmoCrate();log('One ammo crate unpacked into persistent ammunition stores.');concludeEvent('AMMO STORED','8 heavy rounds and 4 missile rounds added to your stores.','✧');}},
        {label:'RECYCLE THE CASING',action:()=>{save.metal+=12;log('12 metal recycled from the pod.');concludeEvent('CASING RECYCLED','The crew strips the empty shell for usable alloy.','✧');}}
      ]);
      if(variant===2)eventScene(node,'REPAIR DRONE HULK','A damaged maintenance drone floats among cargo debris. Its repair arm still responds to commands.',[
        {label:'ACTIVATE THE REPAIR DRONE',disabled:hullRatio()>=.999,action:()=>{repairAll(30);log('Salvaged drone repaired 30 hull.');concludeEvent('DRONE REPAIRS COMPLETE','The drone patches your most damaged rooms before its battery dies.','✧');}},
        {label:'STRIP ITS PARTS',action:()=>{save.metal+=16;log('16 metal stripped from a repair drone.');concludeEvent('PARTS RECOVERED','Its motors and chassis are broken down for metal.','✧');}}
      ]);
      return;
    }
    if(node.type==='anomaly'){
      if(variant===0)eventScene(node,'ION STORM','Charged dust sweeps across the route. Metallic fragments glitter inside the cloud as static crawls over your engine readouts.',[
        {label:'SCOOP FRAGMENTS',action:()=>{save.metal+=25;const engine=activeModules(...ENGINE_TYPES)[0];if(engine)engine.hp=Math.max(1,engine.hp-14);log('Ion storm yielded 25 metal and strained an engine.');concludeEvent('FRAGMENTS RECOVERED','The crew secures 25 metal. An ion engine takes 14 damage.','◈');}},
        {label:'WAIT FOR THE STORM TO PASS',action:()=>concludeEvent('CLEAR SKIES','You hold position until the charged dust thins.','◈')}
      ]);
      if(variant===1)eventScene(node,'GRAVITY LENS','A stable gravity lens links this beacon to a distant lane. The crew can chart a shortcut or mine its trapped alloy.',[
        {label:'SURVEY THE LENS',action:()=>{const target=chartShortcut(node);log('A gravity-lens shortcut was added to the sector chart.');concludeEvent('ROUTE OPENED',target?`A new two-way route to beacon ${beaconNumber(target)} appears on the chart.`:'The lens leads back to known space.','◈');}},
        {label:'MINE TRAPPED ALLOY',action:()=>{save.metal+=14;log('14 metal mined from the gravity lens.');concludeEvent('ALLOY MINED','The crew pries fragments from the lens instead of charting a route.','◈');}}
      ]);
      if(variant===2)eventScene(node,'MAGNETIC TIDE','A narrow magnetic tide is pulling scrap toward a dead satellite. Your crew can skim its edge or shut down and wait.',[
        {label:'SKIM THE EDGE',action:()=>{save.metal+=20;const target=damageRandomModule(10);log('Magnetic tide yielded 20 metal and damaged a room.');concludeEvent('SCRAP COLLECTED',`You recover 20 metal; the tide stresses your ${MODULES[target.type].name.toLowerCase()} by 10.`,'◈');}},
        {label:'POWER DOWN AND WAIT',action:()=>concludeEvent('TIDE PASSED','The crew waits for the debris to drift clear.','◈')}
      ]);
      return;
    }
    if(node.type==='derelict'){
      if(variant===0)eventScene(node,'RESEARCH VESSEL','An unpowered research ship still has a hot security grid. A sealed cargo hold sits behind the locked doors; exterior plating is easier to reach.',[
        {label:'STRIP THE EXTERIOR',action:()=>{save.metal+=12;log('12 metal stripped from research vessel exterior.');concludeEvent('EXTERIOR SALVAGED','The crew leaves the security grid untouched.','▣');}},
        {label:'BREACH THE HOLD',action:()=>{const target=damageRandomModule(20);awardWeapon('ion');concludeEvent('ION BLASTER RECOVERED',`The weapon is in your hold for installation at a trader. A security charge hits your ${MODULES[target.type].name.toLowerCase()} for 20.`,'▣');}}
      ]);
      if(variant===1)eventScene(node,'ABANDONED MEDICAL SHIP','A medic is sheltering aboard an abandoned hospital ship. Emergency repair drones still wait in their cradles.',[
        {label:'DEPLOY REPAIR DRONES',disabled:hullRatio()>=.999,action:()=>{repairAll(35);log('Medical ship drones repaired 35 hull.');concludeEvent('REPAIRS COMPLETE','The drones weld damaged rooms before their batteries expire.','▣');}},
        {label:'BRING THE MEDIC ABOARD',action:()=>{const recruit=awardCrew('MIRA','#bca8f1');concludeEvent('MEDIC RESCUED',`${recruit} joins your crew. Assign a repair job or another role in the crew panel.`,'▣');}}
      ]);
      if(variant===2)eventScene(node,'SILENT GUNSHIP','The derelict gunship has sealed ammunition lockers and a weapon still attached to its exterior mount.',[
        {label:'SEARCH THE AMMUNITION LOCKERS',action:()=>{recoverAmmoCrate();log('One ammo crate taken from a gunship.');concludeEvent('AMMUNITION RECOVERED','8 heavy rounds and 4 missile rounds added to your stores.','▣');}},
        {label:'SALVAGE THE WEAPON MOUNT',action:()=>{awardWeapon('laser');concludeEvent('LASER REPEATER RECOVERED','The working weapon is secured in your hold. Visit a trader to install it on your ship.','▣');}}
      ]);
      return;
    }
    if(node.type==='relay'){
      if(variant===0)eventScene(node,'BROKEN ROUTE RELAY','Its memory contains a route to a distant beacon. The copper antenna could instead be recycled.',[
        {label:'REPAIR THE RELAY',action:()=>{const target=chartShortcut(node);log('A relay shortcut was added to the sector chart.');concludeEvent('RELAY RESTORED',target?`The chart now connects to beacon ${beaconNumber(target)}.`:'The relay points only to lanes you already know.','⌁');}},
        {label:'RECYCLE THE ANTENNA',action:()=>{save.metal+=14;log('14 metal recovered from a relay.');concludeEvent('ANTENNA RECYCLED','The relay goes dark as its copper is stowed aboard.','⌁');}}
      ]);
      if(variant===1)eventScene(node,'OLD NAVIGATION BUOY','A retired patrol buoy has sealed emergency ammunition and a recyclable steel chassis.',[
        {label:'OPEN EMERGENCY STORAGE',action:()=>{recoverAmmoCrate();log('Patrol buoy supplied an ammo crate.');concludeEvent('AMMO RECOVERED','8 heavy rounds and 4 missile rounds added to your stores.','⌁');}},
        {label:'RECYCLE THE CHASSIS',action:()=>{save.metal+=11;log('11 metal recovered from a patrol buoy.');concludeEvent('CHASSIS RECYCLED','The buoy is broken down into useful steel.','⌁');}}
      ]);
      if(variant===2)eventScene(node,'ABANDONED JUMP MARKER','A jump marker is out of alignment. Replacement couplers would reopen a distant two-way lane.',[
        {label:'REPLACE COUPLERS · −8 METAL',disabled:save.metal<8,action:()=>{save.metal-=8;const target=chartShortcut(node);log('A jump marker shortcut was restored for 8 metal.');concludeEvent('JUMP MARKER ONLINE',target?`The marker now connects to beacon ${beaconNumber(target)}.`:'The marker points only to known lanes.','⌁');}},
        {label:'LEAVE THE MARKER DARK',action:()=>concludeEvent('MARKER BYPASSED','You keep your couplers and follow the original lanes.','⌁')}
      ]);
      return;
    }
    if(node.type==='minefield'){
      if(variant===0)eventScene(node,'DRIFTING MINES','Old anti-ship mines drift across the route. Their metal cases look salvageable, but several fuses are still blinking.',[
        {label:'SWEEP AND SALVAGE',action:()=>{save.metal+=22;const target=damageRandomModule(14,true);log('22 metal salvaged from a minefield.');concludeEvent('MINES CLEARED',target?`The mines yield 22 metal, but your ${MODULES[target.type].name.toLowerCase()} takes 14 damage.`:'Your shield holds while the crew collects 22 metal.','◌');}},
        {label:'SKIRT THE FIELD',action:()=>concludeEvent('FIELD AVOIDED','The crew takes the long clear lane around the mines.','◌')}
      ]);
      if(variant===1)eventScene(node,'FREIGHT CONTAINER TRAP','A sealed container lies inside a mine perimeter. Remote cutters can free it, but replacement blades cost metal.',[
        {label:'CUT IT FREE · ◆ 8',disabled:save.metal<8,action:()=>{save.metal+=20;log('Container salvage netted 20 metal after cutter costs.');concludeEvent('CONTAINER OPENED','The recovered cargo contains 28 metal; replacement cutters cost 8.','◌');}},
        {label:'LEAVE THE CONTAINER',action:()=>concludeEvent('TRAP BYPASSED','You pass the mine perimeter without touching the cargo.','◌')}
      ]);
      if(variant===2)eventScene(node,'DEACTIVATED TORPEDO NET','A line of failed torpedoes hangs in the current. Their propellant is gone, but the warheads can supply your guns.',[
        {label:'RECOVER WARHEADS',action:()=>{recoverAmmoCrate();log('Torpedo net yielded one ammo crate.');concludeEvent('WARHEADS SECURED','8 heavy rounds and 4 missile rounds added to your stores.','◌');}},
        {label:'RECYCLE CASINGS',action:()=>{save.metal+=13;log('13 metal recycled from torpedo casings.');concludeEvent('CASINGS RECYCLED','The crew strips the empty housings for alloy.','◌');}}
      ]);
      return;
    }
    if(node.type==='lifeboat'){
      const count=[2,1,3][variant],titles=['FREIGHTER LIFEBOAT','LONE ESCAPE POD','DRIFTING SHUTTLE'];
      const cost=[0,6,0][variant],strain=[0,0,8][variant];
      const situation=['The lifeboat has air for a short journey.','A leaking escape pod needs six metal in sealant before its pilot can board.','A three-person shuttle is tangled in wreckage, its distress light blinking beneath the debris.'][variant];
      eventScene(node,titles[variant],`${situation} The nearest outpost may be able to shelter anyone you take aboard.`,[
        {label:`TAKE SURVIVORS ABOARD${cost?' · ◆ 6':''}`,disabled:save.metal<cost,action:()=>{save.metal-=cost;save.passengers+=count;const engine=strain?activeModules(...ENGINE_TYPES)[0]:null;if(engine)engine.hp=Math.max(1,engine.hp-strain);log(`${count} survivors taken aboard for outpost delivery.`);concludeEvent('SURVIVORS ABOARD',`The ${count} survivor${count===1?' is':'s are'} safe aboard. An outpost will pay for their return.${cost?' Six metal was used to seal the pod.':''}${engine?' The tow strained an engine.':''}`,'♡');}},
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
    $('menuConfirm').hidden=true;$('starterPicker').hidden=true;renderMainMenu();
  }
  function showGame(){
    screen='playing';$('mainMenu').hidden=true;$('quitScreen').hidden=true;$('appShell').hidden=false;
    centerBuildView(false);
    const node=currentMapNode();
    if(!connectedHull(save.modules)&&node?.type==='trader')openTrader(node);else setMode('hangar');
    renderAll();
  }
  function showStarterPicker(){
    $('menuConfirm').hidden=true;$('starterPicker').hidden=false;
    $('starterLineup').innerHTML=STARTER_SHIPS.map((ship)=>`<button class="starter-card" type="button" data-starter="${ship.id}" aria-label="Start new game with ${ship.name}"><span class="eyebrow">${ship.role}</span><strong>${ship.name}</strong><canvas width="360" height="240" data-starter-preview="${ship.id}" aria-hidden="true"></canvas><span>${ship.description}</span><small>100-strength full-hull shield · ${ship.id==='wayfarer'?3:ship.id==='drones'?5:6} crew · 90 metal</small><b>CHOOSE ${ship.name.toUpperCase()} →</b></button>`).join('');
    const original=save;
    try{
      for(const preview of $('starterLineup').querySelectorAll('canvas[data-starter-preview]')){
        save={...original,modules:starterModules(preview.dataset.starterPreview),crew:[],drones:[]};
        sizeArtCanvas(preview,shipArtFrame());drawInterior(preview.getContext('2d'));
      }
    }finally{save=original;}
    $('starterLineup').querySelectorAll('[data-starter]').forEach((button)=>button.addEventListener('click',()=>startNewGame(button.dataset.starter)));
    $('starterPicker').scrollIntoView?.({block:'nearest',behavior:'smooth'});
    $('starterLineup').querySelector?.('button')?.focus();
  }
  function startNewGame(starterId='wayfarer'){
    save=newSave(starterId);battle=null;pendingNodeId=null;eventOpen=false;$('eventOverlay').hidden=true;
    selectedCrewId=null;selectedModuleId=1;selectedCatalog=null;buildRotation=0;buildWeaponFacing=0;buildFlipped=false;hoverCell=null;
    for(const id of Object.keys(crewRoutes))delete crewRoutes[id];
    logEntries.length=0;persist();log('New journey initiated.');showGame();
  }
  function returnToMainMenu(){
    if(screen!=='playing')return;
    if(battle){recoverBoarders();recoverDrones();battle=null;for(const module of save.modules)delete module.cooldown;}
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
    armor: [[-1,1],[0,1],[-1,2],[0,2]],
    shield: [[1,1],[2,1],[1,2],[2,2]]
  };
  const ENEMY_LOADOUTS = {
    cannon: {name:'CANNON',weapons:['weapon']},
    laser: {name:'LASER',weapons:['laser']},
    missile: {name:'MISSILE',weapons:['missile']},
    assault: {name:'ASSAULT',weapons:['laser','missile']}
  };
  function enemyWeaponMount(enemy,room){
    const [x,y]=room.muzzle||[3.5,-1],cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle);
    return {x:enemy.x+x*ENEMY_TILE*cos-y*ENEMY_TILE*sin,y:enemy.y+x*ENEMY_TILE*sin+y*ENEMY_TILE*cos,direction:enemy.angle};
  }
  function enemyWeaponStats(room,sector=save.sector){
    const type=room.weaponType||'weapon',def=MODULES[type];
    return {type,damage:Math.round(def.damage*.6+sector*.35),reload:def.reload*1.6,range:def.range,speed:def.speed,ammo:def.ammo,color:def.color,family:def.family,guidance:def.guidance||0,splash:def.splash||0,arc:def.arc};
  }
  function fireEnemyWeapons(enemy,dt){
    if(!enemyAlive(enemy))return;enemy.ammo??=18+save.sector*4;
    const rooms=enemy.modules?.length?enemy.modules.filter((room)=>room.type==='weapon'&&room.hp>0):[enemy];
    for(const room of rooms){
      const efficiency=systemEfficiency(room)*enemySystemEfficiency(enemy,'core'),stats=enemyWeaponStats(room),mount=enemyWeaponMount(enemy,room),player=battle.player;
      const aim=Math.atan2(player.y-mount.y,player.x-mount.x),wanted=stats.guidance?0:clamp(angleDifference(mount.direction,aim),-stats.arc*Math.PI/360,stats.arc*Math.PI/360);
      room.aimOffset=(room.aimOffset||0)+clamp(wanted-(room.aimOffset||0),-Math.PI*dt*efficiency,Math.PI*dt*efficiency);
      room.cooldown=(room.cooldown??enemy.cooldown??.7)-dt*efficiency;room.flash=Math.max(0,(room.flash||0)-dt);
      if(efficiency<=0||room.cooldown>0||distance(mount,player)>stats.range||(enemy.ammo??0)<stats.ammo||Math.abs(wanted-room.aimOffset)>=.015)continue;
      if(!stats.guidance&&Math.abs(angleDifference(mount.direction,aim))>stats.arc*Math.PI/360)continue;
      const angle=mount.direction+room.aimOffset;
      const clearance=stats.guidance?Math.max(4,...(enemy.modules||[]).flatMap((part)=>part.cells.map(([x])=>(x+.5-(room.muzzle?.[0]??3.5))*ENEMY_TILE+4))):0;
      enemy.ammo-=stats.ammo;room.cooldown=stats.reload;room.flash=.1;
      fireProjectile('enemy',mount.x+Math.cos(angle)*.01,mount.y+Math.sin(angle)*.01,player,stats.damage,stats.speed,stats.range,{angle,muzzleClearance:36,family:stats.family,color:stats.color,guidance:stats.guidance,target:stats.guidance?player:null,launchRemaining:clearance,splash:stats.splash,source:enemy,weaponType:stats.type});
    }
  }
  function enemyShieldRooms(enemy){return (enemy.modules||[]).filter((room)=>room.type==='shield');}
  function enemyShieldState(enemy,room){
    const capacity=room.capacity??100;room.charge??=capacity;
    room.charge=room.hp>0&&enemyAlive(enemy)?clamp(room.charge,0,capacity):0;
    return {charge:room.charge,capacity};
  }
  function enemyShieldStrength(enemy){
    return enemyShieldRooms(enemy).reduce((sum,room)=>sum+enemyShieldState(enemy,room).charge,0);
  }
  function updateEnemyShields(enemy,dt){
    for(const room of enemyShieldRooms(enemy)){
      const state=enemyShieldState(enemy,room),waiting=Math.min(room.shieldDelay||0,dt);
      room.shieldDelay=Math.max(0,(room.shieldDelay||0)-dt);room.shieldFlash=Math.max(0,(room.shieldFlash||0)-dt);
      if(room.hp>0&&enemyAlive(enemy))room.charge=Math.min(state.capacity,room.charge+(dt-waiting)*(room.recharge??6)*systemEfficiency(room)*enemySystemEfficiency(enemy,'core'));
    }
  }
  function absorbEnemyShields(enemy,amount){
    for(const room of enemyShieldRooms(enemy)){
      const state=enemyShieldState(enemy,room);if(amount<=0||state.charge<=0)continue;
      const absorbed=Math.min(amount,state.charge);room.charge-=absorbed;amount-=absorbed;room.shieldDelay=1.7;room.shieldFlash=.22;
    }
    return amount;
  }
  function enemyShieldInterception(enemy,shot,dx,dy,limit){
    if(enemyShieldStrength(enemy)<=1e-7)return null;
    const entry=rayCircle(shot,dx,dy,enemy,enemy.r+17);
    return entry<=limit?{distance:entry,room:rayEnemyRoom(shot,dx,dy,enemy,Infinity).room}:null;
  }
  function enemyMissileImpact(shot,playerHit=false,hitRock=null){
    (battle.effects??=[]).push({x:shot.x,y:shot.y,r:shot.splash,color:shot.color,time:.35,duration:.35});
    for(const rock of [...battle.asteroids])if(rock!==hitRock&&distance(rock,shot)<=shot.splash+rock.r)damageAsteroid(rock,shot.damage*.55);
    if(!playerHit&&!shot.evaded){
      const point=nearestPlayerHullPoint(shot),range=point?distance(shot,point):Infinity;
      if(range<=shot.splash){
        const dx=(point.x-shot.x)/(range||1),dy=(point.y-shot.y)/(range||1);
        const contacts=shieldContacts(shot,dx,dy,battle.player,range),remaining=absorbShields(shot.damage*.55,contacts.map((hit)=>hit.module));
        if(remaining>0)damagePlayer(remaining,point);
      }
    }
  }
  function enemyLayout(heavy,sector=1,loadout='cannon'){
    const types=heavy?['core','weapon','engine','armor','shield']:['core','weapon','engine','shield'];
    const health={core:130,weapon:85,engine:80,armor:120,shield:85},scale=1+.12*Math.max(0,sector-1);
    const modules=types.map((type)=>{const hp=Math.round(health[type]*scale);return {type,cells:ENEMY_TETROMINOES[type],hp,maxHp:hp};});
    const weapons=ENEMY_LOADOUTS[loadout].weapons;
    modules.find((room)=>room.type==='weapon').weaponType=weapons[0];modules.find((room)=>room.type==='weapon').muzzle=[3.5,-1];
    if(weapons[1])modules.push({type:'weapon',weaponType:weapons[1],muzzle:[3.5,-3],cells:ENEMY_TETROMINOES.weapon.map(([x,y])=>[x,y-2]),hp:Math.round(health.weapon*scale),maxHp:Math.round(health.weapon*scale)});
    Object.assign(modules.find((room)=>room.type==='shield'),{capacity:Math.round((heavy?100:60)*scale),charge:Math.round((heavy?100:60)*scale),recharge:heavy?6:4,shieldDelay:0});
    const cells=modules.flatMap((module)=>module.cells);
    const r=Math.ceil(Math.max(...cells.map(([x,y])=>Math.hypot((Math.abs(x)+.5)*ENEMY_TILE,(Math.abs(y)+.5)*ENEMY_TILE)))+9);
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
  function rayEnemyRoom(origin,dx,dy,enemy,limit,ignoredRooms=null){
    if(!enemy.modules?.length){const entry=rayCircle(origin,dx,dy,enemy,enemy.r);return {distance:entry,room:null};}
    const cos=Math.cos(enemy.angle),sin=Math.sin(enemy.angle),ox=origin.x-enemy.x,oy=origin.y-enemy.y;
    const x=ox*cos+oy*sin,y=-ox*sin+oy*cos,vx=dx*cos+dy*sin,vy=-dx*sin+dy*cos;
    let nearest=limit,roomHit=null;
    for(const room of enemy.modules){
      if(room.hp<=0||ignoredRooms?.has(room))continue;
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
    const choices=kind!=='rescue'&&save.sector>=3?Object.keys(ENEMY_LOADOUTS):['cannon','laser','missile'],first=Math.floor(Math.random()*choices.length);
    const layouts=Array.from({length:count},(_,i)=>{const loadout=choices[(first+i)%choices.length];return {...enemyLayout(kind!=='rescue',save.sector,loadout),loadout};});
    const cellCount=save.modules.reduce((sum,module)=>sum+moduleCells(module).length,0),enemyCells=layouts.reduce((sum,layout)=>sum+layout.cells,0);
    const width=Math.max(2400+cellCount*16+enemyCells*8,shipRadius()*7+900),world={w:width,h:Math.max(1800,width*.72)};
    const enemies=[];
    for(let i=0;i<count;i++){
      const layout=layouts[i],modules=layout.modules;
      for(const room of modules)if(room.type==='weapon')room.cooldown=rand(.7,1.5);
      const hp=modules.reduce((sum,room)=>sum+room.hp,0);
      enemies.push({x:world.w*.5+220+i*70,y:world.h*.5+(count===1?0:i===0?-135:135),angle:Math.PI,hp,maxHp:hp,r:layout.r,modules,path:[],pathTimer:0,cooldown:rand(.7,1.5),speed:kind==='rescue'?48:40,phase:rand(0,TAU),orbitSign:i%2?-1:1,loadout:layout.loadout,ammo:18+save.sector*4,name:`${ENEMY_LOADOUTS[layout.loadout].name} ${kind==='rescue'?'SKIFF':'RAIDER'}`});
    }
    const player={x:world.w*.5-260,y:world.h*.5,vx:0,vy:0,angle:0,omega:0,targetAngle:0,dest:null,path:[],selected:false,r:shipRadius(),thrusters:{}};
    // Stocks and magazines persist: entering combat never creates ammunition.
    battle={kind,world,player,enemies,asteroids:makeAsteroids(world,Math.min(14,8+Math.ceil(cellCount/12)+count),player,enemies),projectiles:[],stars:Array.from({length:Math.min(650,Math.round(world.w*world.h/9500))},()=>({x:rand(0,world.w),y:rand(0,world.h),s:Math.random()<.17?2:1})),shake:0,shields:{}};
    recoverDrones();battle.drones=save.drones;updateDroneAssembly(0);battle.teleportCooldown=0;
    enemies.forEach((enemy)=>{enemy.crew=enemy.modules.filter((room)=>room.type==='core'||room.type==='weapon').slice(0,2).map((room,i)=>({id:`guard-${i}`,hp:70,room:enemy.modules.indexOf(room),x:room.cells[0][0],y:room.cells[0][1]}));});
    persist();
    for(const module of save.modules){module.cooldown=rand(.25,.8);module.aimOffset=0;}
    updateDrones(0);
    setMode('combat');$('combatWaveLabel').textContent=kind==='rescue'?'DEFEND THE FREIGHTER':'HOSTILE CONTACT';
    $('arenaSizeLabel').textContent=`ARENA ${Math.round(world.w)} × ${Math.round(world.h)}`;
    $('combatHint').textContent='SELECT YOUR SHIP TO GIVE A MOVE ORDER';$('combatRotationLabel').textContent='0°';
    log(`${count} hostile ${count===1?'ship':'ships'} engaged.`);renderAll();
  }
  function finishBattle(victory){
    if(!battle)return;recoverBoarders();recoverDrones();const kind=battle.kind,captured=battle.enemies.some((enemy)=>enemy.captured);battle=null;setMode('hangar');
    for(const module of save.modules)delete module.cooldown;
    if(victory){
      const reward=(kind==='rescue'?48:30)+save.sector*4+(captured?12:0);save.metal+=reward;save.wins++;
      log(`${kind==='rescue'?'Freighter rescued':'Pirates defeated'}; ${reward} metal earned.`);
      concludeEvent(kind==='rescue'?'FREIGHTER SAVED':captured?'SHIP CAPTURED':'PIRATES DEFEATED',captured?`Your assault defeats the defending crew. Surviving boarders return home, and the intact ship yields ${reward} metal, including a 12-metal capture bonus.`:kind==='rescue'?`The freighter escapes and transfers ${reward} metal in thanks. Repair your ship before the next jump.`:`The raider breaks apart. Your crew recovers ${reward} metal from the wreck. Repair your ship before the next jump.`,kind==='rescue'?'◇':'✦');
    }else{
      pendingNodeId=null;log('Command core destroyed.');
      showEvent({type:'MISSION LOST // CORE FAILURE',icon:'✕',title:'SHIP LOST',body:'Your command core was destroyed. Start a new run to build another ship and try again.',choices:[{label:'START A NEW RUN →',action:()=>{hideEvent();showMainMenu();showStarterPicker();}}]});
    }
    persist();renderAll();
  }
  function angleDifference(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
  function clearSegment(a,b,radius,rocks){
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    return rocks.every((rock)=>{
      const t=clamp(((rock.x-a.x)*dx+(rock.y-a.y)*dy)/(length||1),0,1);
      const clearance=rock.r+radius+WRECK_BERTH;
      const closest=Math.hypot(a.x+dx*t-rock.x,a.y+dy*t-rock.y);
      if(closest>=clearance)return true;
      // A ship that was bumped inside the navigation margin may depart outward.
      const startDistance=distance(a,rock),endDistance=distance(b,rock);
      return startDistance<clearance&&closest>=rock.r+radius+4.5&&endDistance>startDistance;
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
    const driveDirections=new Set(engines.map((engine)=>engine.module.rotation));
    const forwardOnly=driveDirections.size===1;
    const mass=Math.max(2,cellCount*.3),inertia=mass*p.r*p.r*(forwardOnly?.02:.42),lever=Math.max(20,p.r*.58);
    if(p.arrival&&p.dest&&(p.dest.x!==p.arrival.x||p.dest.y!==p.arrival.y))p.arrival=null;
    if(p.turnOrderPending&&Math.abs(angleDifference(p.angle,p.targetAngle))<.25&&Math.abs(p.omega)<.4)p.turnOrderPending=false;
    const orienting=!!p.dest&&!p.arrival&&!!p.turnOrderPending;
    let desiredX=orienting?0:-p.vx*1.6,desiredY=orienting?0:-p.vy*1.6,heading=p.dest&&!orienting?p.angle:p.targetAngle;
    if(p.dest&&!p.arrival&&!orienting){
      if(p.path.length>1&&distance(p,p.path[0])<34)p.path.shift();
      const waypoint=p.path[0]||p.dest;
      const dx=waypoint.x-p.x,dy=waypoint.y-p.y,dist=Math.hypot(dx,dy),speed=Math.hypot(p.vx,p.vy);
      if(p.path.length<=1&&distance(p,p.dest)<12&&speed<(forwardOnly?6:2)&&clearSegment(p,p.dest,p.r,battle.asteroids)){
        p.arrival={x:p.dest.x,y:p.dest.y,fromX:p.x,fromY:p.y,elapsed:0};
      }
      else{
        desiredX=clamp(dx*.38-p.vx*2.4,-55,55);desiredY=clamp(dy*.38-p.vy*2.4,-55,55);
        const magnitude=Math.hypot(desiredX,desiredY),factor=Math.min(1,55/(magnitude||1));desiredX*=factor;desiredY*=factor;
        if(forwardOnly&&dist>1){
          const targetSpeed=Math.min(50,dist*.35);
          desiredX=clamp((dx/dist*targetSpeed-p.vx)*2.4,-55,55);
          desiredY=clamp((dy/dist*targetSpeed-p.vy)*2.4,-55,55);
        }
        for(const rock of battle.asteroids){
          const rx=p.x-rock.x,ry=p.y-rock.y,d=Math.hypot(rx,ry)||1,clearance=rock.r+p.r+WRECK_BERTH+12;
          if(d<clearance){const strength=(clearance-d)/clearance*105;desiredX+=rx/d*strength;desiredY+=ry/d*strength;}
        }
        // Choose the drive direction once for this route leg. Braking must not
        // reverse the hull's heading just because the desired force changes sign.
        if(!p.travel||p.travel.x!==waypoint.x||p.travel.y!==waypoint.y||!engines.some((engine)=>engine.force>0&&engine.module.rotation===p.travel.rotation)){
          const directions=new Map();
          for(const engine of engines)if(engine.force>0)directions.set(engine.module.rotation,(directions.get(engine.module.rotation)||0)+engine.force);
          const strongest=Math.max(...directions.values(),1),bearing=Math.atan2(dy,dx);
          const options=[...directions].map(([rotation,force])=>({rotation,heading:bearing-rotation*Math.PI/2,force}));
          options.sort((a,b)=>(Math.abs(angleForAvailableTorque(p,a.heading,engines))+.2*strongest/a.force)-(Math.abs(angleForAvailableTorque(p,b.heading,engines))+.2*strongest/b.force));
          p.travel={x:waypoint.x,y:waypoint.y,rotation:options[0]?.rotation||0,turning:true};
        }
        heading=Math.atan2(dy,dx)-p.travel.rotation*Math.PI/2;
        const error=Math.abs(angleForAvailableTorque(p,heading,engines));
        if(error>.35)p.travel.turning=true;
        if(forwardOnly||error<.08&&Math.abs(p.omega)<.05)p.travel.turning=false;
        if(p.travel.turning){desiredX*=.03;desiredY*=.03;}
      }
    }
    if(p.arrival){desiredX=0;desiredY=0;heading=p.targetAngle;}
    const turn=angleForAvailableTorque(p,heading,engines);
    // Apply travel thrust while steering; only large turns on a reverse-drive
    // hull use reduced thrust, rather than waiting motionless for exact alignment.
    if(p.dest&&!p.arrival&&!orienting){const alignment=Math.max(0,Math.cos(turn));desiredX*=alignment**4;desiredY*=alignment**4;}
    // Leave headroom for opposing engines to cancel translation during a turn.
    const positiveTorque=engines.reduce((sum,engine)=>sum+Math.max(0,engine.torque),0)*.45;
    const negativeTorque=engines.reduce((sum,engine)=>sum+Math.max(0,-engine.torque),0)*.45;
    const braking=(turn>=0?negativeTorque:positiveTorque)/inertia;
    const targetOmega=Math.sign(turn)*Math.min(1,Math.abs(turn)*1.5,braking>0?Math.sqrt(2*braking*Math.abs(turn))*.7:Math.abs(turn)*.5);
    const desiredTorque=clamp(inertia*(targetOmega-p.omega)*3,-Math.min(22000,negativeTorque),Math.min(22000,positiveTorque));
    const directions=new Set(engines.filter((engine)=>engine.force>0).map((engine)=>engine.module.rotation));
    // Without counterthrust, some translation is unavoidable; do not let position damping veto the turn.
    const yawWeight=[...directions].some((rotation)=>directions.has((rotation+2)%4))?1.25:Math.abs(turn)>.3||Math.abs(p.omega)>.4?50:1.25;
    const desired=[mass*desiredX,mass*desiredY,desiredTorque/lever*yawWeight],coeff=engines.map((engine)=>{
      const direction=p.angle+engine.direction;
      return [Math.cos(direction)*engine.force,Math.sin(direction)*engine.force,engine.torque/lever*yawWeight];
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
    p.vx=clamp((p.vx+fx/mass*dt)*Math.exp(-(forwardOnly?.4:.16)*dt),-85,85);
    p.vy=clamp((p.vy+fy/mass*dt)*Math.exp(-(forwardOnly?.4:.16)*dt),-85,85);
    p.omega=clamp((p.omega+torque/inertia*dt)*Math.exp(-.7*dt),-1.45,1.45);
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.omega*dt;
    if(p.x<p.r+5){p.x=p.r+5;p.vx=Math.max(0,p.vx);}if(p.x>battle.world.w-p.r-5){p.x=battle.world.w-p.r-5;p.vx=Math.min(0,p.vx);}
    if(p.y<p.r+5){p.y=p.r+5;p.vy=Math.max(0,p.vy);}if(p.y>battle.world.h-p.r-5){p.y=battle.world.h-p.r-5;p.vy=Math.min(0,p.vy);}
    if(resolveRockCollision(p,battle.asteroids,battle.world)){
      p.arrival=null;p.travel=null;
      if(p.dest){const route=routeAroundRocks(p,p.dest,p.r,battle.asteroids,battle.world);if(route.length)p.path=route;}
    }
    if(p.arrival){
      // Finish the last few units smoothly, then hold the exact commanded point while turning.
      const arrival=p.arrival;arrival.elapsed=Math.min(.25,arrival.elapsed+dt);
      const t=arrival.elapsed/.25,ease=t*t*(3-2*t);
      p.x=t===1?arrival.x:arrival.fromX+(arrival.x-arrival.fromX)*ease;
      p.y=t===1?arrival.y:arrival.fromY+(arrival.y-arrival.fromY)*ease;
      p.vx=0;p.vy=0;
      if(t===1&&Math.abs(angleDifference(p.angle,p.targetAngle))<.01&&Math.abs(p.omega)<.02){
        p.angle=p.targetAngle;p.omega=0;p.dest=null;p.path=[];p.thrusters={};
      }
    }
  }
  function weaponWorld(module,player){
    const mount=weaponGeometry(module),bounds=shipBounds();
    const lx=(mount.x-bounds.cx)*COMBAT_TILE,ly=(mount.y-bounds.cy)*COMBAT_TILE,cos=Math.cos(player.angle),sin=Math.sin(player.angle);
    return {x:player.x+lx*cos-ly*sin,y:player.y+lx*sin+ly*cos,direction:player.angle+mount.direction};
  }
  function missileLaunch(weapon){
    const mount=weaponGeometry(weapon),cells=save.modules.flatMap(moduleCells),limit=hullEscapeLimit(mount,cells);
    const signature=`${mount.x},${mount.y},${mount.direction}:${cells.map((cell)=>cell.join(',')).join(';')}`,cached=missileLaunchCache.get(weapon);
    if(cached?.signature===signature)return cached.result;
    const angle=weaponAngles(weapon,cells,true).filter((angle)=>hullRay(mount,angle,cells,limit)>=limit)
      .sort((a,b)=>Math.abs(angleDifference(mount.direction,a))-Math.abs(angleDifference(mount.direction,b)))[0];
    if(angle===undefined){missileLaunchCache.set(weapon,{signature,result:null});return null;}
    // Stay on the clear launch rail until beyond the hull's projected edge.
    const clearance=Math.max(1,...cells.flatMap(([x,y])=>[[x,y],[x+1,y],[x,y+1],[x+1,y+1]].map(([cx,cy])=>(cx-mount.x)*Math.cos(angle)+(cy-mount.y)*Math.sin(angle))))*COMBAT_TILE+4;
    const result={angle,clearance};missileLaunchCache.set(weapon,{signature,result});return result;
  }
  function weaponCanTarget(weapon,player,target) {
    const def=MODULES[weapon.type],mount=weaponWorld(weapon,player),aim=Math.atan2(target.y-mount.y,target.x-mount.x),dist=distance(target,mount);
    if(dist>weaponRange(weapon))return false;
    if(def.guidance)return !!missileLaunch(weapon);
    return Math.abs(angleDifference(mount.direction,aim))<=def.arc*Math.PI/360
      &&(def.hullPass||hullRay(weaponGeometry(weapon),aim-player.angle,save.modules.flatMap(moduleCells),dist/COMBAT_TILE)>=dist/COMBAT_TILE);
  }
  function beamSpan(origin,target){return clamp(Math.atan2((target.r||25)+12,distance(origin,target)),.06,.55);}
  function startBeam(emitter,target,options){
    const origin=options.drone?emitter:weaponWorld(emitter,battle.player);
    (battle.beams??=[]).push({emitter,target,...options,elapsed:0,span:beamSpan(origin,target),hitRooms:new Set(),x:origin.x,y:origin.y,to:{x:origin.x,y:origin.y}});
  }
  function beamEmitterPower(beam){
    if(beam.drone){
      const drone=beam.emitter,bay=save.modules.find((room)=>room.id===drone.bay);
      return save.drones.includes(drone)&&drone.hp>0&&drone.phase==='active'&&bay&&droneBayClear(bay)?systemPower(bay):0;
    }
    return save.modules.includes(beam.emitter)&&beam.emitter.hp>0?systemPower(beam.emitter):0;
  }
  function traceBeam(beam,progress){
    const player=battle.player,origin=beam.drone?beam.emitter:weaponWorld(beam.emitter,player);
    let angle=Math.atan2(beam.target.y-origin.y,beam.target.x-origin.x)+(progress*2-1)*beam.span;
    if(!beam.drone){
      const half=MODULES[beam.emitter.type].arc*Math.PI/360;
      beam.emitter.aimOffset=clamp(angleDifference(origin.direction,angle),-half,half);angle=origin.direction+beam.emitter.aimOffset;beam.emitter.flash=.08;
    }else beam.emitter.facing=angle;
    const dx=Math.cos(angle),dy=Math.sin(angle),cells=save.modules.flatMap(moduleCells);
    let stop=Math.min(beam.range,hullRay(worldToHull(origin,player),angle-player.angle,cells,beam.range/COMBAT_TILE)*COMBAT_TILE),target=null,room=null,rock=null,hullDistance=Infinity;
    for(const candidate of battle.asteroids||[]){const entry=rayCircle(origin,dx,dy,candidate,candidate.r);if(entry<stop){stop=entry;rock=candidate;}}
    for(const enemy of battle.enemies){
      if(!enemyAlive(enemy))continue;
      const contact=rayEnemyRoom(origin,dx,dy,enemy,beam.range);
      const entry=enemyShieldStrength(enemy)>0?Math.min(contact.distance,rayCircle(origin,dx,dy,enemy,enemy.r+17)):contact.distance;
      if(entry<stop){stop=entry;target=enemy;room=contact.room;hullDistance=contact.distance;rock=null;}
    }
    const point={x:origin.x+dx*stop,y:origin.y+dy*stop},key=target?(hullDistance<=beam.range?room||target:null):rock;
    if(key&&!beam.hitRooms.has(key)){
      beam.hitRooms.add(key);
      if(target){
        // Shield strength is reduced at one third of hull damage. Only the
        // unabsorbed fraction becomes full-strength damage after collapse.
        const damage=absorbEnemyShields(target,beam.damage/3)*3;
        if(damage>1e-7)hurtEnemy(target,damage,room,{x:origin.x+dx*hullDistance,y:origin.y+dy*hullDistance});
      }else if(rock)damageAsteroid(rock,beam.damage);
      (battle.effects??=[]).push({...point,r:12,color:beam.color,time:.18,duration:.18});
    }
    beam.x=origin.x;beam.y=origin.y;beam.to=point;
  }
  function updateBeams(dt){
    for(const beam of battle.beams||[]){
      if(!enemyAlive(beam.target)){beam.done=true;continue;}
      const power=beamEmitterPower(beam);if(!power){beam.done=true;continue;}
      const next=Math.min(beam.duration,beam.elapsed+dt*(beam.drone?power:1)),steps=Math.max(1,Math.ceil((next-beam.elapsed)/.015));
      for(let i=0;i<=steps;i++){if(!enemyAlive(beam.target))break;traceBeam(beam,(beam.elapsed+(next-beam.elapsed)*i/steps)/beam.duration);}
      beam.elapsed=next;beam.done=next>=beam.duration;
    }
    battle.beams=(battle.beams||[]).filter((beam)=>!beam.done);
  }
  function drawBeam(g,beam){
    g.save();g.lineCap='round';g.strokeStyle=beam.color;g.globalAlpha=.22;g.lineWidth=9;
    g.beginPath();g.moveTo(beam.x,beam.y);g.lineTo(beam.to.x,beam.to.y);g.stroke();
    g.globalAlpha=.95;g.lineWidth=3;g.stroke();g.strokeStyle='#fff6db';g.lineWidth=1;g.stroke();g.restore();
  }
  function fireProjectile(owner,x,y,target,damage,speed,range=speed*2.3,options={}){
    const angle=options.angle??Math.atan2(target.y-y,target.x-x);
    battle.projectiles.push({owner,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage,life:range/speed,remaining:range,hitIds:new Set(),hitRooms:new Set(),...options});
  }
  function weaponAim(weapon,player,target){
    const mount=weaponWorld(weapon,player),base=weaponGeometry(weapon).direction,def=MODULES[weapon.type];
    if(!target)return 0;
    const launch=def.guidance?missileLaunch(weapon):null;
    return launch?angleDifference(base,launch.angle):clamp(angleDifference(mount.direction,Math.atan2(target.y-mount.y,target.x-mount.x))-(def.beamDuration?beamSpan(mount,target):0),-def.arc*Math.PI/360,def.arc*Math.PI/360);
  }
  function turnWeapon(weapon,player,target,dt){
    const wanted=weaponAim(weapon,player,target),current=weapon.aimOffset||0;
    weapon.aimOffset=current+clamp(wanted-current,-Math.PI*dt,Math.PI*dt);
    return Math.abs(wanted-weapon.aimOffset)<.015;
  }
  function fireWeapon(weapon,player,target) {
    const def=MODULES[weapon.type],mount=weaponWorld(weapon,player),salvo=def.salvo||1;
    const aim=Math.atan2(target.y-mount.y,target.x-mount.x),spread=(def.spread||0)*Math.PI/180,half=def.arc*Math.PI/360;
    const launch=def.guidance?missileLaunch(weapon):null;
    if(def.guidance&&!launch)return;weapon.aimOffset=weaponAim(weapon,player,target);weapon.flash=.07;
    if(def.beamDuration){startBeam(weapon,target,{damage:def.damage+(weapon.level-1)*5,range:weaponRange(weapon),duration:def.beamDuration,color:def.color});return;}
    for(let i=0;i<salvo;i++){
      const angle=launch?player.angle+launch.angle:mount.direction+clamp(angleDifference(mount.direction,aim+(salvo===1?0:(i/(salvo-1)-.5)*spread)),-half,half);
      fireProjectile('player',mount.x+Math.cos(angle)*.01,mount.y+Math.sin(angle)*.01,target,def.damage+(weapon.level-1)*5,def.speed,weaponRange(weapon),{
        angle,muzzleClearance:Math.min(36,weaponRange(weapon)*.5),target:def.guidance?target:null,guidance:def.guidance||0,launchRemaining:launch?.clearance||0,
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
      if(enemy.hp<=0||enemy.modules?.some((room)=>room.type==='core'&&room.hp===0)||enemyShieldStrength(enemy)>0)continue;
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
  function hurtEnemy(target,amount,room=null,point=null,crewDamage=true) {
    if(!enemyAlive(target))return;
    if(!target.modules?.some((part)=>part.type==='core')){
      target.hp=Math.max(0,target.hp-amount);
      if(target.hp===0){log(`${target.name} destroyed.`);toast(`${target.name} destroyed`);}
      return;
    }
    const struck=room?.hp>0?room:nearestEnemyRoom(target,point||{x:target.x,y:target.y});
    if(!struck)return;
    struck.hp=Math.max(0,struck.hp-amount);
    const roomIndex=target.modules.indexOf(struck);
    for(const person of save.crew)if(crewDamage&&person.aboard&&person.aboard.enemy===battle?.enemies.indexOf(target)&&person.aboard.room===roomIndex)hurtCrew(person,amount*1.5);
    for(const guard of target.crew||[])if(crewDamage&&guard.room===roomIndex)guard.hp=Math.max(0,guard.hp-amount*1.5);
    for(const drone of battle?.drones||[])if(crewDamage&&drone.type==='boarding'&&drone.phase==='boarding'&&drone.enemy===battle.enemies.indexOf(target)&&drone.room===roomIndex)drone.hp=Math.max(0,drone.hp-amount*1.5);
    target.hp=target.modules.reduce((sum,part)=>sum+Math.max(0,part.hp),0);
    if(struck.hp===0){
      if(struck.type==='core'){log(`${target.name} command core destroyed.`);toast(`${target.name} destroyed`);}
      else{log(`${target.name} ${struck.type} room disabled.`);toast(`${target.name} ${struck.type} disabled`);}
    }
  }
  function weaponImpact(shot,target,hitRock=null,hitRoom=null) {
    const directDamage=target?absorbEnemyShields(target,shot.damage):0;
    if(shot.chainSystems&&target){if(directDamage>0)teslaImpact({...shot,damage:directDamage},target,hitRoom);return directDamage>0;}
    if(shot.systemPulse){
      if(!target||directDamage>0)disruptSystems(shot);
      if(target&&directDamage>0){
        const room=hitRoom||liveEnemySystems(target).sort((a,b)=>enemyRoomDistance(target,a,shot)-enemyRoomDistance(target,b,shot))[0];
        if(room)damageWeaponSystem(target,room,directDamage,shot);else hurtEnemy(target,directDamage);
      }
      if(hitRock)damageAsteroid(hitRock,shot.damage);
      return directDamage>0;
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
      const damage=enemy===target?directDamage:absorbEnemyShields(enemy,shot.damage*.55);if(damage<=0)continue;
      const room=enemy===target?hitRoom:nearestEnemyRoom(enemy,shot);
      if(shot.ion)ionizeSystem(enemy,shot,room);
      hurtEnemy(enemy,damage,room,shot);
      if(shot.slow){enemy.slowFactor=Math.min(enemy.slowTime>0?enemy.slowFactor:1,shot.slow);enemy.slowTime=Math.max(enemy.slowTime||0,shot.slowDuration);}
      if(shot.burn){enemy.burnDps=Math.max(enemy.burnDps||0,shot.burn);enemy.burnTime=Math.max(enemy.burnTime||0,shot.burnDuration);enemy.burnRoom=room;}
    }
    if(target&&directDamage>0&&shot.chain){
      const chained=battle.enemies.filter((other)=>{
        if(other===target||!enemyAlive(other)||distance(other,target)>shot.chain)return false;
        const dist=distance(other,target)/COMBAT_TILE,angle=Math.atan2(other.y-target.y,other.x-target.x)-battle.player.angle;
        return hullRay(worldToHull(target,battle.player),angle,save.modules.flatMap(moduleCells),dist)>=dist;
      }).sort((a,b)=>distance(a,target)-distance(b,target))[0];
      if(chained){hurtEnemy(chained,absorbEnemyShields(chained,shot.damage*.5),nearestEnemyRoom(chained,target),target);(battle.effects??=[]).push({x:target.x,y:target.y,to:{x:chained.x,y:chained.y},color:shot.color,time:.2,duration:.2});}
    }
    return directDamage>0;
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
  function shieldDirection(module){return ((Number.isFinite(module.shieldFacing)?module.shieldFacing:(module.rotation||0)*90)%360+360)%360;}
  function setShieldDirection(id,degrees){
    const module=save.modules.find((room)=>room.id===id&&room.type==='focusShield');
    if(!module||!Number.isFinite(degrees))return false;
    module.shieldFacing=((Math.round(degrees)%360)+360)%360;persist();renderInspector();
    if(mode==='hangar'||mode==='trade')drawHangar();return true;
  }
  function shieldGeometry(module,player=null,tile=COMBAT_TILE,modules=save.modules){
    if(module.type==='shield'){
      const cells=modules.flatMap(moduleCells),xs=cells.map(([x])=>x),ys=cells.map(([,y])=>y),minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX+1,height=Math.max(...ys)-minY+1;
      const hullRadius=Math.max(38,Math.hypot(width,height)*COMBAT_TILE*.54),radius=Math.max(hullRadius,player?.r||0)+17;
      return {x:player?player.x:(minX+width/2)*tile,y:player?player.y:(minY+height/2)*tile,radius:radius*(player?1:tile/COMBAT_TILE),angle:player?.angle||0,span:TAU};
    }
    const cells=moduleCells(module),origin={x:cells.reduce((sum,[x])=>sum+x+.5,0)/cells.length,y:cells.reduce((sum,[,y])=>sum+y+.5,0)/cells.length};
    const point=player?hullPointWorld(origin,player):{x:origin.x*tile,y:origin.y*tile};
    return {...point,radius:MODULES[module.type].shieldRadius*(player?1:tile/COMBAT_TILE),angle:(player?.angle||0)+shieldDirection(module)*Math.PI/180,span:module.type==='focusShield'?MODULES[module.type].arc*Math.PI/180:TAU};
  }
  function shieldContains(field,point){
    return distance(field,point)<=field.radius+1e-7&&(field.span>=TAU||distance(field,point)<1e-7||Math.abs(angleDifference(field.angle,Math.atan2(point.y-field.y,point.x-field.x)))<=field.span/2+1e-7);
  }
  function drawShieldCoverage(g,module,tile,modules=save.modules){
    const field=shieldGeometry(module,null,tile,modules),{x,y,radius,angle,span}=field,focused=module.type==='focusShield';
    g.save();g.strokeStyle=focused?'#92f9e9':'#b9a3f7';g.fillStyle=focused?'rgba(146,249,233,.07)':'rgba(185,163,247,.04)';g.lineWidth=1.5;
    g.beginPath();g.moveTo(x,y);g.arc(x,y,radius,angle-span/2,angle+span/2);g.closePath();g.fill();
    g.beginPath();g.arc(x,y,radius,angle-span/2,angle+span/2);g.stroke();
    if(focused){g.beginPath();for(const edge of [angle-span/2,angle+span/2]){g.moveTo(x,y);g.lineTo(x+Math.cos(edge)*radius,y+Math.sin(edge)*radius);}g.stroke();}
    if(focused){g.fillStyle='#92f9e9';g.fillRect(x-2,y-2,4,4);}g.restore();
  }

  function shieldState(module){
    if(!battle)return null;const capacity=shieldStats(module).capacity;
    battle.shields??={};const state=battle.shields[module.id]??={charge:module.hp>0?capacity:0,delay:0,flash:0};
    state.charge=module.hp>0?clamp(state.charge,0,capacity):0;return state;
  }

  function shieldCovers(module,player,angle){
    return module.type==='shield'||Math.abs(angleDifference(player.angle+shieldDirection(module)*Math.PI/180,angle))<=MODULES[module.type].arc*Math.PI/360;
  }
  function rayShield(origin,dx,dy,field,limit){
    if(shieldContains(field,origin))return 0;
    const ox=origin.x-field.x,oy=origin.y-field.y,b=ox*dx+oy*dy,c=ox*ox+oy*oy-field.radius*field.radius,discriminant=b*b-c;
    let nearest=Infinity;
    if(discriminant>=0)for(const entry of [-b-Math.sqrt(discriminant),-b+Math.sqrt(discriminant)]){
      if(entry>=0&&entry<=limit&&shieldContains(field,{x:origin.x+dx*entry,y:origin.y+dy*entry}))nearest=Math.min(nearest,entry);
    }
    if(field.span<TAU)for(const angle of [field.angle-field.span/2,field.angle+field.span/2]){
      const vx=Math.cos(angle)*field.radius,vy=Math.sin(angle)*field.radius,cross=dx*vy-dy*vx;
      if(Math.abs(cross)<1e-8)continue;
      const entry=(-ox*vy+oy*vx)/cross,along=(-ox*dy+oy*dx)/cross;
      if(entry>=0&&entry<=limit&&along>=0&&along<=1)nearest=Math.min(nearest,entry);
    }
    return nearest;
  }
  function shieldContacts(shot,dx,dy,player,limit){
    return activeModules(...SHIELD_TYPES).filter((module)=>shieldState(module).charge>1e-7).map((module)=>{
      const field=shieldGeometry(module,player),entry=rayShield(shot,dx,dy,field,limit);
      return {distance:entry,module,point:{x:shot.x+dx*entry,y:shot.y+dy*entry}};
    }).filter((hit)=>Number.isFinite(hit.distance)&&hit.distance<=limit).sort((a,b)=>a.distance-b.distance||a.module.id-b.module.id);
  }
  function shieldInterception(shot,dx,dy,player,limit){return shieldContacts(shot,dx,dy,player,limit)[0]||null;}
  function absorbShields(amount,modules){
    for(const module of modules||[]){
      if(!save.modules.includes(module)||module.hp<=0||!SHIELD_TYPES.includes(module.type))continue;
      const state=shieldState(module);if(amount<=0||state.charge<=0)continue;
      const absorbed=Math.min(amount,state.charge);state.charge-=absorbed;amount-=absorbed;state.delay=1.7;state.flash=.22;
    }
    return amount;
  }
  function playerHullContact(origin,dx,dy,player,limit=Infinity){
    const entry=hullRay(worldToHull(origin,player),Math.atan2(dy,dx)-player.angle,save.modules.filter((module)=>module.hp>0).flatMap(moduleCells),Infinity)*COMBAT_TILE;
    return entry<=limit?entry:Infinity;
  }
  function nearestPlayerHullPoint(point){
    const local=worldToHull(point,battle.player);let nearest=null,range=Infinity;
    for(const module of save.modules.filter((part)=>part.hp>0))for(const [x,y] of moduleCells(module)){
      const candidate={x:clamp(local.x,x+1e-5,x+1-1e-5),y:clamp(local.y,y+1e-5,y+1-1e-5)},d=distance(local,candidate);
      if(d<range){range=d;nearest=candidate;}
    }
    return nearest?hullPointWorld(nearest,battle.player):null;
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
    for(const person of save.crew)if(crewHome(person)&&moduleCells(target).some(([x,y])=>Math.floor(person.x)===x&&Math.floor(person.y)===y))hurtCrew(person,amount*1.5);
    for(const drone of save.drones||[])if((['stored','carried','ready'].includes(drone.phase)||drone.type==='repair')&&moduleCells(target).some(([x,y])=>Math.floor(drone.x)===x&&Math.floor(drone.y)===y))drone.hp=Math.max(0,drone.hp-amount*1.5);
    if(target.hp===0){log(`${MODULES[target.type].name} disabled!`);toast(`${MODULES[target.type].name} disabled!`);}
    if(save.modules.find((module)=>module.type==='core').hp<=0)finishBattle(false);
  }
  function enemyTacticalRange(enemy){
    const weapons=enemy.modules?.length?enemy.modules.filter((room)=>room.type==='weapon'&&room.hp>0):[enemy];
    if(!weapons.length)return 560;
    const average=weapons.reduce((sum,room)=>sum+Math.min(650,enemyWeaponStats(room).range),0)/weapons.length;
    const shield=enemyShieldRooms(enemy).find((room)=>room.hp>0);
    const retreat=shield&&enemyShieldState(enemy,shield).charge<shield.capacity*.25?75:0;
    return clamp(average*.8+retreat,320,600);
  }
  function enemyTacticalGoal(enemy,player,rocks,world){
    const preferred=enemyTacticalRange(enemy),dist=distance(enemy,player),bearing=Math.atan2(enemy.y-player.y,enemy.x-player.x);
    const sign=enemy.orbitSign??(Math.sin(enemy.phase||0)>=0?1:-1);
    const offsets=dist<preferred-55?[0,sign*.25,-sign*.25]:dist>preferred+90?[sign*.22,0,-sign*.22]:[sign*.45,sign*.75,-sign*.45];
    const choices=offsets.map((offset,index)=>{
      const angle=bearing+offset,goal=safePoint({x:player.x+Math.cos(angle)*preferred,y:player.y+Math.sin(angle)*preferred},enemy.r,rocks,world);
      return {goal,score:distance(enemy,goal)+index*30+(clearSegment(goal,player,4,rocks)?0:350)};
    });
    return choices.sort((a,b)=>a.score-b.score)[0].goal;
  }
  function updateBattle(dt,time){
    if(!battle)return;const b=battle,p=b.player;b.shake=Math.max(0,b.shake-dt);
    navigatePlayer(dt);updateShields(dt);updateBoarding(dt);updateDrones(dt);
    for(const module of save.modules){
      if(module.hp<=0||module.hp>=maxHp(module))continue;
      const repairers=crewAtStation('repair',module);
      if(repairers)module.hp=Math.min(maxHp(module),module.hp+dt*5*repairers);
    }
    for(const enemy of b.enemies){
      if(enemyAlive(enemy)&&enemy.burnTime>0){hurtEnemy(enemy,enemy.burnDps*Math.min(dt,enemy.burnTime),enemy.burnRoom);enemy.burnTime=Math.max(0,enemy.burnTime-dt);}
      enemy.slowTime=Math.max(0,(enemy.slowTime||0)-dt);
      for(const module of enemy.modules||[])module.ionTime=Math.max(0,(module.ionTime||0)-dt);
      updateEnemyShields(enemy,dt);
    }
    b.effects=(b.effects||[]).filter((effect)=>(effect.time-=dt)>0);
    const living=b.enemies.filter(enemyAlive);
    for(const weapon of activeModules(...WEAPON_TYPES)){
      weapon.flash=Math.max(0,(weapon.flash||0)-dt);
      const def=MODULES[weapon.type],mount=weaponWorld(weapon,p);weapon.cooldown-=dt;
      if(b.beams?.some((beam)=>beam.emitter===weapon))continue;
      const burst=b.projectiles.find((shot)=>shot.emitter===weapon&&shot.delay>0&&shot.burstTarget&&enemyAlive(shot.burstTarget)&&weaponCanTarget(weapon,p,shot.burstTarget));
      const target=burst?.burstTarget||living.filter((enemy)=>weaponCanTarget(weapon,p,enemy)).sort((a,c)=>distance(a,mount)-distance(c,mount))[0];
      const aligned=turnWeapon(weapon,p,target,dt);
      if(!target||!aligned||weapon.cooldown>0||magazineCount(weapon)<def.ammo)continue;
      if(def.ammo)weapon.magazine=magazineCount(weapon)-def.ammo;weapon.cooldown=def.reload/systemPower(weapon)/(1+crewAtStation('gun',weapon)*.4)/(1+(weapon.level-1)*.22);
      fireWeapon(weapon,p,target);
    }
    for(const enemy of living){
      const speed=enemy.speed*(enemy.slowTime>0?enemy.slowFactor:1)*enemySystemEfficiency(enemy,'engine');
      const goal=enemyTacticalGoal(enemy,p,b.asteroids,b.world);
      enemy.pathTimer-=dt;enemy.moving=speed>0&&distance(enemy,goal)>18;
      if(enemy.moving){
        if(enemy.pathTimer<=0||!enemy.path.length){
          enemy.path=routeAroundRocks(enemy,goal,enemy.r,b.asteroids,b.world);enemy.pathTimer=1.2;
        }
        if(enemy.path.length>1&&distance(enemy,enemy.path[0])<14)enemy.path.shift();
        const waypoint=enemy.path[0];
        if(waypoint){const vx=waypoint.x-enemy.x,vy=waypoint.y-enemy.y,length=Math.hypot(vx,vy)||1,step=Math.min(length,speed*dt);enemy.x+=vx/length*step;enemy.y+=vy/length*step;}
      }
      if(resolveRockCollision(enemy,b.asteroids,b.world))enemy.pathTimer=0;
      enemy.angle+=clamp(angleDifference(enemy.angle,Math.atan2(p.y-enemy.y,p.x-enemy.x)),-dt*2,dt*2);
      fireEnemyWeapons(enemy,dt);
    }
    updateBeams(dt);
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
        if(Math.abs(weaponAim(weapon,p,target)-(weapon.aimOffset||0))>=.015){shot.delay=.001;continue;}
        const aim=Math.atan2(target.y-mount.y,target.x-mount.x),half=def.arc*Math.PI/360;
        const angle=launch?p.angle+launch.angle:mount.direction+clamp(angleDifference(mount.direction,aim+shot.spreadOffset),-half,half);
        const speed=Math.hypot(shot.vx,shot.vy);shot.x=mount.x+Math.cos(angle)*.01;shot.y=mount.y+Math.sin(angle)*.01;
        shot.vx=Math.cos(angle)*speed;shot.vy=Math.sin(angle)*speed;shot.launchRemaining=launch?.clearance||0;weapon.aimOffset=angle-p.angle-weaponGeometry(weapon).direction;shot.muzzleClearance=Math.min(36,weaponRange(weapon)*.5);weapon.flash=.07;
      }
      const speed=Math.hypot(shot.vx,shot.vy);
      if(shot.guidance&&shot.owner==='enemy')shot.target=p;
      if(shot.guidance&&shot.owner==='player'&&(!shot.target||!enemyAlive(shot.target))){
        shot.target=b.enemies.filter(enemyAlive).sort((a,c)=>distance(a,shot)-distance(c,shot))[0];
        if(!shot.target){b.projectiles.splice(i,1);continue;}
      }
      if(shot.guidance&&!(shot.launchRemaining>0)&&shot.target){
        const current=Math.atan2(shot.vy,shot.vx),desired=Math.atan2(shot.target.y-shot.y,shot.target.x-shot.x);
        const angle=current+clamp(angleDifference(current,desired),-shot.guidance*step,shot.guidance*step);
        shot.vx=Math.cos(angle)*speed;shot.vy=Math.sin(angle)*speed;
      }
      const dx=shot.vx/speed,dy=shot.vy/speed;
      const travel=Math.min(speed*step,shot.remaining,shot.launchRemaining>0?shot.launchRemaining:Infinity);
      if(shot.owner==='enemy'&&!shot.evasionChecked&&(rayCircle(shot,dx,dy,p,p.r+25)<=travel||playerHullContact(shot,dx,dy,p)<=travel||shieldInterception(shot,dx,dy,p,travel))){
        shot.evasionChecked=true;shot.evaded=Math.random()<evasionChance();
        if(shot.evaded&&shot.guidance){shot.guidance=0;shot.remaining=Math.min(shot.remaining,600);}
        if(shot.evaded)(b.effects??=[]).push({x:p.x,y:p.y-p.r-20,text:'MISS',color:'#9ce5df',time:.6,duration:.6});
      }
      let remainingTravel=travel;shot.life-=step;
      // A shot that collapses one local field continues along its real path,
      // meeting any other field or hull room in the same simulation step.
      for(let collision=0;collision<=save.modules.length+1;collision++){
        let stop=remainingTravel,hit=false,target=null,hitRock=null,hitRoom=null,hitDrone=null,hitShield=null,shieldedEnemy=false;
        if(shot.owner==='player'&&!shot.hullPass){
          const blocked=hullRay(worldToHull(shot,p),Math.atan2(dy,dx)-p.angle,save.modules.flatMap(moduleCells),remainingTravel/COMBAT_TILE)*COMBAT_TILE;
          if(blocked<remainingTravel-1e-7){stop=blocked;hit=true;}
        }
        for(const rock of b.asteroids){
          const entry=rayCircle(shot,dx,dy,rock,rock.r*.87);
          if(entry<=stop){stop=entry;hit=true;hitRock=rock;}
        }
        const targets=shot.owner==='player'?b.enemies.filter((enemy)=>enemyAlive(enemy)&&!shot.hitIds.has(enemy)):(shot.evaded?[]:[p]);
        for(const candidate of targets){
          const barrier=shot.owner==='player'?enemyShieldInterception(candidate,shot,dx,dy,stop):null;
          const contact=shot.owner==='player'?(barrier||rayEnemyRoom(shot,dx,dy,candidate,stop,shot.hitRooms)):{distance:playerHullContact(shot,dx,dy,candidate),room:null};
          const entry=contact.distance;
          if(entry<stop||(!hit&&entry<=stop)){stop=entry;hit=true;target=candidate;hitRock=null;hitRoom=contact.room;shieldedEnemy=!!barrier;}
        }
        if(shot.owner==='enemy'&&!shot.evaded){
          const shield=shieldInterception(shot,dx,dy,p,stop);
          if(shield&&shield.distance<=stop+1e-7){
            stop=shield.distance;hit=true;target=p;hitRock=null;hitShield=shield.module;
          }
        }
        if(shot.owner==='enemy'&&!shot.evaded)for(const drone of b.drones||[])if(drone.hp>0&&['combat','beam','defense'].includes(drone.type)&&['launching','active'].includes(drone.phase)){const entry=rayCircle(shot,dx,dy,drone,9);if(entry<stop){stop=entry;hit=true;target=null;hitRock=null;hitShield=null;hitDrone=drone;}}
        shot.x+=dx*stop;shot.y+=dy*stop;shot.remaining-=stop;shot.muzzleClearance=Math.max(0,(shot.muzzleClearance||0)-stop);shot.launchRemaining=Math.max(0,(shot.launchRemaining||0)-stop);
        const impactDamage=shot.damage;
        if(hitDrone){hitDrone.hp=Math.max(0,hitDrone.hp-shot.damage);}
        else if(target&&shot.owner==='player'){
          const penetrated=weaponImpact(shot,target,null,hitRoom);
          if(hitRoom)shot.hitRooms.add(hitRoom);else shot.hitIds.add(target);
          if(penetrated&&shot.pierce>0&&!shieldedEnemy){
            shot.pierce--;hit=false;
            (b.effects??=[]).push({x:shot.x,y:shot.y,r:14,color:shot.color||'#d5e6f2',time:.18,duration:.18});
          }
        }else if(target){
          if(hitShield){
            shot.damage=absorbShields(shot.damage,[hitShield]);
            if(shot.damage>1e-7){
              hit=false;target=null;remainingTravel=Math.max(0,remainingTravel-stop);
              if(remainingTravel>1e-7)continue;
            }
          }else damagePlayer(shot.damage,{x:shot.x+dx*1e-5,y:shot.y+dy*1e-5});
          if(!battle)return;
        }
        else if(hit&&shot.owner==='player')weaponImpact(shot,null,hitRock);
        else if(hitRock)damageAsteroid(hitRock,shot.damage);
        if(hit&&shot.owner==='enemy'&&shot.splash)enemyMissileImpact(hitShield?{...shot,damage:impactDamage}:shot,!!target||!!hitDrone,hitRock);
        if(!battle)return;
        if(hit||shot.remaining<=1e-7||(!shot.guidance&&(shot.x<0||shot.x>b.world.w||shot.y<0||shot.y>b.world.h)))b.projectiles.splice(i,1);
        break;
      }
    }
    if(b.enemies.every((enemy)=>!enemyAlive(enemy))){finishBattle(true);return;}
    if(time-lastHudRefresh>280){lastHudRefresh=time;renderHud();renderInspector();refreshCrewStatus();}
  }
  function enemySprite(enemy){
    const moving=enemy.moving,heavy=enemy.modules.some((room)=>room.type==='armor');
    const key=JSON.stringify([moving,enemy.modules.map(({type,cells})=>[type,cells])]);if(enemySprites.has(key))return enemySprites.get(key);
    const sprite=document.createElement('canvas');sprite.width=220*SPRITE_SCALE;sprite.height=160*SPRITE_SCALE;
    const g=sprite.getContext('2d');g.imageSmoothingEnabled=false;g.scale(SPRITE_SCALE,SPRITE_SCALE);g.translate(110,80);
    const modules=enemy.modules,occupied=new Set(modules.flatMap((module)=>module.cells.map(([x,y])=>`${x},${y}`)));
    const colors={core:'#d98495',weapon:'#e3a373',engine:'#87b9c4',armor:'#9b9bad',shield:'#b59ae0'};
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
    const shield=modules.find((room)=>room.type==='shield');if(shield){const [x,y]=shield.cells[0],px=x*ENEMY_TILE,py=y*ENEMY_TILE;g.fillStyle='#725990';g.fillRect(px-7,py-7,14,14);g.fillStyle='#e3d2ff';g.fillRect(px-2,py-6,4,12);g.fillRect(px-6,py-2,12,4);}
    if(heavy){g.fillStyle='#c2b9c9';g.fillRect(-10,39,20,5);g.fillStyle='#715e76';g.fillRect(-6,44,12,8);}
    enemySprites.set(key,sprite);return sprite;
  }
  function drawEnemy(enemy){
    const g=ctx,r=enemy.r;
    g.save();g.translate(enemy.x,enemy.y);g.rotate(enemy.angle);
    g.drawImage(enemySprite(enemy),-110,-80,220,160);
    for(const room of enemy.modules)if(room.type==='weapon'){const [x,y]=room.muzzle||[3.5,-1];g.save();g.translate(x*ENEMY_TILE,y*ENEMY_TILE);g.rotate(room.aimOffset||0);drawWeaponSprite(g,room.weaponType||'weapon',room.hp>0,room.hp>0?(room.flash||0):0);g.restore();}
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
    drawEnemyCrew(g,enemy);
    g.restore();
    const strength=enemyShieldStrength(enemy),capacity=enemyShieldRooms(enemy).reduce((sum,room)=>sum+(room.capacity??100),0);
    if(strength>0){const flash=enemyShieldRooms(enemy).some((room)=>room.shieldFlash>0);g.save();g.globalAlpha=.15+.45*strength/capacity+(flash ? .25 : 0);g.strokeStyle='#c3a3ef';g.lineWidth=flash?3:2;g.beginPath();g.arc(enemy.x,enemy.y,r+17,0,TAU);g.stroke();g.restore();}
    g.save();g.font='10px monospace';g.textAlign='center';g.fillStyle='#e6c3b8';g.fillText(enemy.name,enemy.x,enemy.y-r-39);
    g.fillStyle='#b9a3f7';g.fillText(`SHIELD ${Math.ceil(strength)} / ${capacity}`,enemy.x,enemy.y-r-25);
    g.fillStyle='#6e617d';g.fillRect(enemy.x-40,enemy.y-r-19,80,4);g.fillStyle='#c1a0ef';g.fillRect(enemy.x-40,enemy.y-r-19,capacity?80*strength/capacity:0,4);g.restore();
    if((enemy.modules||[]).some((module)=>module.ionTime>0)){g.fillStyle='#80dce9';g.fillRect(enemy.x-16,enemy.y-r-6,5,5);}
    if(enemy.slowTime>0){g.fillStyle='#9ceaf0';g.fillRect(enemy.x-24,enemy.y-r-6,5,5);}
    if(enemy.burnTime>0){g.fillStyle='#f5a267';g.fillRect(enemy.x-16,enemy.y-r-6,5,5);}
  }
  function drawShields(player){
    for(const module of activeModules(...SHIELD_TYPES)){
      const state=shieldState(module),stats=shieldStats(module);if(state.charge<=0)continue;
      const focused=module.type==='focusShield',field=shieldGeometry(module,player),center=field.angle,span=field.span;
      ctx.save();ctx.globalAlpha=Math.min(1,.15+.45*state.charge/stats.capacity+(state.flash>0?.25:0));ctx.strokeStyle=focused?'#92f9e9':'#b9a3f7';ctx.lineWidth=state.flash>0?3:2;
      ctx.beginPath();ctx.arc(field.x,field.y,field.radius,center-span/2,center+span/2);ctx.stroke();
      if(focused){ctx.globalAlpha*=.45;ctx.beginPath();for(const edge of [center-span/2,center+span/2]){ctx.moveTo(field.x,field.y);ctx.lineTo(field.x+Math.cos(edge)*field.radius,field.y+Math.sin(edge)*field.radius);}ctx.stroke();}
      ctx.restore();
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
  function arenaViewport(world){const zoom=COMBAT_ZOOMS[combatZoomIndex];return {w:Math.min(1080*zoom,world.w),h:Math.min(760*zoom,world.h)};}
  function arenaCamera(){
    const {world,player}=battle,view=arenaViewport(world),person=save.crew.find((person)=>person.id===selectedCrewId),focus=person?.aboard?battle.enemies[person.aboard.enemy]:player;
    return {w:view.w,h:view.h,x:clamp((focus?.x??world.w/2)-view.w/2,0,world.w-view.w),y:clamp((focus?.y??world.h/2)-view.h/2,0,world.h-view.h)};
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
    for(const drone of b.drones||[])if(drone.hp>0&&drone.type!=='repair'&&['launching','active','outbound'].includes(drone.phase))drawDroneSprite(ctx,drone.x,drone.y,drone.type,drone.facing||0);
    for(const beam of b.beams||[])drawBeam(ctx,beam);
    for(const effect of b.effects||[]){
      ctx.globalAlpha=effect.time/effect.duration;ctx.fillStyle=effect.color;
      if(effect.text){ctx.font='14px monospace';ctx.fillText(effect.text,effect.x,effect.y-(1-effect.time/effect.duration)*15);}
      else if(effect.to){ctx.strokeStyle=effect.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(effect.x,effect.y);ctx.lineTo(effect.to.x,effect.to.y);ctx.stroke();}
      else if(effect.pulse){ctx.strokeStyle=effect.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(effect.x,effect.y,effect.r*(1-effect.time/effect.duration),0,TAU);ctx.stroke();}
      else {const radius=effect.r*(1-effect.time/effect.duration);for(let i=0;i<12;i++){const angle=i*TAU/12;ctx.fillRect(effect.x+Math.cos(angle)*radius-3,effect.y+Math.sin(angle)*radius-3,6,6);}}
      ctx.globalAlpha=1;
    }
    for(const shot of b.projectiles)if(!(shot.delay>0)&&!(shot.muzzleClearance>0))drawProjectile(ctx,shot);
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
    $('combatZoomLabel').textContent=`${Math.round(100/COMBAT_ZOOMS[combatZoomIndex])}%`;
  }
  function changeCombatZoom(direction){
    if(!battle)return;
    combatZoomIndex=clamp(combatZoomIndex+direction,0,COMBAT_ZOOMS.length-1);
    fitArenaCanvas();
  }
  function canvasPoint(event){const rect=canvas.getBoundingClientRect(),view=arenaCamera();return{x:view.x+(event.clientX-rect.left)/rect.width*view.w,y:view.y+(event.clientY-rect.top)/rect.height*view.h};}
  function selectPlayer(point=null){
    selectedCrewId=null;renderCrew();
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
    p.arrival=null;p.travel=null;p.dest=goal;p.path=path;p.turnOrderPending=p.turnOrderPending||Math.abs(angleDifference(p.angle,p.targetAngle))>.06;
    $('combatHint').textContent='THRUSTERS STEERING TO WAYPOINT · RIGHT CLICK TO REDIRECT';
  }
  function rotateArrival(step){
    if(!battle)return;if(!battle.player.selected){toast('Select your ship first.');return;}
    battle.player.targetAngle+=step*Math.PI/12;
    if(battle.player.dest)battle.player.turnOrderPending=true;
    const degrees=((Math.round(battle.player.targetAngle*180/Math.PI)%360)+360)%360;
    $('combatRotationLabel').textContent=`${degrees}°`;
    $('combatHint').textContent='SHIP TURNING UNDER ENGINE THRUST';
  }
  function refreshCrewStatus(){
    const force=$('engineForce'),module=selectedModule();if(force&&ENGINE_TYPES.includes(module?.type))force.textContent=Math.round(engineThrusters().find((engine)=>engine.module.id===module.id)?.force||0);
    $('crewList').querySelectorAll('.crew-card').forEach((card)=>{
      const person=save.crew.find((member)=>member.id===card.dataset.crewId);
      if(!person||!crewAlive(person)){renderCrew();return;}
      card.querySelector('small').textContent=crewStatus(person);
      const meter=card.querySelector('.crew-health');if(meter){meter.setAttribute('aria-valuenow',Math.ceil(person.hp??100));meter.querySelector('span').style.width=`${person.hp??100}%`;meter.querySelector('b').textContent=`${Math.ceil(person.hp??100)} / 100`;}
      const select=card.querySelector('select');if(select)select.disabled=!crewAlive(person)||!!person.aboard;
    });
  }
  function frame(time){
    const dt=clamp((time-lastFrame)/1000||0,0,.05);lastFrame=time;
    if(screen==='playing'){
      if(!eventOpen)updateAmmoProduction(dt);
      if(!eventOpen||mode==='map'){updateCrew(dt);if(mode!=='combat')updateDrones(dt);}
      if(mode==='combat'&&battle){updateBattle(dt,time);drawArena(time);}
      if(mode==='hangar'||mode==='trade')drawHangar();
      if(time-lastHudRefresh>700){lastHudRefresh=time;refreshCrewStatus();renderAmmo();const selected=selectedModule();if(selected&&MODULES[selected.type].ammoType){const detail=$('magazineDetail');if(detail)detail.textContent=`${MODULES[selected.type].ammoType.toUpperCase()} MAGAZINE ${magazineCount(selected)} / ${MODULES[selected.type].magazine}${magazineCount(selected)<MODULES[selected.type].ammo?' · EMPTY · NEEDS LOADER':''}`;}if(mode!=='combat'){renderSystems();renderOperations();}}
    }
    requestAnimationFrame(frame);
  }
  function init(){
    createGrid();
    window.addEventListener('resize',()=>{if(screen==='playing'&&mode==='combat')fitArenaCanvas();});
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(mode==='combat')fitArenaCanvas();}).observe(canvas.parentElement);
    $('menuContinue').addEventListener('click',()=>{if(canContinue()){persist();showGame();}});
    $('menuNew').addEventListener('click',()=>{if(canContinue())$('menuConfirm').hidden=false;else showStarterPicker();});
    $('confirmNew').addEventListener('click',showStarterPicker);
    $('cancelStarter').addEventListener('click',()=>{$('starterPicker').hidden=true;$('menuNew').focus();});
    $('cancelNew').addEventListener('click',()=>{$('menuConfirm').hidden=true;$('menuNew').focus();});
    $('menuQuit').addEventListener('click',quitGame);
    $('quitReturn').addEventListener('click',showMainMenu);
    $('rearrangeShip').addEventListener('click',toggleRearrangeShip);
    $('cancelRoomMove').addEventListener('click',cancelRoomMove);
    $('buildWeaponFacing').addEventListener('click',()=>{buildWeaponFacing=buildWeaponFacing?0:1;renderGrid();});
    $('buildFlipWeapon').addEventListener('click',flipBuild);
    $('buildRotateLeft').addEventListener('click',()=>rotateBuild(-1));$('buildRotateRight').addEventListener('click',()=>rotateBuild(1));
    $('combatRotateLeft').addEventListener('click',()=>rotateArrival(-1));$('combatRotateRight').addEventListener('click',()=>rotateArrival(1));
    $('combatZoomOut').addEventListener('click',()=>changeCombatZoom(1));$('combatZoomIn').addEventListener('click',()=>changeCombatZoom(-1));
    $('selectShipButton').addEventListener('click',()=>selectPlayer());$('jumpButton').addEventListener('click',toggleMap);$('resetButton').addEventListener('click',returnToMainMenu);
    $('leaveTrader').addEventListener('click',()=>{persist();openMap();renderAll();});
    $('revisitTrader').addEventListener('click',()=>{const node=currentMapNode();if(node?.type==='trader')openTrader(node);});
    $('shipMapButton').addEventListener('click',openMap);
    $('traderRepair').addEventListener('click',()=>{if(mode!=='trade'||save.metal<15||hullRatio()>=.999)return;save.metal-=15;repairAll(55);log('Field repairs purchased.');});
    $('marketFilters').querySelectorAll('button').forEach((button)=>button.addEventListener('click',()=>{marketFilter=button.dataset.filter;$('marketFilters').querySelectorAll('button').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));renderCatalog();}));
    $('nextSectorButton').addEventListener('click',goNextSector);
    canvas.addEventListener('contextmenu',(event)=>event.preventDefault());
    canvas.addEventListener('wheel',(event)=>{event.preventDefault();const delta=event.deltaY||event.deltaX;if(event.shiftKey)changeCombatZoom(delta>0?1:-1);else rotateArrival(delta>0?1:-1);},{passive:false});
    canvas.addEventListener('pointerdown',(event)=>{
      if(!battle)return;const point=canvasPoint(event);
      if(event.button===2){event.preventDefault();if(selectedCrewId){orderCrewWorld(point);return;}orderMove(point);return;}
      if(event.button!==0)return;
      if(selectCrewAtWorld(point))return;
      if(distance(point,battle.player)<battle.player.r+14)selectPlayer(point);
      else if(event.pointerType==='touch')orderMove(point);
    });
    document.addEventListener('keydown',(event)=>{
      if(event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;
      if(screen==='menu'){if(event.key==='Escape'){$('menuConfirm').hidden=true;$('starterPicker').hidden=true;}return;}
      if(screen!=='playing')return;
      if(event.key==='Escape'&&selectedCrewId){selectedCrewId=null;renderCrew();}
      if(['hangar','trade'].includes(mode)&&event.key.startsWith('Arrow')){const pan={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,-3],ArrowDown:[0,3]}[event.key];if(pan){event.preventDefault();panBuild(...pan);return;}}
      if(event.key.toLowerCase()==='f'&&mode==='trade'&&selectedCatalog&&MODULES[selectedCatalog].range){event.preventDefault();flipBuild();}
      if(event.key.toLowerCase()==='q'){if(mode==='combat')rotateArrival(-1);else if(mode==='trade')rotateBuild(-1);}
      if(event.key.toLowerCase()==='e'){if(mode==='combat')rotateArrival(1);else if(mode==='trade')rotateBuild(1);}
      if(mode==='combat'&&['-','_','=','+'].includes(event.key)){event.preventDefault();changeCombatZoom(['-','_'].includes(event.key)?1:-1);}
      if(event.key==='Escape'&&mode==='trade'&&!eventOpen){if(!cancelRoomMove()){selectedCatalog=null;rearrangingShip=false;roomDrag=null;renderAll();}}
    });
    log('Ship systems online. Plot a route on the sector map.');
    renderAll();showMainMenu();requestAnimationFrame(frame);
  }
  init();
})();
