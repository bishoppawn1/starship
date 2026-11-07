const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map();
  const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({dataset:{},style:{removeProperty(){},setProperty(){}},classList:{add(){},remove(){}},
    getContext:()=>context,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,setAttribute(){},append(){},replaceChildren(){},parentElement:{clientWidth:600,clientHeight:500}});
  const sandbox={console,Math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(key)=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={AMMO,MODULES,BUYABLE,WEAPON_TYPES,STARTER_SHIPS,newSave,normalizeAmmo,loadSave,persist,recoverAmmoCrate,updateAmmoProduction,magazineCount,ammoSources,updateCrew,crewGoal,crewStatus,crewRoutes,
      moduleStation,moduleCells,moduleClearance,connectedHull,weaponsHaveClearArc,engineThrusters,updateBattle,startBattle,finishBattle,upgradeTraderStock,renderAmmo,renderInspector,concludeEvent,startNewGame,showStarterPicker,
      setSave(value){save=value;for(const key of Object.keys(crewRoutes))delete crewRoutes[key];},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},
      getMode(){return mode;},setMode(value){mode=value;},getEventOpen(){return eventOpen;},setPending(value){pendingNodeId=value;eventOpen=true;},setTrade(value){mode='trade';tradeNode=value;},
      trackFire(){const shots={};const original=fireWeapon;fireWeapon=(weapon,...args)=>{shots[weapon.id]=(shots[weapon.id]||0)+1;return original(weapon,...args);};navigatePlayer=()=>{};return shots;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements};
}
const room=(g,id,type,x,y,extra={})=>({id,type,x,y,rotation:0,hp:g.MODULES[type].hp,level:1,...extra});
function logistics(g){
  const save=g.newSave();save.modules=[room(g,1,'core',0,0),room(g,2,'railgun',2,0),room(g,3,'missile',2,1),room(g,4,'ammoAssembly',0,2,{ammoRecipe:'heavy',ammoStock:{heavy:0,missile:0}})];
  save.crew=[{id:'loader',task:'load',x:.5,y:.5,hp:100}];g.setSave(save);g.normalizeAmmo(save);return save;
}
function tick(g,seconds){for(let t=0;t<seconds;t+=.05)g.updateCrew(.05);}
function battle(g,type,magazine=0){
  const save=g.newSave();save.modules=[room(g,1,'core',0,0),room(g,2,type,3,3,{magazine,cooldown:0})];save.crew=[];g.setSave(save);g.stubFlight();
  const enemy={x:900,y:500,hp:10000,maxHp:10000,r:8,speed:0,pathTimer:100,path:[],phase:0,angle:0,cooldown:100,name:'TEST RAIDER'};
  const b={kind:'pirate',shake:0,world:{w:2400,h:2000},asteroids:[],projectiles:[],drones:[],player:{x:500,y:500,angle:0,r:35},enemies:[enemy]};g.setBattle(b);return {save,b,gun:save.modules[1]};
}

test('only launchers and heavy ballistic weapons require ammunition; light and energy shots are free',()=>{
  const g=game();
  for(const type of ['missile','swarm','torpedo'])assert.equal(g.MODULES[type].ammoType,'missile');
  for(const type of ['railgun','flak','siege','gauss'])assert.equal(g.MODULES[type].ammoType,'heavy');
  for(const type of ['weapon','autocannon','gatling','scattergun','plasma','ion','laser','heavyLaser','disruptor','tesla','cryo','inferno','proton'])assert.equal(g.MODULES[type].ammo,0,type);
});

test('crates unpack immediately and old crates migrate exactly once without refilling depleted ammunition',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const before={...save.ammunition};g.recoverAmmoCrate();
  assert.deepEqual({...save.ammunition},{heavy:before.heavy+8,missile:before.missile+4});
  delete save.ammoVersion;delete save.ammunition;save.ammoCrates=2;g.normalizeAmmo(save);
  assert.deepEqual({...save.ammunition},{heavy:24,missile:12});assert.equal(save.ammoCrates,undefined);
  save.ammunition.heavy=0;g.persist();const loaded=g.loadSave();
  assert.deepEqual({...loaded.ammunition},{heavy:0,missile:12});
});

test('assemblies make typed ammo using only power and stop when disabled, unpowered or full',()=>{
  const g=game(),save=logistics(g),assembly=save.modules[3];save.modules=[save.modules[0],assembly];save.crew=[];
  assert.equal(save.ammunition.supplies,undefined);const metal=save.metal;g.updateAmmoProduction(4);
  assert.equal(assembly.ammoStock.heavy,4);assert.equal(save.ammunition.heavy,8);assert.equal(save.metal,metal);
  assembly.ammoRecipe='missile';g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,2);
  assembly.hp=0;g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,2);
  assembly.hp=75;assembly.ammoStock.missile=24;g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,24);
  assembly.ammoStock.missile=0;save.modules[0].hp=0;assembly.ammoProgress=4;g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,0);
  save.modules[0].hp=170;assembly.ammoProgress=0;
  for(let i=0;i<30;i++){assembly.ammoStock.missile=0;g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,2);}
  assert.equal(save.ammunition.supplies,undefined);assert.equal(save.metal,metal);
});

test('shared power scales factory speed and upgrades improve production',()=>{
  const g=game(),save=logistics(g),assembly=save.modules[3];save.crew=[];
  // Five consumers share eight units, so the factory runs at 80%.
  save.modules.push(room(g,5,'shield',0,4),room(g,6,'engine',2,4));
  g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.heavy,0);g.updateAmmoProduction(1);assert.equal(assembly.ammoStock.heavy,4);
  assembly.level=3;g.updateAmmoProduction(4/1.2);assert.equal(assembly.ammoStock.heavy,8);
});

test('loaders physically pick up finite matching stock and deliver it only to the correct magazine',()=>{
  const g=game(),save=logistics(g);save.ammunition={heavy:4,missile:0};
  g.updateCrew(0);assert.deepEqual({...save.crew[0].carrying},{type:'heavy',amount:4});assert.equal(save.ammunition.heavy,0);assert.equal(save.modules[1].magazine,0);
  assert.match(g.crewStatus(save.crew[0]),/CARRYING 4 HEAVY/);tick(g,8);
  assert.equal(save.modules[1].magazine,4);assert.equal(save.modules[2].magazine,0);assert.equal(save.crew[0].carrying,undefined);
  save.ammunition.missile=4;tick(g,8);assert.equal(save.modules[2].magazine,4);assert.equal(save.modules[1].magazine,4);assert.equal(save.ammunition.missile,0);
  tick(g,8);assert.equal(save.modules[1].magazine+save.modules[2].magazine,8);
});

test('loaders collect from assembly output and never manufacture rounds when all sources are empty',()=>{
  const g=game(),save=logistics(g);save.ammunition={heavy:0,missile:0};save.modules[3].ammoStock.heavy=4;
  tick(g,15);assert.equal(save.modules[1].magazine,4);assert.equal(save.modules[3].ammoStock.heavy,0);
  tick(g,15);assert.equal(save.modules[1].magazine,4);assert.equal(save.crew[0].workModuleId,null);
});

test('multiple loaders cannot duplicate shared stock and disconnected ammo cannot be teleported',()=>{
  const g=game(),save=logistics(g);save.crew.push({id:'second',task:'load',x:.5,y:.5,hp:100});save.ammunition={heavy:4,missile:0};
  save.modules[2]=room(g,3,'railgun',2,1);g.normalizeAmmo(save);tick(g,20);
  assert.equal(save.modules[1].magazine+save.modules[2].magazine+save.crew.reduce((n,p)=>n+(p.carrying?.amount||0),0),4);
  save.ammunition.heavy=0;save.modules[3].x=50;save.modules[3].ammoStock.heavy=4;tick(g,15);
  assert.equal(save.modules[3].ammoStock.heavy,4);
});

test('in-flight cargo and weapon magazines survive reload; excess cargo returns to stores when no magazine needs it',()=>{
  const g=game(),save=logistics(g);save.ammunition.heavy=4;save.ammunition.missile=0;g.updateCrew(0);g.persist();
  const loaded=g.loadSave();g.setSave(loaded);assert.equal(loaded.crew[0].carrying.amount,4);tick(g,10);assert.equal(loaded.modules[1].magazine,4);
  loaded.crew[0].carrying={type:'heavy',amount:3};loaded.modules[1].magazine=g.MODULES.railgun.magazine;tick(g,10);
  assert.equal(loaded.ammunition.heavy,3);assert.equal(loaded.crew[0].carrying,undefined);
});

test('an empty heavy magazine prevents firing despite stocked stores, while light shots fire with no ammunition',()=>{
  const g=game();let {save,b,gun}=battle(g,'railgun',0);g.updateBattle(.05,0);assert.equal(b.projectiles.length,0);assert.equal(save.ammunition.heavy,8);
  gun.magazine=g.MODULES.railgun.ammo;g.updateBattle(.05,50);assert.equal(b.projectiles.length,1);assert.equal(gun.magazine,0);
  b.projectiles=[];gun.cooldown=0;g.updateBattle(.05,100);assert.equal(b.projectiles.length,0);
  for(const type of ['weapon','laser','heavyLaser','autocannon']){
    ({save,b,gun}=battle(g,type,0));save.ammunition={heavy:0,missile:0};g.updateBattle(.05,0);assert.equal(b.projectiles.length,1,type);
  }
});

test('old supply resources and market packs are removed without changing rounds, magazines or cargo',()=>{
  const g=game(),save=logistics(g);save.ammunition.supplies=123;save.modules[1].magazine=2;
  save.crew[0].carrying={type:'missile',amount:3};const node=save.map.nodes.find((node)=>node.type==='trader');node.supplyPacks=4;
  g.persist();const loaded=g.loadSave();g.setSave(loaded);
  assert.deepEqual({...loaded.ammunition},{heavy:8,missile:4});assert.equal(loaded.modules[1].magazine,2);assert.equal(loaded.crew[0].carrying.amount,3);
  assert.equal(loaded.map.nodes.find((n)=>n.id===node.id).supplyPacks,undefined);
  node.stock=[{type:'ammoAssembly',qty:0,price:45}];g.upgradeTraderStock(node);assert.equal(node.stock[0].qty,0);assert.equal(node.supplyPacks,undefined);
  g.setTrade(node);g.renderAmmo();const html=g.elements.get('ammoPanel').innerHTML;
  assert.ok(html.includes('Power → assembly → crew → magazine'));assert.ok(!/SUPPLIES|BUY 12/.test(html));
});

test('every starting ship has a connected hull, clear mounts, a powered shield and forward-only thrust',()=>{
  const g=game();assert.equal(g.STARTER_SHIPS.length,4);
  for(const starter of g.STARTER_SHIPS){
    const save=g.newSave(starter.id);g.setSave(save);const cells=save.modules.flatMap(g.moduleCells),occupied=new Set(cells.map(([x,y])=>`${x},${y}`));
    assert.equal(occupied.size,cells.length,starter.id);assert.ok(g.connectedHull(save.modules),starter.id);assert.ok(g.weaponsHaveClearArc(save.modules),starter.id);
    for(const module of save.modules)for(const cell of g.moduleClearance(module))assert.ok(!occupied.has(cell.join(',')),`${starter.id}: ${module.type} blocked at ${cell}`);
    const engines=g.engineThrusters();assert.equal(engines.length,2);assert.ok(engines.every((engine)=>engine.module.rotation===0&&engine.force>0));
    const shields=save.modules.filter((module)=>module.type==='shield'&&module.hp>0);
    assert.equal(shields.length,1);assert.equal(g.MODULES.shield.capacity,100);
    assert.equal(save.starterId,starter.id);assert.ok(save.nextId>Math.max(...save.modules.map((m)=>m.id)));
    if(['arsenal','bulwark'].includes(starter.id)){const loader=save.crew.find((p)=>p.task==='load');for(const gun of save.modules.filter((m)=>g.MODULES[m.type].ammoType))gun.magazine=0;g.updateCrew(0);assert.ok(loader.workModuleId,starter.id);tick(g,20);assert.ok(save.modules.some((m)=>g.magazineCount(m)>0),starter.id);}
  }
});

test('encounter results resolve the beacon and remain visible until Continue',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const id=save.map.nodes.find((node)=>node.id!=='0-1').id;g.setPending(id);
  g.concludeEvent('SURVIVORS ABOARD','Three survivors rescued.','♡');assert.equal(g.getEventOpen(),true);assert.equal(save.map.current,id);assert.ok(save.map.resolved.includes(id));
  assert.equal(g.elements.get('eventOverlay').hidden,false);assert.equal(g.elements.get('eventTitle').textContent,'SURVIVORS ABOARD');assert.match(g.elements.get('captainsLog').innerHTML,/Three survivors rescued/);
});

test('entering battles and revisiting the map never refills stocks or magazines',()=>{
  const g=game(),save=g.newSave('arsenal');g.setSave(save);save.ammunition={heavy:0,missile:0};
  for(const room of save.modules.filter((room)=>room.type==='missile'))room.magazine=0;
  save.modules.find((room)=>room.type==='missile').magazine=2;
  for(let i=0;i<2;i++){
    g.startBattle('pirate');assert.deepEqual({...save.ammunition},{heavy:0,missile:0});
    assert.equal(save.modules.filter((room)=>room.type==='missile').reduce((n,m)=>n+m.magazine,0),2);
    assert.equal(g.getBattle().ammo,undefined);g.setBattle(null);
  }
});

test('new-game selection changes the starter only after a ship is chosen and persists the choice',()=>{
  const g=game(),save=g.newSave();g.setSave(save);g.showStarterPicker();assert.equal(g.getSave(),save);
  assert.equal(g.elements.get('starterPicker').hidden,false);assert.match(g.elements.get('starterLineup').innerHTML,/Arsenal/);
  g.startNewGame('bulwark');assert.equal(g.getSave().starterId,'bulwark');const loaded=g.loadSave();assert.equal(loaded.starterId,'bulwark');
  assert.equal(loaded.modules.filter((room)=>room.type==='railgun').length,2);
});

test('a swarm pays one missile round per rocket and cannot begin a burst without a full trigger load',()=>{
  const g=game(),def=g.MODULES.swarm;assert.equal(def.ammo,def.salvo);
  const {gun,b}=battle(g,'swarm',def.ammo-1);g.updateBattle(.05,0);assert.equal(b.projectiles.length,0);
  gun.magazine=def.ammo;g.updateBattle(.05,50);assert.equal(b.projectiles.length,def.salvo);assert.equal(gun.magazine,0);
});

test('ammo starters sustain both staffed weapons for three minutes from their powered production chain',()=>{
  for(const starter of ['arsenal','bulwark']){
    const g=game(),save=g.newSave(starter);g.setSave(save);save.ammunition={heavy:0,missile:0};
    const guns=save.modules.filter((room)=>g.MODULES[room.type].ammoType),factories=save.modules.filter((room)=>room.type==='ammoAssembly');
    assert.equal(save.crew.length,6);assert.equal(save.crew.filter((p)=>p.task==='load').length,2);assert.equal(save.crew.filter((p)=>p.task==='gun').length,2);
    assert.equal(save.crew.filter((p)=>p.task==='pilot').length,1);assert.equal(save.crew.filter((p)=>p.task==='repair').length,1);
    assert.equal(factories.length,2);assert.ok(factories.every((room)=>room.ammoRecipe===g.MODULES[guns[0].type].ammoType));
    assert.ok(guns.every((room)=>g.magazineCount(room)===g.MODULES[room.type].magazine));
    const target={x:900,y:500,hp:1e9,maxHp:1e9,r:12,speed:0,pathTimer:10000,path:[],phase:0,angle:0,cooldown:10000};
    const b={kind:'pirate',shake:0,world:{w:2400,h:2000},asteroids:[],projectiles:[],drones:[],player:{x:500,y:500,angle:0,r:g.engineThrusters().length*20,thrusters:{}},enemies:[target]};
    g.setBattle(b);const shots=g.trackFire();let waits=0;
    for(let frame=0;frame<3600;frame++){
      g.updateAmmoProduction(.05);g.updateCrew(.05);g.updateBattle(.05,frame*50);
      if(frame>200)for(const gun of guns)if(gun.cooldown<=0&&g.magazineCount(gun)<g.MODULES[gun.type].ammo)waits++;
    }
    assert.equal(waits,0,`${starter}: weapons waited for ammo after warmup`);
    for(const gun of guns)assert.ok(shots[gun.id]>30,`${starter}: weapon ${gun.id} only fired ${shots[gun.id]} times`);
    assert.ok(factories.some((room)=>room.ammoStock[room.ammoRecipe]>0),starter);
  }
});

test('Ammo Holds are removed from purchases and old ships retain every hull cell when converted to armor',()=>{
  const g=game(),save=g.newSave();assert.equal(g.MODULES.cargo,undefined);assert.ok(!g.BUYABLE.includes('cargo'));
  const legacy={id:50,type:'cargo',x:-4,y:8,rotation:3,flipped:true,hp:42,level:2};
  const expected=g.moduleCells({...legacy,type:'armor',footprint:{shape:[[0,0],[1,0],[2,0]],station:null}}).map((c)=>c.join(',')).sort();
  save.modules.push(legacy);save.inventory.cargo=2;save.inventory.armor=1;
  const node=save.map.nodes.find((node)=>node.type==='trader');node.stock=[{type:'cargo',qty:1,price:25},{type:'railgun',qty:0,price:70}];
  g.setSave(save);g.persist();const loaded=g.loadSave();assert.ok(loaded);const converted=loaded.modules.find((room)=>room.id===50);
  assert.equal(converted.type,'armor');assert.deepEqual(Array.from(g.moduleCells(converted),(c)=>c.join(',')).sort(),Array.from(expected));
  assert.equal(converted.hp,42);assert.equal(converted.level,2);assert.equal(converted.flipped,true);assert.equal(loaded.inventory.armor,3);assert.equal(loaded.inventory.cargo,undefined);
  const market=loaded.map.nodes.find((room)=>room.id===node.id);assert.equal(market.stock.length,1);assert.equal(market.stock[0].type,'railgun');assert.equal(market.stock[0].qty,0);
  g.setSave(loaded);g.persist();const again=g.loadSave();assert.equal(again.inventory.armor,3);assert.equal(again.modules.find((room)=>room.id===50).type,'armor');
  const oldTrader={stock:[{type:'cargo',qty:1,price:25}]};g.upgradeTraderStock(oldTrader);assert.ok(!oldTrader.stock.some((offer)=>offer.type==='cargo'));
});
