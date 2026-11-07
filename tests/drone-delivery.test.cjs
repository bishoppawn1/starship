const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),draws=[];
  const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>{if(k==='drawImage')draws.push(args);}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({dataset:{},width:0,height:0,style:{removeProperty(){},setProperty(){}},classList:{add(){},remove(){}},
    getContext:()=>context,addEventListener(){},querySelectorAll:()=>[],setAttribute(){},append(){},replaceChildren(){},parentElement:{clientWidth:600,clientHeight:500}});
  const math=Object.create(Math);
  const sandbox={Math:math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,newSave,loadSave,persist,moduleStation,moduleCells,updateDrones,updateCrew,crewWorkPlan,crewStatus,droneCount,normalizeDrones,recoverDrones,setDroneDesign,hurtCrew,launchAssembledDrone,startBattle,openTrader,onGridClick,beginModuleMove,
      setSave(value){save=value;for(const id of Object.keys(crewRoutes))delete crewRoutes[id];},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},select(id){selectedModuleId=id;},setMode(value){mode=value;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}



const part=(g,id,type,x,y,extra={})=>({id,type,x,y,rotation:0,hp:g.MODULES[type].hp,level:1,...extra});
function setup(g,task='drone',type='combat'){
  const save=g.newSave();save.modules=[part(g,1,'core',0,0),part(g,2,'droneAssembly',0,2,{droneType:type}),part(g,3,'droneControl',5,1),part(g,4,'armor',2,1,{footprint:{shape:[[0,0],[1,0],[2,0]],station:null}})];
  save.crew=[{id:'porter',name:'PORTER',task,hp:100,x:.5,y:.5}];g.setSave(save);g.setMode('hangar');g.setBattle(null);g.updateDrones(4);save.modules[1].buildPaused=true;return save;
}
function tick(g,seconds){for(let i=0;i<Math.ceil(seconds/.05);i++){g.updateCrew(.05);g.updateDrones(.05);}}
function pickup(g){for(let i=0;i<200&&g.getSave().crew[0].droneCargo===undefined;i++)tick(g,.05);assert.ok(g.getSave().crew[0].droneCargo!==undefined);}
function battle(g){const b={player:{x:500,y:500,angle:0,r:80},enemies:[],projectiles:[],drones:g.getSave().drones};g.setBattle(b);g.setMode('combat');return b;}

test('a finished drone cannot teleport to a bay or launch without a crew delivery',()=>{
  const g=game(),save=setup(g);save.crew=[];battle(g);g.updateDrones(30);
  assert.equal(save.drones.length,1);assert.equal(save.drones[0].phase,'stored');assert.equal(save.drones[0].bay,undefined);assert.equal(g.launchAssembledDrone(save.drones[0]),false);
});

test('crew walk to the assembly, visibly carry its exact drone, and load it at the bay',()=>{
  const g=game(),save=setup(g),drone=save.drones[0],person=save.crew[0],id=drone.id;
  g.updateCrew(0);assert.equal(person.droneCargo,undefined);assert.equal(g.crewStatus(person),'FETCHING DRONE');assert.equal(drone.phase,'stored');
  pickup(g);assert.equal(person.droneCargo,id);assert.equal(drone.phase,'carried');assert.equal(g.crewStatus(person),'CARRYING DRONE');
  tick(g,.3);assert.equal(drone.x,person.x);assert.equal(drone.y,person.y);assert.equal(drone.phase,'carried');
  tick(g,8);assert.equal(drone.phase,'ready');assert.equal(drone.id,id);assert.equal(drone.bay,3);assert.equal(person.droneCargo,undefined);assert.equal(person.droneJob,undefined);
  battle(g);g.updateDrones(.1);assert.equal(drone.phase,'launching');
});

test('multiple loaders claim distinct drones and can load more than two into one bay',()=>{
  const g=game(),save=setup(g);save.crew.push({id:'other',task:'drone',hp:100,x:.5,y:.5});g.updateCrew(0);
  assert.equal(save.crew.filter((person)=>person.droneJob).length,1);
  save.modules.push(part(g,5,'droneAssembly',0,4),part(g,6,'droneAssembly',2,3));g.updateDrones(4);
  for(const assembly of save.modules.filter((module)=>module.type==='droneAssembly'))assembly.buildPaused=true;
  tick(g,25);
  assert.equal(g.droneCount(save.modules[2]),3);assert.equal(save.drones.filter((drone)=>drone.phase==='ready').length,3);
});

test('a disconnected assembly or bay leaves its drone waiting for a physical route',()=>{
  const g=game(),save=setup(g);save.modules[1].x=50;tick(g,20);assert.equal(save.drones[0].phase,'stored');assert.equal(save.crew[0].droneCargo,undefined);
  save.modules[1].x=0;save.modules[2].x=50;tick(g,20);assert.equal(save.drones[0].phase,'stored');
});

test('a blocked bay holds cargo until a valid delivery destination opens',()=>{
  const g=game(),save=setup(g);pickup(g);save.modules.push(part(g,9,'core',7,1));tick(g,5);
  assert.equal(save.drones[0].phase,'carried');assert.equal(save.crew[0].droneCargo,save.drones[0].id);
  save.modules.pop();tick(g,10);assert.equal(save.drones[0].phase,'ready');
});

test('manual movement keeps the drone with the carrier and resuming the job completes delivery',()=>{
  const g=game(),save=setup(g);pickup(g);const person=save.crew[0],drone=save.drones[0];person.manualGoal={x:.5,y:.5};tick(g,4);
  assert.equal(drone.phase,'carried');assert.equal(drone.x,person.x);assert.equal(drone.y,person.y);
  delete person.manualGoal;tick(g,10);assert.equal(drone.phase,'ready');
});

test('changing jobs drops the drone on its current floor cell for another carrier to collect',()=>{
  const g=game(),save=setup(g);pickup(g);tick(g,.4);const person=save.crew[0],drone=save.drones[0],drop={x:Math.floor(person.x)+.5,y:Math.floor(person.y)+.5};person.task='pilot';g.updateCrew(0);
  assert.equal(drone.phase,'stored');assert.deepEqual({...drone.pickupPoint},drop);assert.equal(person.droneCargo,undefined);
  save.crew.push({id:'relief',task:'drone',hp:100,x:.5,y:.5});tick(g,12);assert.equal(drone.phase,'ready');assert.equal(save.drones.length,1);
});

test('a dead carrier drops the drone and never leaves an unusable reservation',()=>{
  const g=game(),save=setup(g);pickup(g);g.hurtCrew(save.crew[0],100);g.updateCrew(0);
  assert.equal(save.drones[0].phase,'stored');assert.equal(save.drones[0].carrier,undefined);assert.equal(save.drones[0].bay,undefined);
  save.crew.push({id:'relief',task:'load',hp:100,x:.5,y:.5});tick(g,12);assert.equal(save.drones[0].phase,'ready');
});

test('in-flight drone cargo survives reload and surviving drones dock ready for the next battle',()=>{
  const g=game(),save=setup(g);pickup(g);tick(g,.3);const id=save.drones[0].id;g.persist();const loaded=g.loadSave();g.setSave(loaded);
  assert.equal(loaded.crew[0].droneCargo,id);assert.equal(loaded.drones[0].phase,'carried');tick(g,10);assert.equal(loaded.drones[0].phase,'ready');
  battle(g);g.updateDrones(.1);assert.equal(loaded.drones[0].phase,'launching');g.recoverDrones();assert.equal(loaded.drones[0].phase,'ready');assert.equal(loaded.drones[0].bay,3);
});

test('ammo loaders handle drone deliveries after ammunition work, with no mixed cargo',()=>{
  const g=game(),save=setup(g,'load');save.modules.push(part(g,5,'railgun',2,0,{magazine:0}));save.ammunition.heavy=4;save.ammunition.missile=0;
  g.updateCrew(0);assert.ok(save.crew[0].carrying);assert.equal(save.crew[0].droneCargo,undefined);assert.equal(save.drones[0].carrier,undefined);
  tick(g,20);assert.equal(save.modules[4].magazine,4);assert.equal(save.drones[0].phase,'ready');assert.equal(save.crew[0].carrying,undefined);
});

test('repair drones also require a delivery before they repair anything',()=>{
  const g=game(),save=setup(g,'drone','repair');save.modules[0].hp=100;g.updateDrones(20);assert.equal(save.modules[0].hp,100);
  tick(g,15);assert.ok(save.modules[0].hp>100);assert.equal(save.drones[0].phase,'active');
});


test('starting an actual battle launches only drones already delivered to the bay',()=>{
  const g=game(),save=setup(g);g.startBattle('pirate');assert.equal(save.drones[0].phase,'stored');g.setBattle(null);g.setMode('hangar');tick(g,12);
  assert.equal(save.drones[0].phase,'ready');g.startBattle('pirate');assert.equal(save.drones[0].phase,'launching');
});

test('a dropped drone moves with its room during a trader refit and remains recoverable',()=>{
  const g=game(),save=setup(g);pickup(g);save.crew[0].task='pilot';g.updateCrew(0);const drone=save.drones[0];
  g.openTrader({type:'trader',stock:[],recruits:[]});g.select(2);assert.equal(g.beginModuleMove(),true);g.onGridClick(0,-2);
  assert.equal(save.modules[1].y,-2);assert.deepEqual({...drone.pickupPoint},{x:.5,y:-1.5});save.crew.push({id:'relief',task:'drone',hp:100,x:.5,y:.5});tick(g,15);assert.equal(drone.phase,'ready');
});
