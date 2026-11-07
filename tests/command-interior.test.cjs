const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),draws=[];
  const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>{if(k==='drawImage')draws.push(args);}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({dataset:{},width:0,height:0,style:{removeProperty(){},setProperty(){}},classList:{add(){},remove(){}},
    getContext:()=>context,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},fire(type,event={}){this.listeners[type]?.(event);},querySelectorAll:()=>[],setAttribute(){},append(){},replaceChildren(){},parentElement:{clientWidth:600,clientHeight:500}});
  const math=Object.create(Math);
  const sandbox={Math:math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,STARTER_SHIPS,normalizeSystems,coreOutput,totalPower,upgradeCorePower,renderSystems,renderCrew,refreshCrewStatus,hurtCrew,selectCrew,stationConsole,drawStation,shieldDirection,setShieldDirection,shieldCovers,shieldInterception,absorbShields,shieldState,drawShieldCoverage,drawShields,showStarterPicker,startNewGame,newSave,loadSave,persist,moduleCells,moduleStation,moduleGeometry,canPlace,canPlaceFootprint,moduleClearance,droneBayDoor,droneBayClear,
      updateDroneAssembly,updateDrones,updateCrew,recoverDrones,droneBayCapacity,droneCount,assemblyTime,setDroneDesign,normalizeDrones,updateBoarding,enemyLayout,fireProjectile,
      weaponGeometry,weaponWorld,weaponAim,turnWeapon,fireWeapon,updateBattle,drawExteriorHardware,renderOperations,renderInspector,openTrader,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},select(id){selectedModuleId=id;},setMode(value){mode=value;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}


const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const room=(id,type,x,y,extra={})=>({id,type,x,y,rotation:0,hp:100,level:1,...extra});
function setup(g){const save=g.newSave();save.metal=500;g.setSave(save);g.setMode('hangar');return save;}
function battle(g){const b={player:{x:500,y:500,angle:0,r:80,thrusters:{}},world:{w:3000,h:2400},enemies:[{x:900,y:500,angle:0,r:60,hp:1000}],projectiles:[],asteroids:[],effects:[],shields:{}};g.setBattle(b);g.setMode('combat');return b;}

test('reactor upgrades and command-room reinforcement change separate saved properties',()=>{
  const g=game(),save=setup(g),core=save.modules[0],hp=core.hp;
  assert.equal(g.upgradeCorePower(),true);assert.equal(save.reactorLevel,2);assert.equal(g.coreOutput(),10);assert.equal(core.level,1);assert.equal(core.hp,hp);assert.equal(core.powerLevel,undefined);assert.equal(save.metal,460);
  g.select(core.id);g.renderInspector();assert.match(g.elements.get('moduleInspector').innerHTML,/REINFORCE ROOM/);g.elements.get('upgradeModule').fire('click');
  assert.equal(core.level,2);assert.equal(core.hp,hp+25);assert.equal(save.reactorLevel,2);assert.equal(g.coreOutput(),10);
  g.persist();const loaded=g.loadSave();g.setSave(loaded);assert.equal(loaded.reactorLevel,2);assert.equal(loaded.modules[0].level,2);assert.equal(g.coreOutput(),10);
  g.renderSystems();const html=g.elements.get('systemsPanel').innerHTML;assert.match(html,/UPGRADE REACTOR/);assert.doesNotMatch(html,/UPGRADE CORE POWER/);
});

test('legacy command-core power levels migrate once into the independent reactor',()=>{
  const g=game(),save=setup(g);delete save.powerVersion;save.reactorLevel=2;save.modules[0].powerLevel=4;g.normalizeSystems(save);
  assert.equal(save.reactorLevel,4);assert.equal(save.modules[0].powerLevel,undefined);assert.equal(g.coreOutput(),14);
  g.normalizeSystems(save);assert.equal(save.reactorLevel,4);save.modules[0].level=3;assert.equal(g.coreOutput(),14);
  g.persist();const loaded=g.loadSave();assert.equal(loaded.reactorLevel,4);assert.equal(loaded.modules[0].powerLevel,undefined);
});

test('crew death removes the assignment and selection immediately without resurrecting on reload',()=>{
  const g=game(),save=setup(g),lost=save.crew[0],survivor=save.crew[1];g.selectCrew(lost.id);g.hurtCrew(lost,100);
  let html=g.elements.get('crewList').innerHTML;assert.ok(!html.includes(`data-crew="${lost.id}"`));assert.ok(html.includes(`data-crew="${survivor.id}"`));assert.equal(save.crew.find((p)=>p.id===lost.id).hp,0);assert.equal(g.selectCrew(lost.id),false);
  g.persist();g.setSave(g.loadSave());g.renderCrew();html=g.elements.get('crewList').innerHTML;assert.ok(!html.includes(`data-crew="${lost.id}"`));assert.ok(html.includes(`data-crew="${survivor.id}"`));
});

test('crew status refresh uses each card identity after dead cards are filtered out',()=>{
  const g=game(),save=setup(g);save.crew[0].hp=0;save.crew[1].hp=41;save.crew[2].hp=83;
  const cards=save.crew.slice(1).reverse().map((person)=>{const status={},span={style:{}},value={},select={},meter={setAttribute(key,val){this[key]=val;},querySelector:(key)=>key==='span'?span:value};return {dataset:{crewId:person.id},status,meter,select,querySelector:(key)=>key==='small'?status:key==='.crew-health'?meter:select};});
  g.renderCrew();g.elements.get('crewList').querySelectorAll=()=>cards;g.refreshCrewStatus();
  assert.equal(cards[0].meter['aria-valuenow'],83);assert.equal(cards[1].meter['aria-valuenow'],41);assert.equal(cards[0].select.disabled,false);
});

test('focused shield direction is independent of the room rotation and preserves charge',()=>{
  const g=game(),save=setup(g),shield=room(80,'focusShield',0,0,{rotation:1});save.modules.push(shield);const b=battle(g);
  assert.equal(g.shieldDirection(shield),90);g.shieldState(shield).charge=73;assert.equal(g.setShieldDirection(80,180),true);shield.rotation=3;
  assert.equal(g.shieldDirection(shield),180);assert.equal(g.shieldState(shield).charge,73);assert.equal(g.shieldCovers(shield,b.player,Math.PI),true);assert.equal(g.shieldCovers(shield,b.player,0),false);
  b.player.angle=Math.PI/2;assert.equal(g.shieldCovers(shield,b.player,Math.PI*1.5),true);assert.equal(g.shieldCovers(shield,b.player,Math.PI),false);
  g.setShieldDirection(80,-15);assert.equal(shield.shieldFacing,345);assert.equal(g.setShieldDirection(80,NaN),false);
  g.persist();const loaded=g.loadSave();assert.equal(loaded.modules.find((m)=>m.id===80).shieldFacing,345);
});

test('the shield intercepts and absorbs shots only in the direction selected during combat',()=>{
  const g=game(),save=setup(g),shield=room(80,'focusShield',0,0);save.modules=[save.modules[0],shield];const b=battle(g);g.setShieldDirection(80,180);
  assert.ok(g.shieldInterception({x:200,y:500},1,0,b.player,600));assert.equal(g.shieldInterception({x:800,y:500},-1,0,b.player,600),null);
  assert.equal(g.absorbShields(30,Math.PI),0);near(g.shieldState(shield).charge,130);assert.equal(g.absorbShields(30,0),30);near(g.shieldState(shield).charge,130);
  g.setShieldDirection(80,0);assert.ok(g.shieldInterception({x:800,y:500},-1,0,b.player,600));near(g.shieldState(shield).charge,130);
});

test('the shield inspector offers immediate aiming without a trader or placement preview',()=>{
  const g=game(),save=setup(g),shield=room(80,'focusShield',0,0);save.modules.push(shield);battle(g);g.select(80);g.renderInspector();
  const html=g.elements.get('moduleInspector').innerHTML;assert.match(html,/AIM SHIELD/);assert.doesNotMatch(html,/id="shieldDirection"[^>]*disabled/);
  g.elements.get('shieldDirection').fire('change',{target:{value:'270'}});assert.equal(shield.shieldFacing,270);assert.match(g.elements.get('moduleInspector').innerHTML,/AIM 270°/);
});

test('shield coverage preview follows the independently aimed sector',()=>{
  const g=game(),save=setup(g),shield=room(80,'focusShield',0,0,{shieldFacing:270}),arcs=[];save.modules.push(shield);
  const context=new Proxy({arc(...args){arcs.push(args);}},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});g.drawShieldCoverage(context,shield,24);
  near((arcs[0][3]+arcs[0][4])/2,Math.PI*1.5);near(arcs[0][4]-arcs[0][3],105*Math.PI/180);
});

test('the Drones starter has loaded combat and beam drones, clear launch lanes and assigned delivery crew',()=>{
  const g=game(),save=g.newSave('drones');g.setSave(save);assert.equal(save.starterId,'drones');assert.equal(save.crew.length,5);assert.equal(save.crew.filter((p)=>p.task==='drone').length,2);
  assert.deepEqual(Array.from(save.drones,(d)=>d.type).sort(),['beam','combat']);assert.ok(save.drones.every((d)=>d.phase==='ready'));const bay=save.modules.find((m)=>m.type==='droneControl');assert.equal(g.droneBayClear(bay),true);
  for(const person of save.crew)assert.ok(save.modules.some((m)=>g.moduleCells(m).some(([x,y])=>x===Math.floor(person.x)&&y===Math.floor(person.y))));
  battle(g);g.updateDrones(.05);assert.ok(save.drones.every((d)=>d.phase==='launching'));assert.equal(g.droneCount(bay),2);
  g.persist();const loaded=g.loadSave();assert.equal(loaded.starterId,'drones');assert.ok(loaded.drones.every((d)=>d.phase==='ready'));
});

test('Drones appears as a fourth starter without modifying an existing run during preview',()=>{
  const g=game(),save=setup(g),before=JSON.stringify(save);g.showStarterPicker();assert.equal(g.STARTER_SHIPS.length,4);assert.match(g.elements.get('starterLineup').innerHTML,/CHOOSE DRONES/);assert.equal(JSON.stringify(save),before);
  g.startNewGame('drones');assert.equal(g.getSave().starterId,'drones');assert.equal(g.loadSave().starterId,'drones');
});

test('small side terminals keep the crew position clear across room rotations',()=>{
  const g=game();setup(g);for(const type of ['core','weapon','engine','shield','focusShield','droneAssembly'])for(let rotation=0;rotation<4;rotation++){
    const module=room(90,type,20,20,{rotation}),console=g.stationConsole(module),station=g.moduleStation(module),draws=[];near(console.x,station.x*24);near(console.y,station.y*24);
    const context=new Proxy({fillRect(...args){draws.push(args);}},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});g.drawStation(context,module);
    assert.ok(draws[0][3]<=7);assert.ok(draws[0][1]+draws[0][3]<0,'terminal covers the crew position');
  }
});
