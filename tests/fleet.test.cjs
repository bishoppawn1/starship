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
    globalThis.game={MODULES,WEAPON_TYPES,newSave,migrateStarter,traderStock,moduleCells,weaponGeometry,weaponHasEscape,
      weaponsHaveClearArc,engineThrusters,upgradeTraderStock,openTrader,buyTraderItem,onGridClick,setMode,renderCatalog,crewGoal,
      weaponCanTarget,weaponWorld,fireWeapon,fireProjectile,weaponImpact,updateBattle,
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
  const g=game(),old=g.newSave();old.modules.pop();delete old.starterLayoutVersion;
  g.migrateStarter(old);assert.equal(old.modules.length,5);g.migrateStarter(old);assert.equal(old.modules.length,5);
  const custom=g.newSave();custom.modules.pop();delete custom.starterLayoutVersion;custom.modules[0].level=2;
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

test('trader offers include five weapons and two systems, and every weapon can be stocked',()=>{
  const g=game(),seen=new Set();
  for(let i=0;i<200;i++){
    const stock=g.traderStock();assert.equal(stock.length,7);assert.equal(stock.filter((item)=>g.MODULES[item.type].range).length,5);
    for(const item of stock)if(g.MODULES[item.type].range)seen.add(item.type);
  }
  assert.equal(seen.size,20);
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


test('older trader markets gain varied offers once without restocking sold items',()=>{
  const g=game(),node={stock:[{type:'weapon',qty:0,price:45},{type:'engine',qty:0,price:35}]};
  g.upgradeTraderStock(node);assert.equal(node.stock.length,7);assert.equal(node.stock[0].qty,0);assert.equal(node.stock[1].qty,0);
  const before=JSON.stringify(node.stock);g.upgradeTraderStock(node);assert.equal(JSON.stringify(node.stock),before);
  assert.equal(node.stock.filter((item)=>g.MODULES[item.type].range).length,5);
});

test('every weapon is included in automatic combat fire and spends its own trigger ammo cost',()=>{
  const g=game();
  for(const type of g.WEAPON_TYPES){
    const {b,gun}=combat(g,type);g.getSave().modules.push(gun);const def=g.MODULES[type],mount=g.weaponWorld(gun,b.player);
    b.enemies=[enemy(mount.x+100,mount.y)];g.updateBattle(.001,0);
    assert.equal(b.ammo,100-def.ammo,type);assert.equal(b.projectiles.length,def.salvo||1,type);
  }
});
