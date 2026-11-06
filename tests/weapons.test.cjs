const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function game() {
  const storage=new Map(),elements=new Map(),context={};
  const element=()=>({getContext:()=>context,style:{},classList:{add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[]});
  const sandbox={console,Math,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},
    localStorage:{getItem:(key)=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element}};
  let source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
  source=source.replace('  init();\n})();', `
    globalThis.game={weaponGeometry,rotatedGeometry,moduleCells,hullRay,weaponHasEscape,weaponsHaveClearArc,
      weaponRange,weaponWorld,weaponCanTarget,canPlace,fireProjectile,updateBattle,drawWeaponArc,persist,loadSave,
      setSave(value){save=value;},getSave(){return save;},setFacing(value){buildWeaponFacing=value;},
      setBattle(value){battle=value;},getBattle(){return battle;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);
  return sandbox.game;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const gun=(rotation=0,weaponFacing=0)=>({id:1,type:'weapon',x:3,y:3,rotation,weaponFacing,hp:75,level:1,cooldown:0});
const room=(x,y)=>({id:100+x*10+y,type:'core',x,y,rotation:0,hp:170,level:1});
const save=(modules)=>({modules,crew:[],metal:90,sector:1,map:{version:2,nodes:[{}]},inventory:{}});

test('all four room rotations keep both pulse mount options on exposed cell edges',()=>{
  const g=game();
  for(let rotation=0;rotation<4;rotation++)for(let facing=0;facing<2;facing++){
    const weapon=gun(rotation,facing),mount=g.weaponGeometry(weapon),cells=g.moduleCells(weapon);
    assert.equal(g.weaponHasEscape(weapon,cells),true);
    near(g.hullRay(mount,mount.direction,cells,20),20);
    near(g.hullRay(mount,mount.direction+Math.PI,cells,20),0);
    const geometry=g.rotatedGeometry('weapon',rotation);
    if(!facing){near(mount.x,weapon.x+geometry.muzzle[0]);near(mount.y,weapon.y+geometry.muzzle[1]);}
  }
});

test('railgun barrel direction stays fixed regardless of pulse mount setting',()=>{
  const g=game();
  for(let rotation=0;rotation<4;rotation++){
    const weapon={...gun(rotation,1),type:'railgun'},mount=g.weaponGeometry(weapon),geometry=g.rotatedGeometry('railgun',rotation);
    near(mount.direction,rotation*Math.PI/2);
    near(mount.x,weapon.x+geometry.muzzle[0]);near(mount.y,weapon.y+geometry.muzzle[1]);
    near(g.hullRay(mount,mount.direction,g.moduleCells(weapon),30),30);
  }
});

test('hull rays stop at the first room and never resume on its far side',()=>{
  const g=game(),origin={x:2,y:2.5},cells=[[1,2],[4,2],[8,2]];
  near(g.hullRay(origin,0,cells,20),2);
  near(g.hullRay(origin,0,cells,1),1);
  near(g.hullRay({x:4,y:2.5},Math.PI,cells,20),2);
  near(g.hullRay({x:4.5,y:2.5},0,cells,20),0);
});

test('partially blocked arcs retain their open directions; enclosure rejects all fire',()=>{
  const g=game(),weapon=gun(),own=g.moduleCells(weapon);
  assert.equal(g.weaponHasEscape(weapon,[...own,[6,3]]),true);
  const wall=[];for(let y=0;y<10;y++)wall.push([6,y]);
  assert.equal(g.weaponHasEscape(weapon,[...own,...wall]),false);
  wall.splice(wall.findIndex(([,y])=>y===2),1);
  assert.equal(g.weaponHasEscape(weapon,[...own,...wall]),true);
});

test('placement rejects a fully obscured weapon and enclosing an installed weapon',()=>{
  const g=game(),weapon=gun();
  g.setSave(save([room(1,3)]));
  assert.equal(g.canPlace('weapon',3,3,0),true);
  g.setSave(save([room(1,3),room(5,2),room(5,4)]));
  assert.equal(g.canPlace('weapon',3,3,0),false);
  // A distant wall leaves an open cell at the muzzle, but still obscures every ray.
  g.setSave(save([room(1,3),room(6,0),room(6,2),room(6,4),room(6,6),room(6,8)]));
  assert.equal(g.canPlace('weapon',3,3,0),false);
  g.setSave(save([weapon,room(1,3)]));
  assert.equal(g.canPlace('core',5,3,0),false);
  assert.equal(g.canPlace('core',3,5,0),true);
});

test('alternate pulse facing changes the muzzle, firing arc, and saved range',()=>{
  const g=game(),weapon=gun(),player={x:500,y:500,angle:.7};
  g.setSave(save([weapon,room(0,6)]));
  let mount=g.weaponWorld(weapon,player);
  const target=(angle,dist)=>({x:mount.x+Math.cos(angle)*dist,y:mount.y+Math.sin(angle)*dist});
  assert.equal(g.weaponCanTarget(weapon,player,target(mount.direction,300)),true);
  weapon.range=100;
  assert.equal(g.weaponCanTarget(weapon,player,target(mount.direction,101)),false);
  assert.equal(g.weaponCanTarget(weapon,player,target(mount.direction,99)),true);
  weapon.weaponFacing=1;mount=g.weaponWorld(weapon,player);
  assert.equal(g.weaponCanTarget(weapon,player,target(mount.direction,99)),true);
  assert.equal(g.weaponCanTarget(weapon,player,target(mount.direction+Math.PI/2,99)),false);
  g.persist();const loaded=g.loadSave().modules[0];
  assert.equal(loaded.range,100);assert.equal(loaded.weaponFacing,1);
  weapon.range=9999;assert.equal(g.weaponRange(weapon),420);
  weapon.range=-1;assert.equal(g.weaponRange(weapon),30);
  weapon.range=NaN;assert.equal(g.weaponRange(weapon),420);
});

test('targeting and displayed arc share first-hit hull clipping, including disabled rooms',()=>{
  const g=game(),weapon=gun(),blocker={...room(6,3),hp:0},player={x:500,y:500,angle:0};
  g.setSave(save([weapon,blocker]));
  const mount=g.weaponWorld(weapon,player);
  assert.equal(g.weaponCanTarget(weapon,player,{x:mount.x+100,y:mount.y}),false);
  assert.equal(g.weaponCanTarget(weapon,player,{x:mount.x+20,y:mount.y}),true);
  const points=[],ctx={beginPath(){},moveTo(){},lineTo(x,y){points.push({x,y});},closePath(){},fill(){},stroke(){}};
  g.drawWeaponArc(ctx,weapon,30,'rgba(1,2,3,.2)');
  const origin=g.weaponGeometry(weapon);
  for(const p of points){
    const dist=Math.hypot(p.x/30-origin.x,p.y/30-origin.y),angle=Math.atan2(p.y/30-origin.y,p.x/30-origin.x);
    assert.ok(dist<=g.weaponRange(weapon)/30+1e-7);
    near(g.hullRay(origin,angle,[...g.moduleCells(weapon),...g.moduleCells(blocker)],dist),dist);
  }
});

function combat(g,modules=[room(0,0)]) {
  g.setSave(save(modules));g.stubFlight();
  const b={shake:0,ammo:100,world:{w:2000,h:2000},asteroids:[],projectiles:[],
    player:{x:500,y:500,angle:0,r:35},
    enemies:[{x:1400,y:1400,hp:100,r:10,speed:0,pathTimer:100,path:[],phase:0,angle:0,cooldown:100}]};
  g.setBattle(b);return b;
}

test('projectiles stop at their configured range even with a step beyond the limit',()=>{
  const g=game(),b=combat(g);
  g.fireProjectile('player',600,500,{x:900,y:500},10,390,31);
  const shot=b.projectiles[0];g.updateBattle(.1,0);
  near(shot.x,631);assert.equal(b.projectiles.length,0);
});

test('swept shots stop at hull cells and cannot hit enemies on the far side',()=>{
  const g=game(),b=combat(g);
  b.enemies[0].x=620;b.enemies[0].y=500;
  g.fireProjectile('player',400,500,{x:700,y:500},10,1000,400);
  const shot=b.projectiles[0];g.updateBattle(.3,0);
  near(shot.x,470);assert.equal(b.enemies[0].hp,100);assert.equal(b.projectiles.length,0);
});

test('shots can hit before the range boundary but never damage targets beyond it',()=>{
  for(const [targetX,expected] of [[625,90],[645,100]]){
    const g=game(),b=combat(g);b.enemies[0].x=targetX;b.enemies[0].y=500;
    g.fireProjectile('player',600,500,{x:900,y:500},10,1000,31);
    g.updateBattle(.1,0);assert.equal(b.enemies[0].hp,expected);assert.equal(b.projectiles.length,0);
  }
});

test('ammo-free light shots still require targets within a clear arc and configured range',()=>{
  for(const [blocked,range,expected] of [[true,420,100],[false,60,100],[false,420,99]]){
    const g=game(),weapon=gun(),modules=[weapon,room(1,3)];
    if(blocked)modules.push(room(6,3));
    weapon.range=range;
    const b=combat(g,modules),mount=g.weaponWorld(weapon,b.player);
    b.enemies[0].x=mount.x+100;b.enemies[0].y=mount.y;
    g.updateBattle(.01,0);
    assert.equal(b.ammo,100);assert.equal(b.projectiles.length,expected===99?1:0);
  }
});
