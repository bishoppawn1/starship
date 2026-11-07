const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const el=()=>({handlers:{},dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){}},getContext:()=>context,
    addEventListener(type,fn){this.handlers[type]=fn;},querySelectorAll:()=>[],setAttribute(){},append(){},replaceChildren(){},parentElement:{clientWidth:900,clientHeight:700}});
  const sandbox={Math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,newSave,loadSave,persist,scrapModule,roomScrapValue,roomScrapIssue,renderInspector,openTrader,beginModuleMove,
      connectedHull,moduleStation,moduleCells,crewRoutes,updateCrew,updateDrones,updateDroneAssembly,recoverDrones,launchAssembledDrone,normalizeDrones,totalPower,
      select(id){selectedModuleId=id;},setSave(value){save=value;},setMode(value){mode=value;},setBattle(value){battle=value;},
      getState(){return {selectedModuleId,movingModuleId,selectedCatalog};}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements};
}
const room=(g,id,type,x,y,extra={})=>({id,type,x,y,rotation:0,hp:g.MODULES[type].hp,level:1,...extra});
function setup(g,type='armor'){
  const save=g.newSave();save.modules=[room(g,1,'core',0,0),room(g,2,type,2,0)];save.crew=[{id:'porter',task:'idle',hp:100,x:.5,y:.5}];save.drones=[];
  g.setSave(save);g.setMode('hangar');g.select(2);return save;
}

test('the inspector scraps a room for its displayed half-price refund and persists without duplicate refunds',()=>{
  const g=game(),save=setup(g),metal=save.metal,inventory=JSON.stringify(save.inventory);g.renderInspector();
  assert.match(g.elements.get('moduleInspector').innerHTML,/SCRAP ROOM · \+10 METAL/);
  g.elements.get('scrapModule').handlers.click();assert.equal(save.modules.length,1);assert.equal(save.metal,metal+10);
  assert.equal(JSON.stringify(save.inventory),inventory);assert.equal(g.scrapModule(2),false);assert.equal(save.metal,metal+10);
  const loaded=g.loadSave();assert.equal(loaded.modules.length,1);assert.equal(loaded.metal,metal+10);assert.equal(g.getState().selectedModuleId,1);
});

test('refunds use base room price rather than upgrades or repair health',()=>{
  const g=game(),save=setup(g,'railgun'),part=save.modules[1],refund=Math.floor(g.MODULES.railgun.cost/2);
  part.level=3;part.hp=0;assert.equal(g.roomScrapValue(part),refund);const metal=save.metal;
  assert.equal(g.scrapModule(2),true);assert.equal(save.metal,metal+refund);
});

test('the core and combat scrapping are blocked, and hull splits require a trader refit',()=>{
  const g=game(),save=setup(g);save.modules.push(room(g,3,'armor',4,0));const before=JSON.stringify(save);
  assert.equal(g.scrapModule(1),false);assert.equal(g.scrapModule(2),false);assert.equal(JSON.stringify(save),before);
  g.renderInspector();assert.match(g.elements.get('moduleInspector').innerHTML,/id="scrapModule"[^>]*disabled/);
  for(const mode of ['combat','map']){g.setMode(mode);assert.equal(g.scrapModule(3),false);g.select(3);g.renderInspector();assert.doesNotMatch(g.elements.get('moduleInspector').innerHTML,/id="scrapModule"/);}
  g.setMode('hangar');g.select(1);g.renderInspector();assert.doesNotMatch(g.elements.get('moduleInspector').innerHTML,/id="scrapModule"/);
  g.openTrader({type:'trader',stock:[]});assert.equal(g.scrapModule(2),true);assert.equal(g.connectedHull(save.modules),false);assert.equal(g.elements.get('leaveTrader').disabled,true);
  assert.equal(g.scrapModule(3),true);assert.equal(g.connectedHull(save.modules),true);assert.equal(g.elements.get('leaveTrader').disabled,false);
});

test('scrapping evacuates crew, preserves carried ammo, and clears removed-floor orders and stale routes',()=>{
  const g=game(),save=setup(g),person=save.crew[0];Object.assign(person,{x:2.5,y:.5,task:'repair',workModuleId:2,manualGoal:{x:3.5,y:.5},carrying:{type:'heavy',amount:3}});
  g.crewRoutes.porter={path:[{x:3.5,y:.5}],target:'repair:2'};assert.equal(g.scrapModule(2),true);
  assert.equal(person.x,.5);assert.equal(person.y,.5);assert.equal(person.hp,100);assert.equal(person.task,'repair');assert.equal(person.workModuleId,null);
  assert.equal(person.manualGoal,undefined);assert.deepEqual({...person.carrying},{type:'heavy',amount:3});assert.equal(Object.keys(g.crewRoutes).length,0);
  g.updateCrew(0);assert.equal(person.hp,100);
});

test('magazine rounds and finished assembly stock return to command stores exactly once',()=>{
  const g=game(),save=setup(g,'railgun');save.modules[1].magazine=3;
  save.modules.push(room(g,3,'ammoAssembly',0,2,{ammoStock:{heavy:7,missile:5},ammoProgress:2}));
  const before={...save.ammunition};assert.equal(g.scrapModule(2),true);assert.equal(save.ammunition.heavy,before.heavy+3);
  assert.equal(g.scrapModule(3),true);assert.equal(save.ammunition.heavy,before.heavy+10);assert.equal(save.ammunition.missile,before.missile+5);
  assert.equal(g.scrapModule(3),false);assert.equal(save.ammunition.heavy,before.heavy+10);
  const loaded=g.loadSave();assert.deepEqual({...loaded.ammunition},{heavy:before.heavy+10,missile:before.missile+5});
});

test('scrapping an installed generator immediately removes its output without altering reactor upgrades',()=>{
  const g=game(),save=setup(g,'generator');save.reactorLevel=3;const before=g.totalPower();assert.equal(g.scrapModule(2),true);
  assert.equal(g.totalPower(),before-2);assert.equal(save.reactorLevel,3);
});

function droneShip(g){
  const save=setup(g,'droneControl');save.modules.push(room(g,3,'droneAssembly',0,2,{buildPaused:true}));
  save.drones=[
    {id:1,assembly:3,type:'defense',hp:40,phase:'stored',cooldown:0,x:.5,y:2.5},
    {id:2,assembly:3,type:'combat',hp:51,phase:'ready',bay:2,cooldown:0,x:2.5,y:.5},
    {id:3,assembly:3,type:'repair',hp:60,phase:'carried',carrier:'porter',bay:2,cooldown:0,x:.5,y:2.5}];
  Object.assign(save.crew[0],{task:'drone',x:.5,y:2.5,droneCargo:3,droneJob:{drone:3,bay:2}});return save;
}

test('scrapping a factory preserves stored, carried and loaded drones through production ticks and reloads',()=>{
  const g=game(),save=droneShip(g);assert.equal(g.scrapModule(3),true);
  assert.ok(save.drones.every((drone)=>drone.assembly===null));assert.equal(save.drones[0].pickupPoint.x,.5);assert.equal(save.drones[0].pickupPoint.y,.5);
  assert.equal(save.drones[1].phase,'ready');assert.equal(save.drones[1].bay,2);assert.equal(save.drones[2].phase,'carried');assert.equal(save.crew[0].droneCargo,3);
  g.updateDrones(.1);g.persist();const loaded=g.loadSave();g.setSave(loaded);assert.equal(loaded.drones.length,3);
  assert.deepEqual(Array.from(loaded.drones,(drone)=>drone.hp),[40,51,60]);assert.equal(loaded.crew[0].droneCargo,3);
  for(let i=0;i<400;i++){g.updateCrew(.05);g.updateDrones(.05);}
  assert.equal(loaded.drones.length,3);assert.ok(loaded.drones.every((drone)=>drone.phase!=='stored'&&drone.phase!=='carried'));
  g.setBattle({player:{x:500,y:500,angle:0,r:80},enemies:[],projectiles:[],effects:[],drones:loaded.drones});g.setMode('combat');
  const defender=loaded.drones.find((drone)=>drone.type==='defense');assert.equal(g.launchAssembledDrone(defender),true);
  g.recoverDrones();assert.equal(defender.phase,'ready');assert.equal(defender.bay,2);
});

test('scrapping a bay unloads drones to the core and lets crew reload them into a new bay',()=>{
  const g=game(),save=droneShip(g);assert.equal(g.scrapModule(2),true);
  assert.equal(save.drones[1].phase,'stored');assert.equal(save.drones[1].bay,undefined);assert.equal(save.drones[1].x,.5);assert.equal(save.drones[1].y,.5);
  assert.equal(save.crew[0].droneCargo,3);assert.equal(save.crew[0].droneJob,undefined);
  g.updateDrones(.1);g.persist();const loaded=g.loadSave();g.setSave(loaded);assert.equal(loaded.drones.length,3);
  loaded.modules.push(room(g,4,'droneControl',2,0));for(let i=0;i<500;i++){g.updateCrew(.05);g.updateDrones(.05);}
  assert.ok(loaded.drones.every((drone)=>drone.bay===4));assert.equal(loaded.crew[0].droneCargo,undefined);
});

test('scrapping cancels a pending move and does not restock or alter trader offers',()=>{
  const g=game(),save=setup(g),trader={type:'trader',stock:[{type:'armor',qty:0,price:17}]};g.openTrader(trader);g.select(2);const stock=JSON.stringify(trader.stock);
  assert.equal(g.beginModuleMove(),true);assert.equal(g.getState().movingModuleId,2);
  assert.equal(g.scrapModule(2),true);assert.equal(g.getState().movingModuleId,null);assert.equal(g.getState().selectedCatalog,null);
  assert.equal(save.inventory.armor,undefined);assert.equal(JSON.stringify(trader.stock),stock);
});
