const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),draws=[];
  const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>draws.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
  const el=()=>({dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){}},getContext:()=>context,
    setAttribute(){},addEventListener(){},querySelectorAll:()=>[],replaceChildren(){},append(){},parentElement:{clientWidth:900,clientHeight:700}});
  const math=Object.create(Math),sandbox={Math:math,performance:{now:()=>0},innerWidth:1200,setTimeout:()=>0,clearTimeout(){},window:{devicePixelRatio:1},
    localStorage:{getItem:()=>null,setItem(){}},document:{createElement:el,getElementById:(id)=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);}}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,ENEMY_LOADOUTS,newSave,enemyLayout,startBattle,enemyAlive,enemyWeaponMount,enemyWeaponStats,fireEnemyWeapons,
      enemyShieldState,enemyShieldStrength,absorbEnemyShields,updateEnemyShields,enemyShieldInterception,weaponImpact,fireProjectile,updateBattle,
      hurtEnemy,enemyPath,enemySprite,drawEnemy,evasionChance,updateDrones,shieldState,moduleStation,enemyTacticalRange,enemyTacticalGoal,clearSegment,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;},setEvasion(value){evasionChance=()=>value;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,draws,math};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function ship(g,loadout='cannon',heavy=true,sector=1){
  const layout=g.enemyLayout(heavy,sector,loadout),hp=layout.modules.reduce((sum,m)=>sum+m.hp,0);
  for(const room of layout.modules)if(room.type==='weapon')room.cooldown=1000;
  return {...layout,x:900,y:800,angle:Math.PI,hp,maxHp:hp,name:'TEST RAIDER',loadout,ammo:22,speed:0,path:[],pathTimer:1000,phase:0,cooldown:1000,crew:[]};
}
function setup(g,loadout='cannon'){
  const save=g.newSave();save.modules=[{id:1,type:'core',x:0,y:0,rotation:0,level:1,hp:170}];save.crew=[];g.setSave(save);g.stubFlight();
  const enemy=ship(g,loadout),b={kind:'pirate',shake:0,ammo:100,maxAmmo:100,world:{w:3000,h:2000},player:{x:500,y:800,angle:0,r:35},asteroids:[],enemies:[enemy],projectiles:[],drones:[]};g.setBattle(b);
  return {save,b,enemy,shield:enemy.modules.find(m=>m.type==='shield')};
}
const fire=(g,enemy,damage,extra={})=>g.fireProjectile('player',enemy.x-250,enemy.y,enemy,damage,400,800,extra);

test('enemy tactics use weapon range, retreat for weak shields, and orbit instead of rushing the player',()=>{
  const g=game(),{b,enemy,shield}=setup(g,'cannon');enemy.speed=80;enemy.orbitSign=1;
  const cannonRange=g.enemyTacticalRange(enemy),missile=ship(g,'missile');
  assert.ok(cannonRange>=320);assert.ok(g.enemyTacticalRange(missile)>cannonRange+100);
  shield.charge=10;assert.ok(g.enemyTacticalRange(enemy)>cannonRange+50);shield.charge=100;
  enemy.x=680;enemy.y=800;enemy.pathTimer=0;g.updateBattle(.5,0);assert.ok(enemy.x>680,'a close raider should back away');
  enemy.x=1400;enemy.y=800;enemy.path=[];enemy.pathTimer=0;g.updateBattle(.5,0);assert.ok(enemy.x<1400,'a distant raider should close');
  enemy.x=500+cannonRange;enemy.y=800;enemy.path=[];enemy.pathTimer=0;g.updateBattle(.5,0);
  assert.ok(Math.abs(enemy.y-800)>5,'a raider in range should move sideways');
  for(let i=0;i<30;i++)g.updateBattle(.1,0);
  assert.ok(Math.abs(enemy.y-800)>35,'the orbit should continue in one direction');
  b.asteroids=[{x:1100,y:800,r:40,hp:80,maxHp:80}];enemy.x=1400;enemy.y=800;enemy.path=[];enemy.pathTimer=0;
  g.updateBattle(.1,0);assert.ok(enemy.path.length>1,'wreckage should alter the tactical route');
  let previous={x:1400,y:800};for(const waypoint of enemy.path){assert.ok(g.clearSegment(previous,waypoint,enemy.r,b.asteroids));previous=waypoint;}
});

test('all enemy loadouts have connected shield rooms and distinct usable weapon mounts',()=>{
  const g=game();for(const heavy of [false,true])for(const loadout of Object.keys(g.ENEMY_LOADOUTS)){
    const enemy=ship(g,loadout,heavy),cells=enemy.modules.flatMap(m=>m.cells),keys=new Set(cells.map(([x,y])=>`${x},${y}`));assert.equal(cells.length,keys.size);
    const reached=new Set([keys.values().next().value]),queue=[...reached];for(const key of queue){const [x,y]=key.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=`${x+dx},${y+dy}`;if(keys.has(n)&&!reached.has(n)){reached.add(n);queue.push(n);}}}assert.equal(reached.size,keys.size);
    assert.equal(g.enemyShieldStrength(enemy),heavy?100:60);const weaponRooms=enemy.modules.filter(m=>m.type==='weapon');assert.equal(weaponRooms.length,g.ENEMY_LOADOUTS[loadout].weapons.length);
    for(const room of weaponRooms){assert.ok(g.MODULES[room.weaponType].range);const mount=g.enemyWeaponMount(enemy,room);assert.ok(Number.isFinite(mount.x));assert.ok(Number.isFinite(mount.y));}
    const last=enemy.modules.at(-1).cells[0];assert.ok(g.enemyPath(enemy,{x:-1,y:-1},{x:last[0],y:last[1]}));
  }
});

test('encounters draw cannon, laser, missile and later mixed variants, with distinct rescue skiffs',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const seen=new Set();save.sector=3;
  for(const roll of [0,.3,.6,.9]){g.math.random=()=>roll;g.startBattle('pirate');const enemy=g.getBattle().enemies[0];seen.add(enemy.loadout);assert.ok(enemy.name.includes(g.ENEMY_LOADOUTS[enemy.loadout].name));assert.equal(enemy.crew.length,2);assert.equal(enemy.ammo,30);assert.ok(g.enemyShieldStrength(enemy)>100);}
  assert.equal(seen.size,4);save.sector=1;g.startBattle('rescue');const b=g.getBattle();assert.equal(b.enemies.length,2);assert.notEqual(b.enemies[0].loadout,b.enemies[1].loadout);assert.equal(g.enemyShieldStrength(b.enemies[0]),60);
});

test('enemy shield interception protects actual rooms and crew and passes only excess damage',()=>{
  const g=game(),{b,enemy,shield}=setup(g),before=enemy.hp;enemy.crew=[{hp:70,room:2}];
  fire(g,enemy,20);g.updateBattle(.5,0);assert.equal(enemy.hp,before);assert.equal(shield.charge,80);assert.equal(enemy.crew[0].hp,70);assert.equal(b.projectiles.length,0);
  shield.charge=12;shield.shieldDelay=100;fire(g,enemy,20);g.updateBattle(.5,0);assert.equal(shield.charge,0);near(enemy.hp,before-8);
  fire(g,enemy,20);g.updateBattle(.5,0);near(enemy.hp,before-28);
});

test('enemy shields recharge continuously after the hit delay and disabled rooms collapse them',()=>{
  const g=game(),{enemy,shield}=setup(g);assert.equal(g.absorbEnemyShields(enemy,99.75),0);near(shield.charge,.25);
  g.updateEnemyShields(enemy,1.7);near(shield.charge,.25);g.updateEnemyShields(enemy,.1);near(shield.charge,.85);
  shield.ionTime=2;shield.ionFactor=.5;g.updateEnemyShields(enemy,1);near(shield.charge,3.85);
  g.hurtEnemy(enemy,shield.hp,shield,null,false);assert.equal(g.enemyShieldStrength(enemy),0);g.updateEnemyShields(enemy,10);assert.equal(shield.charge,0);
  shield.hp=85;shield.ionTime=0;g.updateEnemyShields(enemy,1);near(shield.charge,6);
  const core=enemy.modules.find(m=>m.type==='core');g.hurtEnemy(enemy,core.hp,core);assert.equal(g.enemyShieldStrength(enemy),0);
});

test('projected shields block ion disruption, Tesla bounces, burning, and rail penetration',()=>{
  const g=game(),{b,enemy,shield}=setup(g),weapon=enemy.modules.find(m=>m.type==='weapon'),hp=enemy.hp;
  const hit={x:enemy.x-enemy.r-17,y:enemy.y,color:'#fff'};
  for(const shot of [{damage:7,ion:.5,ionDuration:3},{damage:5,ion:.8,ionDuration:2,systemPulse:80},{damage:6,chainSystems:3,chainRange:110,chainFalloff:.7},{damage:5,burn:5,burnDuration:4}]){
    assert.equal(g.weaponImpact({...hit,...shot},enemy,null,weapon),false);assert.equal(enemy.hp,hp);assert.ok(enemy.modules.every(m=>!m.ionTime));assert.ok(!enemy.burnTime);
  }
  assert.equal(shield.charge,77);const other=ship(g,'laser');other.x+=300;b.enemies.push(other);fire(g,enemy,30,{pierce:1});g.updateBattle(1.5,0);assert.equal(b.projectiles.length,0);assert.equal(other.hp,other.maxHp);assert.equal(shield.charge,47);
});

test('explosion damage reaches nearby shields and boarding sabotage bypasses projected strength',()=>{
  const g=game(),{b,enemy,shield}=setup(g),other=ship(g,'laser');other.x+=90;b.enemies.push(other);
  g.weaponImpact({x:enemy.x,y:enemy.y,damage:20,splash:40,color:'#fff'},enemy,null,enemy.modules[0]);assert.equal(shield.charge,80);assert.equal(g.enemyShieldStrength(other),89);assert.equal(enemy.hp,enemy.maxHp);assert.equal(other.hp,other.maxHp);
  const hp=shield.hp;g.hurtEnemy(enemy,10,shield,null,false);assert.equal(shield.hp,hp-10);assert.equal(shield.charge,80);g.hurtEnemy(enemy,shield.hp,shield,null,false);assert.equal(g.enemyShieldStrength(enemy),0);
});

test('enemy cannon, laser and missile shots use their real families, rates, ranges and ammunition',()=>{
  const g=game();for(const type of ['cannon','laser','missile']){
    const {b,enemy}=setup(g,type),room=enemy.modules.find(m=>m.type==='weapon'),stats=g.enemyWeaponStats(room);room.cooldown=0;g.fireEnemyWeapons(enemy,.1);
    assert.equal(b.projectiles.length,1,type);const shot=b.projectiles[0];assert.equal(shot.family,stats.family);near(Math.hypot(shot.vx,shot.vy),stats.speed);assert.equal(shot.damage,stats.damage);assert.equal(enemy.ammo,22-stats.ammo);assert.equal(room.cooldown,stats.reload);
    if(type==='missile'){assert.equal(shot.target,b.player);assert.ok(shot.guidance>0);assert.equal(shot.remaining,Infinity);}else assert.equal(shot.guidance,0);
    enemy.ammo=0;room.cooldown=0;g.fireEnemyWeapons(enemy,.1);assert.equal(b.projectiles.length,stats.ammo===0?2:1);
  }
});

test('missiles acquire from outside cannon range and home on the player rather than another enemy',()=>{
  const g=game(),{b,enemy}=setup(g,'missile'),room=enemy.modules.find(m=>m.type==='weapon');enemy.x=1800;room.cooldown=0;g.fireEnemyWeapons(enemy,.1);assert.equal(b.projectiles.length,1);
  const shot=b.projectiles[0];shot.launchRemaining=0;b.player.y+=200;g.updateBattle(.1,0);assert.equal(shot.target,b.player);assert.ok(shot.vy>0);assert.equal(shot.remaining,Infinity);
  const laser=ship(g,'laser');laser.x=1800;laser.modules.find(m=>m.type==='weapon').cooldown=0;b.enemies.push(laser);g.fireEnemyWeapons(laser,.1);assert.equal(b.projectiles.filter(s=>s.source===laser).length,0);
});

test('mixed batteries fire independently and ion or disabled weapon rooms affect only their battery',()=>{
  const g=game(),{b,enemy}=setup(g,'assault'),rooms=enemy.modules.filter(m=>m.type==='weapon');for(const room of rooms)room.cooldown=0;
  g.fireEnemyWeapons(enemy,.1);assert.equal(b.projectiles.length,2);assert.equal(new Set(b.projectiles.map(s=>s.family)).size,2);
  const laser=rooms[0],missile=rooms[1];laser.cooldown=10;missile.cooldown=10;laser.ionTime=3;laser.ionFactor=.5;g.fireEnemyWeapons(enemy,1);near(laser.cooldown,9.5);near(missile.cooldown,9);
  laser.hp=0;missile.cooldown=0;b.projectiles=[];g.fireEnemyWeapons(enemy,.1);assert.equal(b.projectiles.length,1);assert.equal(b.projectiles[0].weaponType,'missile');
});

test('enemy barrels turn toward their target before firing and their shots match the drawn aim',()=>{
  const g=game(),{b,enemy}=setup(g,'laser'),room=enemy.modules.find(m=>m.type==='weapon');b.player.y+=180;room.cooldown=0;
  g.fireEnemyWeapons(enemy,.01);assert.equal(b.projectiles.length,0);assert.ok(Math.abs(room.aimOffset)>0);
  for(let i=0;i<20&&!b.projectiles.length;i++)g.fireEnemyWeapons(enemy,.05);assert.equal(b.projectiles.length,1);
  const shot=b.projectiles[0];near(Math.sin(Math.atan2(shot.vy,shot.vx)),Math.sin(enemy.angle+room.aimOffset));
  g.draws.length=0;g.drawEnemy(enemy);assert.ok(g.draws.some(([fn,angle])=>fn==='rotate'&&angle===room.aimOffset));
});

test('enemy missiles bypass player shields but can still be evaded, intercepted by drones, or hit wrecks',()=>{
  const g=game(),{b,save,enemy}=setup(g,'missile'),room=enemy.modules.find(m=>m.type==='weapon');
  save.modules.push({id:2,type:'shield',x:2,y:0,rotation:0,level:1,hp:85});const state=g.shieldState(save.modules[1]),hull=save.modules.reduce((sum,part)=>sum+part.hp,0);room.cooldown=0;g.fireEnemyWeapons(enemy,0);room.cooldown=1000;
  for(let i=0;i<100&&b.projectiles.length;i++)g.updateBattle(.02,0);assert.equal(state.charge,100);near(save.modules.reduce((sum,part)=>sum+part.hp,0),hull-g.enemyWeaponStats(room).damage);
  state.charge=100;g.setEvasion(1);room.cooldown=0;g.fireEnemyWeapons(enemy,0);room.cooldown=1000;const evaded=b.projectiles[0];
  for(let i=0;i<100&&!evaded.evasionChecked;i++)g.updateBattle(.02,0);assert.equal(evaded.evaded,true);assert.equal(evaded.guidance,0);assert.equal(state.charge,100);
  g.setEvasion(0);b.projectiles=[];const bay={id:3,type:'droneControl',x:5,y:0,rotation:0,level:1,hp:85},assembly={id:4,type:'droneAssembly',x:5,y:3,rotation:0,level:1,hp:85};save.modules.push(bay,assembly);
  const drone={id:1,assembly:4,bay:3,type:'defense',hp:60,phase:'active',angle:0,cooldown:0};save.drones=[drone];b.drones=save.drones;
  room.cooldown=0;g.fireEnemyWeapons(enemy,0);const intercepted=b.projectiles[0];intercepted.x=b.player.x+150;intercepted.y=b.player.y;g.updateDrones(.01);assert.ok(!b.projectiles.includes(intercepted));
  b.drones=[];save.drones=[];assembly.hp=0;const rock={x:700,y:820,r:20,hp:100,maxHp:100};b.asteroids=[rock];room.cooldown=0;g.fireEnemyWeapons(enemy,0);room.cooldown=1000;
  for(let i=0;i<80&&b.projectiles.length;i++)g.updateBattle(.02,0);assert.ok(rock.hp<100);near(rock.hp,100-g.enemyWeaponStats(room).damage);assert.ok(b.effects.some(e=>e.r===38));
});

test('enemy art includes the shield console, numeric strength, and each actual weapon silhouette',()=>{
  const g=game(),{enemy,b}=setup(g,'assault');const first=g.enemySprite(enemy);assert.equal(g.enemySprite(enemy),first);g.draws.length=0;g.drawEnemy(enemy);
  assert.ok(g.draws.some(([fn,text])=>fn==='fillText'&&text==='SHIELD 100 / 100'));assert.ok(g.draws.some(([fn])=>fn==='arc'));assert.ok(g.draws.some(([fn,x,y])=>fn==='translate'&&x===77&&y===-66));
  const other=ship(g,'laser',false);assert.notEqual(g.enemySprite(other),first);
  b.enemies=[enemy];enemy.modules.find(m=>m.type==='shield').hp=0;g.draws.length=0;g.drawEnemy(enemy);assert.ok(g.draws.some(([fn,text])=>fn==='fillText'&&text==='SHIELD 0 / 100'));assert.ok(!g.draws.some(([fn])=>fn==='arc'));
});

test('a projectile stronger than an entire enemy shield applies the exact excess to a hull room',()=>{
  const g=game(),{b,enemy,shield}=setup(g),before=enemy.hp;shield.shieldDelay=100;
  fire(g,enemy,140);g.updateBattle(.5,0);
  assert.equal(shield.charge,0);near(enemy.hp,before-40);assert.equal(b.projectiles.length,0);
});
