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
    globalThis.game={MODULES,DRONE_PROGRAMS,startBeam,traceBeam,updateBeams,enemyShieldStrength,drawBeam,weaponCanTarget,newSave,loadSave,persist,moduleCells,moduleStation,moduleGeometry,canPlace,canPlaceFootprint,moduleClearance,droneBayDoor,droneBayClear,
      updateDroneAssembly,updateDrones,updateCrew,recoverDrones,droneBayCapacity,droneCount,assemblyTime,setDroneDesign,normalizeDrones,updateBoarding,enemyLayout,fireProjectile,
      weaponGeometry,weaponWorld,weaponAim,turnWeapon,fireWeapon,updateBattle,drawExteriorHardware,renderOperations,renderInspector,openTrader,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},select(id){selectedModuleId=id;},setMode(value){mode=value;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}


const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const room=(id,type,x,y,extra={})=>({id,type,x,y,rotation:0,hp:100,level:1,...extra});
function enemy(x=800,y=500,charge=0){
  const modules=[{type:'core',cells:[[0,0]],hp:1000,maxHp:1000},{type:'engine',cells:[[0,-1]],hp:1000,maxHp:1000},{type:'weapon',cells:[[0,1]],hp:1000,maxHp:1000},{type:'shield',cells:[[1,0]],hp:1000,maxHp:1000,charge,capacity:100,recharge:0}];
  return {x,y,angle:0,r:45,modules,hp:4000,maxHp:4000,crew:[],name:'TARGET'};
}
function setup(g,type='beam',charge=0){
  const save=g.newSave();save.crew=[];save.modules=[room(1,'core',0,0),room(2,'droneControl',2,0),room(3,'droneAssembly',0,2,{droneType:type})];
  g.setSave(save);g.setMode('combat');g.stubFlight();
  const b={world:{w:3000,h:2000},player:{x:150,y:150,r:80,angle:0},enemies:[enemy(800,500,charge)],asteroids:[],projectiles:[],drones:save.drones,effects:[]};g.setBattle(b);
  const drone={id:1,assembly:3,bay:2,type,hp:60,phase:'active',x:500,y:500,angle:0,cooldown:100,path:[]};save.drones.push(drone);
  return {save,b,drone,target:b.enemies[0]};
}
function sweep(g,drone,target,dt=.02,options={}){
  g.startBeam(drone,target,{drone:true,damage:18,range:500,duration:1.2,color:'#fff',...options});const beam=g.getBattle().beams.at(-1);
  for(let t=0;t<1.21;t+=dt)g.updateBeams(dt);return beam;
}

test('a visible left-to-right beam cuts each exposed room once instead of firing a bolt',()=>{
  const g=game(),{b,drone,target}=setup(g);g.startBeam(drone,target,{drone:true,damage:18,range:500,duration:1.2,color:'#fff'});
  const beam=b.beams[0];g.updateBeams(.3);const first={...beam.to};assert.ok(first.y<target.y);assert.equal(b.projectiles.length,0);
  g.updateBeams(.6);assert.ok(beam.to.y>target.y);assert.ok(beam.to.y>first.y);g.updateBeams(.31);
  for(const part of target.modules.slice(0,3))near(part.hp,982);near(target.hp,3946);assert.equal(b.beams.length,0);
});

test('beams deal exactly one third damage to shields and never leak through an intact shield',()=>{
  const g=game(),{drone,target}=setup(g,'beam',100);sweep(g,drone,target);
  near(g.enemyShieldStrength(target),82);near(target.hp,4000);assert.ok(target.modules.every((part)=>part.hp===1000));
});

test('shield collapse converts only the unabsorbed beam fraction into hull damage',()=>{
  const g=game(),{drone,target}=setup(g,'beam',3);sweep(g,drone,target);
  near(g.enemyShieldStrength(target),0);near(target.hp,3955);assert.deepEqual(target.modules.slice(0,3).map((part)=>part.hp).sort((a,b)=>a-b),[982,982,991]);
});

test('beam room damage is independent of frame rate and does not repeat while dwelling',()=>{
  const outcomes=[];for(const dt of [.005,.05,2]){const g=game(),{drone,target}=setup(g);sweep(g,drone,target,dt);outcomes.push(target.hp);}
  assert.deepEqual(outcomes,[3946,3946,3946]);
});

test('beam range, wrecks and the firing ship block the actual sweep',()=>{
  for(const obstacle of ['range','wreck','hull']){
    const g=game(),{b,drone,target}=setup(g);const options={};
    if(obstacle==='range')options.range=150;
    if(obstacle==='wreck')b.asteroids.push({x:650,y:500,r:100,hp:1000,maxHp:1000});
    if(obstacle==='hull')Object.assign(b.player,{x:650,y:500,r:80});
    sweep(g,drone,target,.02,options);near(target.hp,4000,1e-5);
    if(obstacle==='wreck')near(b.asteroids[0].hp,982);
  }
});

test('a moving source anchors the beam and losing its drone or powered bay ends the sweep',()=>{
  for(const reason of ['drone','power','blocked']){
    const g=game(),{save,b,drone,target}=setup(g);g.startBeam(drone,target,{drone:true,damage:9,range:400,duration:1,color:'#fff'});g.updateBeams(.1);
    drone.x+=10;g.updateBeams(.1);near(b.beams[0].x,drone.x);
    if(reason==='drone')drone.hp=0;else if(reason==='power')save.modules[1].hp=0;else save.modules.push(room(8,'core',4,0));
    const hp=target.hp;g.updateBeams(1);near(target.hp,hp);assert.equal(b.beams.length,0);
  }
});

test('both new beam rooms use their saved range, rotating barrel, arc and power',()=>{
  for(const type of ['beam','heavyBeam']){
    const g=game(),{save,b,target}=setup(g);const weapon=room(7,type,3,3,{cooldown:100,range:300});save.modules.push(weapon);
    const mount=g.weaponWorld(weapon,b.player);Object.assign(target,{x:mount.x+200,y:mount.y,r:45});
    assert.equal(g.weaponCanTarget(weapon,b.player,target),true);g.fireWeapon(weapon,b.player,target);assert.equal(b.beams[0].range,300);assert.equal(b.projectiles.length,0);
    g.updateBeams(.2);const left=weapon.aimOffset;g.updateBeams(g.MODULES[type].beamDuration*.6);assert.ok(weapon.aimOffset>left);assert.ok(Math.abs(weapon.aimOffset)<=g.MODULES[type].arc*Math.PI/360);
    weapon.hp=0;const hp=target.hp;g.updateBeams(1);near(target.hp,hp);assert.equal(b.beams.length,0);
  }
});

test('combat and beam drones fly continuously to and around their selected enemy',()=>{
  for(const type of ['combat','beam']){
    const g=game(),{b,drone,target}=setup(g,type);let angle=null,travel=0;
    for(let i=0;i<700;i++){
      const before={x:drone.x,y:drone.y};g.updateDrones(.02);assert.ok(Math.hypot(drone.x-before.x,drone.y-before.y)<=4.4+1e-6);
      if(i>200){const current=Math.atan2(drone.y-target.y,drone.x-target.x);if(angle!==null)travel+=Math.abs(Math.atan2(Math.sin(current-angle),Math.cos(current-angle)));angle=current;}
    }
    near(Math.hypot(drone.x-target.x,drone.y-target.y),target.r+65+12,.2);assert.ok(travel>5,'drone did not circle enemy');assert.ok(Math.hypot(drone.x-b.player.x,drone.y-b.player.y)>300);
  }
});

test('attack drones follow target changes and retarget after a command core dies',()=>{
  const g=game(),{b,drone,target}=setup(g,'combat');b.enemies.push(enemy(1300,700));b.droneTarget=1;
  for(let i=0;i<600;i++)g.updateDrones(.02);assert.ok(Math.hypot(drone.x-1300,drone.y-700)<150);
  b.enemies[1].modules[0].hp=0;const before={x:drone.x,y:drone.y};g.updateDrones(.02);assert.ok(Math.hypot(drone.x-before.x,drone.y-before.y)<=4.4+1e-6);
  for(let i=0;i<600;i++)g.updateDrones(.02);assert.ok(Math.hypot(drone.x-target.x,drone.y-target.y)<150);
});

test('defense drones keep protecting the player while beam drones create sweeping attacks',()=>{
  const g=game(),{b,drone,target}=setup(g);Object.assign(drone,{x:target.x-122,y:target.y,cooldown:0});g.updateDrones(.02);
  assert.equal(b.beams.length,1);assert.equal(b.beams[0].damage,9);assert.equal(b.beams[0].drone,true);assert.equal(b.projectiles.length,0);
  g.updateBeams(1);assert.ok(target.hp<4000);drone.type='defense';g.updateDrones(.02);near(Math.hypot(drone.x-b.player.x,drone.y-b.player.y),b.player.r+35);
});

test('beam drone design persists, waits for crew delivery, then launches from its bay',()=>{
  const g=game(),{save,b}=setup(g);save.drones=[];b.drones=save.drones;g.setMode('hangar');g.setBattle(null);g.updateDrones(15);
  assert.equal(save.drones[0].type,'beam');assert.equal(save.drones[0].phase,'stored');g.persist();const loaded=g.loadSave();g.setSave(loaded);
  assert.equal(loaded.modules[2].droneType,'beam');assert.equal(loaded.drones[0].type,'beam');loaded.crew=[{id:'loader',task:'drone',hp:100,...g.moduleStation(loaded.modules[0])}];
  for(let i=0;i<300;i++){g.updateCrew(.05);g.updateDrones(.05);}assert.equal(loaded.drones[0].phase,'ready');g.setBattle({...b,drones:loaded.drones});g.setMode('combat');g.updateDrones(.05);assert.equal(loaded.drones[0].phase,'launching');
});

test('a shield blocks the visible beam even where the ray misses a hull room',()=>{
  const g=game(),{b,drone,target}=setup(g,'beam',100);g.startBeam(drone,target,{drone:true,damage:18,range:500,duration:1.2,color:'#fff'});const beam=b.beams[0];
  g.traceBeam(beam,0);assert.ok(Math.hypot(beam.to.x-target.x,beam.to.y-target.y)<=target.r+17+1e-6);near(target.hp,4000);
});

test('attack drones follow a moving enemy and stop immediately when their bay loses power',()=>{
  const g=game(),{save,drone,target}=setup(g,'combat');for(let i=0;i<600;i++){target.x+=.5;target.y+=.1;g.updateDrones(.02);}
  assert.ok(Math.hypot(drone.x-target.x,drone.y-target.y)<150);save.modules[1].hp=0;const before={x:drone.x,y:drone.y};g.updateDrones(2);near(drone.x,before.x);near(drone.y,before.y);
});

test('a wreck in the approach lane does not trap attack drones or let them cross wreckage',()=>{
  const g=game(),{b,drone,target}=setup(g,'combat'),rock={x:650,y:500,r:60,hp:1000};b.asteroids=[rock];
  let farthest=drone.x;for(let i=0;i<600;i++){g.updateDrones(.02);farthest=Math.max(farthest,drone.x);assert.ok(Math.hypot(drone.x-rock.x,drone.y-rock.y)>rock.r+9);}
  assert.ok(Math.hypot(drone.x-target.x,drone.y-target.y)<150);assert.ok(farthest>900);
});

test('the player hull overlapping part of an orbit does not make an attack drone reverse endlessly',()=>{
  const g=game(),{b,drone,target}=setup(g,'combat');Object.assign(b.player,{x:target.x-280,y:target.y,r:120});Object.assign(drone,{x:target.x-125,y:target.y-20});let farthest=drone.x;
  for(let i=0;i<800;i++){g.updateDrones(.02);farthest=Math.max(farthest,drone.x);assert.ok(Math.hypot(drone.x-b.player.x,drone.y-b.player.y)>b.player.r+9);}
  assert.ok(farthest>target.x+100);
});
