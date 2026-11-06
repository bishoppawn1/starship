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
    globalThis.game={AMMO,MODULES,WEAPON_TYPES,STARTER_SHIPS,newSave,normalizeAmmo,loadSave,persist,recoverAmmoCrate,updateAmmoProduction,magazineCount,ammoSources,updateCrew,crewGoal,crewStatus,crewRoutes,
      moduleStation,moduleCells,moduleClearance,connectedHull,weaponsHaveClearArc,engineThrusters,updateBattle,startBattle,finishBattle,upgradeTraderStock,buyAmmoSupplies,concludeEvent,startNewGame,showStarterPicker,
      setSave(value){save=value;for(const key of Object.keys(crewRoutes))delete crewRoutes[key];},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},
      getMode(){return mode;},setMode(value){mode=value;},getEventOpen(){return eventOpen;},setPending(value){pendingNodeId=value;eventOpen=true;},setTrade(value){mode='trade';tradeNode=value;},
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

test('crates unpack immediately and old crates migrate exactly once without refilling depleted supplies',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const before={...save.ammunition};g.recoverAmmoCrate();
  assert.deepEqual({...save.ammunition},{supplies:before.supplies+12,heavy:before.heavy+8,missile:before.missile+4});
  delete save.ammoVersion;delete save.ammunition;save.ammoCrates=2;g.normalizeAmmo(save);
  assert.deepEqual({...save.ammunition},{supplies:48,heavy:24,missile:12});assert.equal(save.ammoCrates,undefined);
  save.ammunition.supplies=0;save.ammunition.heavy=0;g.persist();const loaded=g.loadSave();
  assert.deepEqual({...loaded.ammunition},{supplies:0,heavy:0,missile:12});
});

test('assemblies convert finite supplies into local typed stock and stop without supplies, power or output space',()=>{
  const g=game(),save=logistics(g),assembly=save.modules[3];save.modules=[save.modules[0],assembly];save.crew=[];
  const before=save.ammunition.supplies;g.updateAmmoProduction(4);
  assert.equal(assembly.ammoStock.heavy,4);assert.equal(save.ammunition.supplies,before-2);assert.equal(save.ammunition.heavy,8);
  assembly.ammoRecipe='missile';g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,2);assert.equal(save.ammunition.supplies,before-5);
  assembly.hp=0;g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,2);
  assembly.hp=75;save.ammunition.supplies=0;g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,2);
  save.ammunition.supplies=20;assembly.ammoStock.missile=24;g.updateAmmoProduction(4);assert.equal(save.ammunition.supplies,20);
  assembly.ammoStock.missile=0;save.modules[0].hp=0;g.updateAmmoProduction(4);assert.equal(assembly.ammoStock.missile,0);
});

test('loaders physically pick up finite matching stock and deliver it only to the correct magazine',()=>{
  const g=game(),save=logistics(g);save.ammunition={supplies:0,heavy:4,missile:0};
  g.updateCrew(0);assert.deepEqual({...save.crew[0].carrying},{type:'heavy',amount:4});assert.equal(save.ammunition.heavy,0);assert.equal(save.modules[1].magazine,0);
  assert.match(g.crewStatus(save.crew[0]),/CARRYING 4 HEAVY/);tick(g,8);
  assert.equal(save.modules[1].magazine,4);assert.equal(save.modules[2].magazine,0);assert.equal(save.crew[0].carrying,undefined);
  save.ammunition.missile=4;tick(g,8);assert.equal(save.modules[2].magazine,4);assert.equal(save.modules[1].magazine,4);assert.equal(save.ammunition.missile,0);
  tick(g,8);assert.equal(save.modules[1].magazine+save.modules[2].magazine,8);
});

test('loaders collect from assembly output and never manufacture rounds when all sources are empty',()=>{
  const g=game(),save=logistics(g);save.ammunition={supplies:0,heavy:0,missile:0};save.modules[3].ammoStock.heavy=4;
  tick(g,15);assert.equal(save.modules[1].magazine,4);assert.equal(save.modules[3].ammoStock.heavy,0);
  tick(g,15);assert.equal(save.modules[1].magazine,4);assert.equal(save.crew[0].workModuleId,null);
});

test('multiple loaders cannot duplicate shared stock and disconnected ammo cannot be teleported',()=>{
  const g=game(),save=logistics(g);save.crew.push({id:'second',task:'load',x:.5,y:.5,hp:100});save.ammunition={supplies:0,heavy:4,missile:0};
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

test('an empty heavy magazine prevents firing despite stocked stores, while light shots fire with no supplies',()=>{
  const g=game();let {save,b,gun}=battle(g,'railgun',0);g.updateBattle(.05,0);assert.equal(b.projectiles.length,0);assert.equal(save.ammunition.heavy,8);
  gun.magazine=g.MODULES.railgun.ammo;g.updateBattle(.05,50);assert.equal(b.projectiles.length,1);assert.equal(gun.magazine,0);
  b.projectiles=[];gun.cooldown=0;g.updateBattle(.05,100);assert.equal(b.projectiles.length,0);
  for(const type of ['weapon','laser','heavyLaser','autocannon']){
    ({save,b,gun}=battle(g,type,0));save.ammunition={supplies:0,heavy:0,missile:0};g.updateBattle(.05,0);assert.equal(b.projectiles.length,1,type);
  }
});

test('traders supply assembly modules and finite supply packs without restocking sold offers',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const node={type:'trader',stock:[{type:'ammoAssembly',qty:0,price:45}]};g.upgradeTraderStock(node);
  assert.equal(node.stock.filter((item)=>item.type==='ammoAssembly').length,1);assert.equal(node.stock[0].qty,0);
  g.setTrade(node);const before=save.ammunition.supplies;assert.equal(g.buyAmmoSupplies(),true);assert.equal(save.ammunition.supplies,before+12);assert.equal(save.metal,82);
  node.supplyPacks=0;g.upgradeTraderStock(node);assert.equal(g.buyAmmoSupplies(),false);assert.equal(node.supplyPacks,0);
});

test('every starting ship has a connected non-overlapping hull, clear mounts and paired reverse thrust',()=>{
  const g=game();assert.equal(g.STARTER_SHIPS.length,3);
  for(const starter of g.STARTER_SHIPS){
    const save=g.newSave(starter.id);g.setSave(save);const cells=save.modules.flatMap(g.moduleCells),occupied=new Set(cells.map(([x,y])=>`${x},${y}`));
    assert.equal(occupied.size,cells.length,starter.id);assert.ok(g.connectedHull(save.modules),starter.id);assert.ok(g.weaponsHaveClearArc(save.modules),starter.id);
    for(const module of save.modules)for(const cell of g.moduleClearance(module))assert.ok(!occupied.has(cell.join(',')),`${starter.id}: ${module.type} blocked at ${cell}`);
    const reverse=g.engineThrusters().filter((engine)=>engine.module.rotation===2);assert.equal(reverse.length,2);assert.ok(reverse.every((engine)=>engine.force>0));
    assert.equal(save.starterId,starter.id);assert.ok(save.nextId>Math.max(...save.modules.map((m)=>m.id)));
    if(starter.id!=='wayfarer'){const loader=save.crew.find((p)=>p.task==='load');g.updateCrew(0);assert.ok(loader.workModuleId,starter.id);tick(g,20);assert.ok(save.modules.some((m)=>g.magazineCount(m)>0),starter.id);}
  }
});

test('encounter results resolve the beacon and return directly to the map with no second choice',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const id=save.map.nodes.find((node)=>node.id!=='0-1').id;g.setPending(id);
  g.concludeEvent('SURVIVORS ABOARD','Three survivors rescued.','♡');assert.equal(g.getMode(),'map');assert.equal(g.getEventOpen(),false);assert.equal(save.map.current,id);assert.ok(save.map.resolved.includes(id));
  assert.equal(g.elements.get('eventOverlay').hidden,true);assert.match(g.elements.get('captainsLog').innerHTML,/Three survivors rescued/);
});

test('entering battles and revisiting the map never refills stocks or magazines',()=>{
  const g=game(),save=g.newSave('arsenal');g.setSave(save);save.ammunition={supplies:0,heavy:0,missile:0};
  save.modules.find((room)=>room.type==='missile').magazine=2;
  for(let i=0;i<2;i++){
    g.startBattle('pirate');assert.deepEqual({...save.ammunition},{supplies:0,heavy:0,missile:0});
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
