const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function game(){
  const elements=new Map(),storage=new Map();
  const context=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  const element=()=>({getContext:()=>context,style:{},classList:{add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],setAttribute(){},replaceChildren(){}});
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,SHIELD_TYPES,shieldStats,WEAPON_TYPES,newSave,migrateStarter,traderStock,moduleCells,weaponGeometry,weaponHasEscape,
      weaponsHaveClearArc,engineThrusters,upgradeTraderStock,openTrader,buyTraderItem,onGridClick,setMode,renderCatalog,crewGoal,
      weaponCanTarget,weaponWorld,fireWeapon,fireProjectile,weaponImpact,updateBattle,
      enemyLayout,enemyAlive,rayEnemyRoom,hurtEnemy,enemySystemEfficiency,
      shieldInterception,absorbShields,updateShields,resolveRockCollision,clearSegment,safePoint,routeAroundRocks,orderMove,shipRadius,
      beginModuleMove,canPlace,placementPreview,systemEfficiency,enemyLayout,enemySystemEfficiency,drawHangar,drawExteriorHardware,
      selectModule(id){selectedModuleId=id;},hover(x,y){hoverCell={x,y};},rotateBuild,
      setSave(value){save=value;},getSave(){return save;},getMode(){return mode;},
      setBattle(value){battle=value;},getBattle(){return battle;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;},
      forceSelection(type){selectedCatalog=type;},filter(value){marketFilter=value;renderCatalog();}};
  })();`);
  const sandbox={console,Math,performance:{now:()=>0},innerWidth:1280,setTimeout:()=>0,clearTimeout(){},
    localStorage:{getItem:(key)=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element}};
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const weapon=(type)=>({id:5,type,x:3,y:3,rotation:0,level:1,hp:75,cooldown:0});
const enemy=(x=900,y=900)=>({x,y,hp:1000,maxHp:1000,r:8,speed:0,pathTimer:100,path:[],phase:0,angle:0,cooldown:100,name:'TEST RAIDER'});
function combat(g,type='weapon'){
  const gun=weapon(type),save=g.newSave();save.modules=[{id:1,type:'core',x:0,y:0,rotation:0,hp:170,level:1}];save.crew=[];g.setSave(save);g.stubFlight();
  const b={shake:0,ammo:100,world:{w:2000,h:2000},asteroids:[],projectiles:[],player:{x:500,y:500,angle:0,r:35},enemies:[enemy()]};
  g.setBattle(b);return {b,gun};
}

test('starter hull, cannon facings, and engine forces are mirrored around the centerline',()=>{
  const g=game(),save=g.newSave();g.setSave(save);
  const cells=save.modules.flatMap(g.moduleCells),occupied=new Set(cells.map(([x,y])=>`${x},${y}`));
  assert.equal(cells.length,occupied.size);
  for(const [x,y] of cells)assert.ok(occupied.has(`${x},${9-y}`));
  const guns=save.modules.filter((m)=>g.MODULES[m.type].range).map(g.weaponGeometry);
  assert.equal(guns.length,2);near(guns[0].y+guns[1].y,10);near(guns[0].x,guns[1].x);near(guns[0].direction,guns[1].direction);
  const engines=g.engineThrusters();near(engines[0].torque+engines[1].torque,0);
  assert.ok(engines[0].torque*engines[1].torque<0);assert.ok(g.weaponsHaveClearArc(save.modules));
  const reached=new Set([occupied.values().next().value]),queue=[...reached];
  for(const key of queue){const [x,y]=key.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=`${x+dx},${y+dy}`;if(occupied.has(next)&&!reached.has(next)){reached.add(next);queue.push(next);}}}
  assert.equal(reached.size,occupied.size);
});

test('starter migration repairs only the untouched legacy design and never duplicates a cannon',()=>{
  const g=game(),old=g.newSave();old.modules=old.modules.slice(0,4);delete old.starterLayoutVersion;
  g.migrateStarter(old);assert.equal(old.modules.length,5);g.migrateStarter(old);assert.equal(old.modules.length,5);
  const custom=g.newSave();custom.modules=custom.modules.slice(0,4);delete custom.starterLayoutVersion;custom.modules[0].level=2;
  g.migrateStarter(custom);assert.equal(custom.modules.length,4);
});

test('exactly 20 distinct weapons support all room rotations, crew stations, and firing',()=>{
  const g=game();assert.equal(g.WEAPON_TYPES.length,20);assert.equal(new Set(g.WEAPON_TYPES.map((type)=>g.MODULES[type].name)).size,20);
  const signatures=new Set();
  for(const type of g.WEAPON_TYPES){
    const def=g.MODULES[type];signatures.add([def.range,def.arc,def.damage,def.reload,def.ammo,def.salvo||1].join(','));
    for(let rotation=0;rotation<4;rotation++)for(let facing=0;facing<(def.mountFacings||1);facing++){
      const gun={...weapon(type),rotation,weaponFacing:facing};assert.ok(g.weaponHasEscape(gun,g.moduleCells(gun)),`${type}: rotation ${rotation}, facing ${facing}`);
    }
    const {b,gun}=combat(g,type);g.getSave().modules.push(gun);
    const mount=g.weaponWorld(gun,b.player),target=enemy(mount.x+100,mount.y);b.enemies=[target];
    g.fireWeapon(gun,b.player,target);assert.equal(b.projectiles.length,def.salvo||1);assert.ok(b.projectiles.every((shot)=>shot.remaining===def.range));
    assert.equal(g.crewGoal({task:'gun',x:3,y:3},{}).module.type,type);
  }
  assert.equal(signatures.size,20);
});

test('traders draw limited random stock with repeats and no guaranteed module type',()=>{
  const g=game(),seen=new Set(),missingShields=[];
  for(let i=0;i<200;i++){
    const stock=g.traderStock(),units=stock.reduce((sum,item)=>sum+item.qty,0);assert.ok(units>=4&&units<=8);
    assert.equal(new Set(stock.map(item=>item.type)).size,stock.length);
    missingShields.push(!stock.some(item=>item.type==='shield'));
    for(const item of stock)seen.add(item.type);
  }
  assert.ok(missingShields.some(Boolean));assert.ok(seen.size>=25);
});

test('catalog and module placement are confined to trading; purchases retain stock and held parts',()=>{
  const g=game(),save=g.newSave(),trader={stock:[{type:'plasma',qty:1,price:60}],type:'trader'};g.setSave(save);
  g.setMode('hangar');g.renderCatalog();assert.equal(g.elements.get('catalog').innerHTML,'');assert.equal(g.elements.get('traderTools').hidden,true);
  g.forceSelection('armor');const before=save.modules.length;g.onGridClick(6,0);assert.equal(save.modules.length,before);
  g.openTrader(trader);assert.equal(g.getMode(),'trade');assert.equal(g.elements.get('hangarTools').hidden,true);
  assert.ok(g.elements.get('catalog').innerHTML.includes('PLASMA CANNON'));assert.equal(g.buyTraderItem('plasma'),true);
  assert.equal(save.metal,30);assert.equal(save.inventory.plasma,1);assert.equal(trader.stock[0].qty,0);assert.equal(g.buyTraderItem('plasma'),false);
  g.setMode('hangar');assert.equal(g.buyTraderItem('plasma'),false);assert.equal(save.inventory.plasma,1);
  g.openTrader(trader);assert.ok(g.elements.get('catalog').innerHTML.includes('INSTALL HELD'));assert.ok(g.elements.get('catalog').innerHTML.includes('SOLD OUT'));
  g.filter('systems');assert.ok(!g.elements.get('catalog').innerHTML.includes('PLASMA CANNON'));
});

test('explosions, chain hits, slowing, and burning apply their distinct combat effects',()=>{
  const g=game(),{b}=combat(g),first=enemy(700,500),second=enemy(730,500);b.enemies=[first,second];
  g.weaponImpact({x:700,y:500,damage:20,splash:50,color:'#fff',slow:.4,slowDuration:3,burn:5,burnDuration:4},first);
  near(first.hp,980);near(second.hp,989);assert.equal(second.slowFactor,.4);assert.equal(first.burnTime,4);
  g.updateBattle(1,0);near(first.hp,975);near(second.hp,984);assert.equal(first.slowTime,2);
  g.weaponImpact({x:700,y:500,damage:10,chain:100},first);near(first.hp,965);near(second.hp,979);
});

test('guided missiles turn toward a moving target without exceeding their path length limit',()=>{
  const g=game(),{b}=combat(g),target=enemy(800,600);b.enemies=[target];
  g.fireProjectile('player',600,500,{x:900,y:500},10,100,30,{guidance:2,target});const shot=b.projectiles[0];
  g.updateBattle(.1,0);assert.ok(shot.vy>0);near(shot.remaining,20);
  g.updateBattle(.3,0);assert.equal(b.projectiles.length,0);near(shot.remaining,0);
});

test('piercing rounds damage each crossed ship once and stop after the configured penetration count',()=>{
  const g=game(),{b}=combat(g),first=enemy(625,500),second=enemy(660,500),third=enemy(700,500);b.enemies=[first,second,third];
  g.fireProjectile('player',600,500,{x:900,y:500},10,300,200,{pierce:1});
  g.updateBattle(.1,0);near(first.hp,990);assert.equal(b.projectiles.length,1);
  g.updateBattle(.2,0);near(first.hp,990);near(second.hp,990);near(third.hp,1000);assert.equal(b.projectiles.length,0);
});

test('salvos stay inside the mounted firing arc even when the target is near an arc edge',()=>{
  const g=game();
  for(const type of ['gatling','flak','scattergun','swarm','gauss']){
    const {b,gun}=combat(g,type);g.getSave().modules.push(gun);const def=g.MODULES[type],mount=g.weaponWorld(gun,b.player),half=def.arc*Math.PI/360;
    const target=enemy(mount.x+Math.cos(half)*100,mount.y+Math.sin(half)*100);g.fireWeapon(gun,b.player,target);
    for(const shot of b.projectiles)assert.ok(Math.abs(Math.atan2(shot.vy,shot.vx)-mount.direction)<=half+1e-7);
  }
});


test('older traders retain their stock and sold items without automatic restocking',()=>{
  const g=game(),node={stock:[{type:'weapon',qty:0,price:45},{type:'engine',qty:0,price:35}]};
  g.upgradeTraderStock(node);assert.equal(node.stock.length,2);assert.ok(node.recruits.length>=1);assert.equal(node.stock[0].qty,0);assert.equal(node.stock[1].qty,0);
  const before=JSON.stringify(node.stock);g.upgradeTraderStock(node);assert.equal(JSON.stringify(node.stock),before);
  assert.equal(node.stock.filter((item)=>g.MODULES[item.type].range).length,1);
});

test('every weapon is included in automatic combat fire and spends its own trigger ammo cost',()=>{
  const g=game();
  for(const type of g.WEAPON_TYPES){
    const {b,gun}=combat(g,type);g.getSave().modules.push(gun);const def=g.MODULES[type];gun.magazine=def.magazine;const mount=g.weaponWorld(gun,b.player);
    b.enemies=[enemy(mount.x+100,mount.y)];g.updateBattle(.001,0);
    assert.equal(gun.magazine,def.magazine-def.ammo,type);assert.equal(b.ammo,100);assert.equal(b.projectiles.length,def.salvo||1,type);
  }
});

test('pirate rooms take their own hits and disabled systems stop working',()=>{
  const g=game(),layout=g.enemyLayout(true),ship={x:500,y:500,angle:0,modules:layout.modules,r:layout.r,hp:layout.modules.reduce((sum,room)=>sum+room.hp,0),name:'RAIDER'};
  const engine=ship.modules.find((room)=>room.type==='engine'),core=ship.modules.find((room)=>room.type==='core');
  const contact=g.rayEnemyRoom({x:350,y:500},1,0,ship,250);
  assert.equal(contact.room.type,'engine');
  g.hurtEnemy(ship,engine.hp,engine);assert.equal(engine.hp,0);
  assert.equal(g.enemySystemEfficiency(ship,'engine'),0);
  assert.equal(g.enemyAlive(ship),true);
  g.hurtEnemy(ship,core.hp,core);assert.equal(g.enemyAlive(ship),false);
  assert.ok(ship.hp>0,'other rooms can remain intact after core destruction');
});

test('a swept player projectile damages the first pirate room it crosses',()=>{
  const g=game(),{b}=combat(g),layout=g.enemyLayout(true);
  const ship={...enemy(700,500),r:layout.r,modules:layout.modules};
  ship.hp=ship.maxHp=layout.modules.reduce((sum,room)=>sum+room.hp,0);b.enemies=[ship];
  Object.assign(ship.modules.find((room)=>room.type==='shield'),{charge:0,shieldDelay:100});
  const engine=ship.modules.find((room)=>room.type==='engine'),core=ship.modules.find((room)=>room.type==='core');
  g.fireProjectile('player',540,500,{x:850,y:500},14,400,400);
  g.updateBattle(.4,0);
  assert.equal(engine.hp,engine.maxHp-14);assert.equal(core.hp,core.maxHp);
});

test('focused shield strength covers one arc and recharges faster than full-hull strength',()=>{
  const g=game(),save=g.newSave();
  save.modules.push({id:20,type:'shield',x:1,y:1,rotation:0,level:1,hp:85});
  save.modules.push({id:21,type:'focusShield',x:8,y:6,rotation:0,level:1,hp:75});
  g.setSave(save);
  const player={x:500,y:500,angle:0,r:70},battle={player,shields:{}};g.setBattle(battle);
  const front=g.shieldInterception({x:700,y:500},-1,0,player,300);
  const back=g.shieldInterception({x:300,y:500},1,0,player,300);
  assert.ok(front.distance<back.distance,'the focused barrier extends ahead of the wide shell');
  assert.equal(g.absorbShields(50,0),0);
  assert.equal(battle.shields[21].charge,110);
  assert.equal(g.absorbShields(50,Math.PI),0);
  assert.equal(g.absorbShields(50,Math.PI),0);
  assert.equal(g.absorbShields(50,Math.PI),50);
  assert.equal(battle.shields[20].charge,0);
  g.updateShields(2.5);assert.ok(battle.shields[21].charge>110);assert.ok(battle.shields[20].charge>0);assert.ok(g.shieldStats(save.modules.at(-1)).recharge>g.shieldStats(save.modules.at(-2)).recharge);
});

test('enemy shots hit the shield barrier before they can damage a room',()=>{
  const g=game(),{b}=combat(g),save=g.getSave();
  save.modules.push({id:21,type:'focusShield',x:3,y:3,rotation:0,level:1,hp:75});
  b.enemies=[enemy(900,500)];
  const hullBefore=save.modules[0].hp;
  g.fireProjectile('enemy',700,500,b.player,20,300,300);
  g.updateBattle(.5,0);
  assert.equal(save.modules[0].hp,hullBefore);
  assert.equal(b.shields[21].charge,140);
  assert.equal(b.projectiles.length,0);
});

test('wreck routes allow close waypoints while direct impacts still bounce ships outward',()=>{
  const g=game(),wreck={x:500,y:500,r:30},world={w:1000,h:900};
  assert.equal(g.clearSegment({x:200,y:500},{x:800,y:500},40,[wreck]),false);
  const closeGoal={x:590,y:500};
  assert.equal(g.safePoint(closeGoal,40,[wreck],world).x,closeGoal.x);
  const route=g.routeAroundRocks({x:200,y:500},closeGoal,40,[wreck],world);
  assert.ok(route.length>1);
  assert.equal(route.at(-1).x,closeGoal.x);
  for(const point of route)assert.ok(Math.hypot(point.x-500,point.y-500)>=30+40+8);
  assert.equal(g.clearSegment({x:575,y:500},{x:700,y:500},40,[wreck]),true);
  assert.equal(g.routeAroundRocks({x:575,y:500},{x:700,y:500},40,[wreck],world).length,1);
  g.setSave(g.newSave());
  const nearHull={x:wreck.x+wreck.r+g.shipRadius()+20,y:wreck.y};
  assert.equal(g.safePoint(nearHull,g.shipRadius(),[wreck],world).x,nearHull.x);
  g.setBattle({world,asteroids:[wreck],player:{x:200,y:500,r:40,selected:true,path:[],dest:null,targetAngle:0}});
  g.orderMove(closeGoal);
  assert.equal(g.getBattle().player.dest.x,closeGoal.x);
  assert.ok(g.getBattle().player.path.length>1);
  const ship={x:563,y:500,r:40,vx:-30,vy:0};
  assert.equal(g.resolveRockCollision(ship,[wreck],world),true);
  assert.ok(ship.x>=575&&ship.vx>0);
});


test('trader moves keep room identity, damage, upgrades, range, and crew, without spending resources',()=>{
  const g=game(),save=g.newSave();g.setSave(save);
  const gun=save.modules.find((module)=>module.id===4);Object.assign(gun,{hp:41,level:2,range:175});
  save.crew[0].x=7.5;save.crew[0].y=4.5;
  g.selectModule(gun.id);assert.equal(g.beginModuleMove(),false);
  g.openTrader({type:'trader',stock:[]});g.selectModule(gun.id);assert.equal(g.beginModuleMove(),true);
  const metal=save.metal,inventory=JSON.stringify(save.inventory),original={...gun};
  g.onGridClick(0,0);assert.equal(JSON.stringify(gun),JSON.stringify(original));
  let destination;
  for(let y=0;y<10;y++)for(let x=0;x<12;x++)if(g.canPlace(gun.type,x,y,gun.rotation)&&(x!==gun.x||y!==gun.y))destination={x,y};
  assert.ok(destination);g.onGridClick(destination.x,destination.y);
  assert.equal(gun.x,destination.x);assert.equal(gun.y,destination.y);
  assert.equal(gun.id,4);assert.equal(gun.hp,41);assert.equal(gun.level,2);assert.equal(gun.range,175);
  assert.equal(save.metal,metal);assert.equal(JSON.stringify(save.inventory),inventory);
  assert.ok(save.modules.flatMap(g.moduleCells).some(([x,y])=>x===Math.floor(save.crew[0].x)&&y===Math.floor(save.crew[0].y)));
});

test('moving a connecting room cannot disconnect other rooms and leaving a trader cancels the move',()=>{
  const g=game(),save=g.newSave();save.modules=[
    {id:1,type:'core',x:4,y:4,rotation:0,hp:170,level:1},
    {id:2,type:'cargo',x:6,y:4,rotation:0,hp:65,level:1},
    {id:3,type:'core',x:9,y:4,rotation:0,hp:170,level:1}];g.setSave(save);
  g.openTrader({type:'trader',stock:[]});g.selectModule(2);g.beginModuleMove();
  assert.equal(g.canPlace('cargo',4,3,0),false);
  const before=JSON.stringify(save.modules);g.setMode('hangar');g.onGridClick(4,3);assert.equal(JSON.stringify(save.modules),before);
});

test('placement previews carry the chosen weapon mount and rotation before installation',()=>{
  const g=game(),save=g.newSave();save.inventory.missile=1;g.setSave(save);g.openTrader({type:'trader',stock:[]});
  g.forceSelection('missile');g.hover(8,3);
  const first=g.placementPreview();assert.equal(first.module.type,'missile');assert.equal(first.module.rotation,0);
  const points=[];g.elements.get('hangarArt').getContext().lineTo=(x,y)=>points.push([x,y]);g.drawHangar();
  assert.ok(points.length>10,'the uninstalled weapon renders its firing arc');
  g.rotateBuild(1);assert.equal(g.placementPreview().module.rotation,1);assert.equal(save.modules.length,7);
});

test('energy and light weapons fire with empty magazines while heavy guns and launchers wait for loaders',()=>{
  const g=game();
  for(const type of ['ion','laser','heavyLaser','proton','weapon','siege','missile','swarm','torpedo']){
    const {b,gun}=combat(g,type);g.getSave().modules.push(gun);b.ammo=0;
    const mount=g.weaponWorld(gun,b.player);b.enemies=[enemy(mount.x+150,mount.y)];g.updateBattle(.01,0);
    assert.equal(b.projectiles.length,g.MODULES[type].ammo===0?1:0,type);assert.equal(b.ammo,0);
  }
});

test('missiles acquire targets behind the launcher and clear every rotated hull before tracking',()=>{
  const g=game();
  for(const type of ['missile','swarm'])for(let rotation=0;rotation<4;rotation++)for(let facing=0;facing<2;facing++)for(const flipped of [false,true]){
    const {b,gun}=combat(g,type);gun.rotation=rotation;gun.weaponFacing=facing;gun.flipped=flipped;g.getSave().modules.push(gun);b.player.angle=.71;
    const mount=g.weaponWorld(gun,b.player),target=enemy(mount.x-Math.cos(mount.direction)*250,mount.y-Math.sin(mount.direction)*250);b.enemies=[target];
    assert.ok(g.weaponCanTarget(gun,b.player,target));g.fireWeapon(gun,b.player,target);
    const shots=[...b.projectiles];assert.equal(shots.length,g.MODULES[type].salvo||1);
    for(let step=0;step<Math.ceil(((g.MODULES[type].salvo||1)-1)*(g.MODULES[type].burstInterval||0)/.02)+6;step++)g.updateBattle(.02,0);
    assert.ok(shots.every((shot)=>b.projectiles.includes(shot)),`${type} ${rotation}/${facing} exploded at launch`);
    assert.ok(Math.hypot(shots[0].x-mount.x,shots[0].y-mount.y)>1,`${type} ${rotation}/${facing} lead shot did not leave the launcher`);
  }
});

test('a partially blocked missile mount launches along its clear arc instead of into an adjacent room',()=>{
  const g=game(),{b,gun}=combat(g,'missile');g.getSave().modules.push(gun,{id:10,type:'core',x:6,y:3,rotation:0,hp:170,level:1});
  const mount=g.weaponWorld(gun,b.player);b.enemies=[enemy(mount.x+200,mount.y)];g.fireWeapon(gun,b.player,b.enemies[0]);
  const shot=b.projectiles[0];assert.ok(shot);assert.ok(Math.abs(shot.vy)>0);
  for(let i=0;i<10;i++)g.updateBattle(.02,0);
  assert.ok(b.projectiles.includes(shot));
});

test('missiles explode on asteroids, damage nearby ships, and remove destroyed rocks',()=>{
  const g=game(),{b}=combat(g),rock={x:700,y:500,r:20,hp:15,maxHp:40};b.asteroids=[rock];b.enemies=[enemy(710,535)];
  g.fireProjectile('player',600,500,{x:800,y:500},20,250,300,{splash:38,color:'#fff',family:'missile'});
  g.updateBattle(.4,0);assert.equal(rock.hp,0);assert.equal(b.asteroids.length,0);assert.equal(b.projectiles.length,0);
  assert.ok(b.enemies[0].hp<1000);assert.ok(b.effects.some((effect)=>effect.r===38));
});

test('ion hits weaken the struck weapon instead of slowing the whole ship, then expire',()=>{
  const g=game(),{b}=combat(g),target=enemy(800,500);target.modules=g.enemyLayout(true).modules.map((module)=>({...module}));target.cooldown=10;b.enemies=[target];Object.assign(target.modules.find((room)=>room.type==='shield'),{charge:0,shieldDelay:100});
  g.weaponImpact({x:855,y:489,damage:7,ion:.5,ionDuration:3},target);
  assert.equal(g.enemySystemEfficiency(target,'weapon'),.5);assert.equal(g.enemySystemEfficiency(target,'engine'),1);assert.equal(target.slowTime,undefined);
  g.updateBattle(1,0);near(target.modules.find((room)=>room.type==='weapon').cooldown,9.5);g.updateBattle(2.1,0);assert.equal(g.enemySystemEfficiency(target,'weapon'),1);
});

test('proton lances pass through own hull without damage and stop at the first enemy',()=>{
  const g=game(),{b,gun}=combat(g,'proton');g.getSave().modules.push(gun,{id:10,type:'core',x:7,y:3,rotation:0,hp:170,level:1});
  const before=g.getSave().modules.map((module)=>module.hp),mount=g.weaponWorld(gun,b.player);
  const first=enemy(mount.x+150,mount.y),second=enemy(mount.x+200,mount.y);b.enemies=[first,second];gun.cooldown=100;
  assert.ok(g.weaponCanTarget(gun,b.player,first));g.fireWeapon(gun,b.player,first);g.updateBattle(.3,0);
  assert.equal(first.hp,976);assert.equal(second.hp,1000);assert.equal(b.projectiles.length,0);assert.deepEqual(g.getSave().modules.map((module)=>module.hp),before);
});


test('every weapon including the hull-passing proton lance has visible mounted hardware',()=>{
  const g=game();g.getSave().crew=[];
  for(const type of g.WEAPON_TYPES){
    let rectangles=0;const context=g.elements.get('hangarArt').getContext();context.fillRect=()=>rectangles++;
    g.drawExteriorHardware(context,weapon(type));assert.ok(rectangles>10,type);
  }
});


test('fractional frame distances do not create phantom hull impacts on a clear missile path',()=>{
  const g=game(),{b}=combat(g);
  const dt=.0300005;
  assert.ok((250*dt/30)*30<250*dt);g.fireProjectile('player',600,500,{x:1000,y:500},20,250,560,{splash:38});
  g.updateBattle(dt,0);assert.equal(b.projectiles.length,1);assert.equal(b.effects.length,0);
});
