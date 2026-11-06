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
    globalThis.game={MODULES,newSave,loadSave,persist,moduleCells,moduleStation,moduleGeometry,canPlace,canPlaceFootprint,moduleClearance,droneBayDoor,droneBayClear,
      updateDroneAssembly,updateDrones,updateCrew,recoverDrones,droneBayCapacity,droneCount,assemblyTime,setDroneDesign,normalizeDrones,updateBoarding,enemyLayout,fireProjectile,
      weaponGeometry,weaponWorld,weaponAim,turnWeapon,fireWeapon,updateBattle,drawExteriorHardware,renderOperations,renderInspector,openTrader,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},select(id){selectedModuleId=id;},setMode(value){mode=value;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}


const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const room=(id,type,x,y,rotation=0)=>({id,type,x,y,rotation,hp:type==='core'?170:80,level:1});
function setup(g,type='combat'){
  const save=g.newSave();save.crew=[];save.modules=[room(1,'core',0,0),room(2,'droneControl',2,0),{...room(3,'droneAssembly',0,2),droneType:type}];g.setSave(save);g.setMode('hangar');return save;
}
function battle(g){
  const modules=g.enemyLayout(true).modules,enemy={x:800,y:500,angle:Math.PI,r:90,modules,hp:modules.reduce((sum,m)=>sum+m.hp,0),maxHp:modules.reduce((sum,m)=>sum+m.hp,0),crew:[],speed:0,path:[],pathTimer:100,cooldown:100,phase:0,name:'TEST'};
  const b={kind:'pirate',world:{w:3000,h:2200},player:{x:500,y:500,angle:0,r:80,thrusters:{},vx:0,vy:0,omega:0},enemies:[enemy],drones:g.getSave().drones,asteroids:[],projectiles:[],effects:[],ammo:100,maxAmmo:100,shake:0,teleportCooldown:0};g.setBattle(b);g.setMode('combat');g.stubFlight();return b;
}
function deliver(g,seconds=12){const save=g.getSave();if(!save.crew.length)save.crew.push({id:'dockhand',task:'drone',hp:100,...g.moduleStation(save.modules[0])});for(let t=0;t<seconds;t+=.05){g.updateCrew(.05);g.updateDrones(.05);}}
function launch(g){for(let i=0;i<120;i++){g.updateCrew(.05);g.updateDrones(.05);}return g.getSave().drones[0];}

test('every bay orientation reserves an outside door and rejects obstruction beyond its first two cells',()=>{
  const g=game();for(let rotation=0;rotation<4;rotation++){
    const bay=room(2,'droneControl',10,10,rotation),[dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][rotation],cells=g.moduleCells(bay);
    const rear=cells.reduce((a,b)=>a[0]*dx+a[1]*dy<b[0]*dx+b[1]*dy?a:b),core=room(1,'core',rear[0]+(dx<0?1:dx>0?-2:0),rear[1]+(dy<0?1:dy>0?-2:0));
    const save=g.newSave();save.modules=[core];g.setSave(save);assert.equal(g.canPlace('droneControl',10,10,rotation),true,`rotation ${rotation}`);
    save.modules.push(bay);assert.equal(g.droneBayClear(bay),true);const clearance=g.moduleClearance(bay);assert.equal(clearance.length,2);
    for(const [x,y] of clearance)assert.ok(!g.moduleCells(bay).some(([cx,cy])=>x===cx&&y===cy));
    const door=g.droneBayDoor(bay),wall=room(9,'core',Math.floor(door.x+dx*7),Math.floor(door.y+dy*7));
    assert.equal(g.droneBayClear(bay,[...save.modules,wall]),false);
  }
});

test('later construction cannot cap the far end of an otherwise open launch lane',()=>{
  const g=game(),save=g.newSave(),bay=room(2,'droneControl',10,10);save.modules=[room(1,'core',8,10),bay,...[10,13,16].map((x,i)=>({...room(10+i,'armor',x,9),footprint:{shape:[[0,0],[1,0],[2,0]],station:null}}))];g.setSave(save);
  assert.equal(g.droneBayClear(bay),true);assert.equal(g.canPlaceFootprint('armor',19,9,0),true);assert.equal(g.canPlace('armor',19,9,0),false);
});

test('assembly builds one free drone before combat and bay launches it automatically along the open door',()=>{
  const g=game(),save=setup(g);const metal=save.metal;g.updateDrones(15);assert.equal(save.drones.length,1);assert.equal(save.drones[0].phase,'stored');assert.equal(save.metal,metal);assert.equal(save.droneParts,undefined);
  deliver(g);assert.equal(save.drones[0].phase,'ready');const b=battle(g);g.updateDrones(.1);const drone=save.drones[0],door=g.droneBayDoor(save.modules[1]);assert.equal(drone.phase,'launching');assert.ok(drone.launchProgress>0);
  const local={x:(drone.x-b.player.x)/30+2,y:(drone.y-b.player.y)/30+2};near(local.y,door.y);assert.ok(local.x>door.x);
  launch(g);assert.equal(drone.phase,'active');assert.equal(b.drones,save.drones);assert.equal(save.drones.length,1);
});

test('a bay alone or an assembly alone cannot operate a drone',()=>{
  const g=game(),save=setup(g);save.modules.pop();g.updateDrones(50);assert.equal(save.drones.length,0);
  save.modules=[room(1,'core',0,0),{...room(3,'droneAssembly',0,2),droneType:'combat'}];g.updateDrones(15);battle(g);g.updateDrones(10);assert.equal(save.drones.length,1);assert.equal(save.drones[0].phase,'stored');
});

test('blocked legacy bays remain inactive until refitted, without preventing unrelated construction',()=>{
  const g=game(),save=setup(g);save.modules.push(room(4,'core',4,0));g.updateDrones(15);battle(g);g.updateDrones(5);assert.equal(save.drones[0].phase,'stored');assert.equal(g.droneBayClear(save.modules[1]),false);
  assert.equal(g.canPlace('armor',0,4,0),true);save.modules.pop();deliver(g);assert.ok(['launching','active'].includes(save.drones[0].phase));
});

test('bay capacity queues ready drones and a destroyed drone is replaced automatically without cost',()=>{
  const g=game(),save=setup(g);save.modules.push({...room(4,'droneAssembly',2,2),droneType:'defense'},{...room(5,'droneAssembly',4,2),droneType:'combat'});g.updateDrones(15);deliver(g);battle(g);g.updateDrones(.1);
  assert.equal(save.drones.filter((drone)=>drone.phase==='launching').length,2);assert.equal(save.drones.filter((drone)=>drone.phase==='stored').length,1);
  const first=save.drones[0],assembly=first.assembly,metal=save.metal;first.hp=0;g.updateDrones(.1);assert.equal(save.drones.find((drone)=>drone.assembly===assembly),undefined);
  deliver(g);assert.equal(save.drones.filter((drone)=>drone.phase==='stored').length,0);g.updateDrones(15);assert.ok(save.drones.some((drone)=>drone.assembly===assembly));assert.equal(save.metal,metal);
});

test('repair drones operate outside combat and disabled bays pause them',()=>{
  const g=game(),save=setup(g,'repair');save.modules[0].hp=100;g.updateDrones(15);deliver(g);for(let i=0;i<100;i++)g.updateDrones(.05);assert.ok(save.modules[0].hp>100);
  const before=save.modules[0].hp;save.modules[1].hp=0;g.updateDrones(10);near(save.modules[0].hp,before);
});

test('surviving drones and design settings persist while obsolete parts and store offers disappear',()=>{
  const g=game(),save=setup(g,'defense');g.updateDrones(15);save.drones[0].hp=31;save.droneParts=9;save.map.nodes.find((node)=>node.type==='trader').dronePacks=2;g.persist();
  const loaded=g.loadSave();assert.equal(loaded.drones[0].hp,31);assert.equal(loaded.drones[0].phase,'stored');assert.equal(loaded.modules[2].droneType,'defense');assert.equal(loaded.droneParts,undefined);assert.ok(loaded.map.nodes.every((node)=>node.dronePacks===undefined));
  g.setSave(loaded);g.openTrader(loaded.map.nodes.find((node)=>node.type==='trader'));g.renderOperations();const text=g.elements.get('dronePanel').innerHTML;assert.ok(!text.includes('DEPLOY'));assert.ok(!text.includes('DRONE PARTS'));
});

test('preflight drone design changes rebuild the assembly and combat locks the design',()=>{
  const g=game(),save=setup(g);g.updateDrones(15);assert.equal(g.setDroneDesign(3,'repair'),true);assert.equal(save.drones.length,0);assert.equal(save.modules[2].droneType,'repair');
  g.updateDrones(15);assert.equal(save.drones[0].type,'repair');battle(g);assert.equal(g.setDroneDesign(3,'combat'),false);
});

test('automatically launched combat and defense drones keep their real combat effects',()=>{
  const g=game(),save=setup(g);save.modules.push({...room(4,'droneAssembly',2,2),droneType:'defense'});g.updateDrones(15);deliver(g);const b=battle(g);launch(g);
  const combat=save.drones.find((drone)=>drone.type==='combat');combat.angle=-.011;combat.cooldown=0;g.updateDrones(.01);assert.ok(b.projectiles.some((shot)=>shot.drone));
  const before=b.enemies[0].hp;for(let i=0;i<30;i++)g.updateBattle(.05,0);assert.equal(b.enemies[0].hp,before);assert.ok(b.enemies[0].modules.find((room)=>room.type==='shield').charge<100);
  save.drones.find((drone)=>drone.type==='defense').cooldown=0;g.fireProjectile('enemy',650,500,b.player,20,100,400);const incoming=b.projectiles.at(-1);g.updateDrones(.01);assert.ok(!b.projectiles.includes(incoming));
});

test('boarding drones visibly launch, fly to the target and sabotage it automatically',()=>{
  const g=game(),save=setup(g,'boarding');g.updateDrones(15);deliver(g);const b=battle(g);let boarded=false;
  for(let i=0;i<600;i++){g.updateDrones(.05);g.updateBoarding(.05);if(save.drones[0]?.phase==='boarding'){boarded=true;break;}}
  assert.equal(boarded,true);const weapon=b.enemies[0].modules.find((room)=>room.type==='weapon'),before=weapon.hp;g.updateBoarding(1);assert.ok(weapon.hp<before);
});

function gunSetup(g,rotation=0,flipped=false){
  const save=g.newSave(),gun={...room(2,'weapon',3,3,rotation),flipped,cooldown:0};const localAngle=g.weaponGeometry(gun).direction-35*Math.PI/180;save.modules=[room(1,'core',Math.floor(gun.x-20*Math.cos(localAngle)),Math.floor(gun.y-20*Math.sin(localAngle))),gun];save.crew=[];g.setSave(save);const b=battle(g),mount=g.weaponWorld(gun,b.player),angle=mount.direction-35*Math.PI/180;
  Object.assign(b.enemies[0],{x:mount.x+Math.cos(angle)*200,y:mount.y+Math.sin(angle)*200,modules:undefined,r:10,hp:1000,maxHp:1000,angle:0});return {save,gun,b,angle};
}

test('a cannon visibly turns 35 degrees left before spending ammo or firing',()=>{
  const g=game(),{gun,b,angle}=gunSetup(g);g.updateBattle(.05,0);assert.equal(b.ammo,100);assert.equal(b.projectiles.length,0);near(gun.aimOffset,-Math.PI*.05);
  for(let i=0;i<6&&!b.projectiles.length;i++)g.updateBattle(.05,0);assert.ok(b.projectiles.length);assert.equal(b.ammo,100-g.MODULES.weapon.ammo);near(gun.aimOffset,-35*Math.PI/180);near(Math.atan2(b.projectiles[0].vy,b.projectiles[0].vx),angle);
  const turns=[],ctx={save(){},restore(){},translate(){},rotate(value){turns.push(value);},scale(){},fillRect(){}};g.drawExteriorHardware(ctx,gun);near(turns[0],g.weaponGeometry(gun).direction+gun.aimOffset);
});

test('turret aiming follows mirrored and rotated mounts and tracks during reload',()=>{
  const g=game();for(const rotation of [0,1,2,3])for(const flipped of [false,true]){
    const {gun,b}=gunSetup(g,rotation,flipped);gun.cooldown=10;g.updateBattle(.3,0);near(gun.aimOffset,-35*Math.PI/180);assert.equal(b.ammo,100);
    const mount=g.weaponWorld(gun,b.player);b.enemies[0].x=mount.x+Math.cos(mount.direction)*200;b.enemies[0].y=mount.y+Math.sin(mount.direction)*200;g.updateBattle(.3,0);near(gun.aimOffset,0);
  }
});
