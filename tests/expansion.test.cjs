const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),draws=[];
  const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>{if(k==='drawImage')draws.push(args);}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({dataset:{},width:0,height:0,style:{removeProperty(){},setProperty(){}},classList:{add(){},remove(){}},
    getContext:()=>context,addEventListener(){},querySelectorAll:()=>[],setAttribute(){},append(){},parentElement:{clientWidth:600,clientHeight:500}});
  const math=Object.create(Math);
  const sandbox={Math:math,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,SHIELD_TYPES,TASKS,newSave,loadSave,persist,canPlace,moduleCells,moduleStation,exteriorCells,weaponHasEscape,
      createGrid,panBuild,centerBuildView,shipArtFrame,shipBounds,drawArena,shipSprite,gridButtons,buildView,startBattle,shipRadius,
      traderStock,openTrader,buyTraderItem,buyRecruit,upgradeTraderStock,crewGoal,renderCrew,crewAtStation,
      normalizeSystems,reactorCapacity,powerUsed,systemMaxPower,usablePower,systemPower,setSystemPower,upgradeReactor,engineThrusters,evasionChance,
      shieldStats,shieldState,absorbShields,shieldInterception,updateShields,fireProjectile,updateBattle,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},
      setMode(value){mode=value;},stubFlight(){navigatePlayer=()=>{};}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const core=(x,y)=>({id:1,type:'core',x,y,rotation:0,hp:170,level:1});
function battle(g,save=g.newSave()){
  g.setSave(save);g.stubFlight();
  const b={player:{x:500,y:500,angle:0,r:35,thrusters:{},vx:0,vy:0,omega:0},world:{w:2000,h:2000},asteroids:[],stars:[],projectiles:[],ammo:100,maxAmmo:100,shake:0,
    enemies:[{x:1500,y:1500,hp:1000,maxHp:1000,r:20,speed:0,path:[],pathTimer:100,cooldown:100,phase:0,angle:0}]};
  g.setBattle(b);return b;
}

test('construction works far beyond every old grid edge while retaining exhaust clearance',()=>{
  const g=game();
  for(const x of [-5000,5000])for(const y of [-5000,5000]){
    const save=g.newSave();save.modules=[core(x,y)];g.setSave(save);
    assert.equal(g.canPlace('armor',x+2,y,0),true);assert.equal(g.canPlace('armor',x-2,y,0),true);
    assert.equal(g.canPlace('engine',x-1,y,0),true);
    save.modules.push({id:2,type:'engine',x:x-1,y,rotation:0,hp:80,level:1});
    assert.equal(g.canPlace('armor',x-2,y,0),false);
  }
});

test('unbounded exterior checks still detect enclosed cavities and hulls still shadow distant guns',()=>{
  const g=game(),walls=new Set();
  for(let y=-1000;y<=-996;y++)for(let x=-1000;x<=-996;x++)if(x===-1000||x===-996||y===-1000||y===-996)walls.add(`${x},${y}`);
  assert.equal(g.exteriorCells(walls).has('-998,-998'),false);assert.equal(g.exteriorCells(walls).has('-1001,-998'),true);
  walls.delete('-1000,-998');assert.equal(g.exteriorCells(walls).has('-998,-998'),true);
  const gun={type:'railgun',x:0,y:0,rotation:0,level:1,hp:90},cells=g.moduleCells(gun);
  for(let y=-30;y<=30;y++)cells.push([40,y]);assert.equal(g.weaponHasEscape(gun,cells),false);
});

test('panning reuses a bounded set of interactive cells with unrestricted world coordinates',()=>{
  const g=game();g.setSave(g.newSave());g.createGrid();assert.equal(g.gridButtons.length,120);
  g.panBuild(-100,200);assert.equal(+g.gridButtons[0].dataset.x,-100);assert.equal(+g.gridButtons[0].dataset.y,200);
  assert.equal(+g.gridButtons[119].dataset.x,-89);assert.equal(+g.gridButtons[119].dataset.y,209);
  g.centerBuildView();assert.ok(g.buildView.x<5&&g.buildView.y<4);
});

test('artwork follows translated hulls and scales its backing texture without limiting construction',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const original=g.shipArtFrame();
  for(const module of save.modules){module.x-=10000;module.y+=20000;}
  const shifted=g.shipArtFrame();assert.equal(shifted.x,original.x-10000);assert.equal(shifted.y,original.y+20000);assert.equal(shifted.w,original.w);
  battle(g,save).enemies=[];g.drawArena(0);const call=g.draws.find((args)=>args[0]===g.shipSprite);assert.ok(call);assert.equal(call[1],0);assert.equal(call[2],0);
  save.modules=[core(0,0)];for(let i=0;i<100;i++)save.modules.push({id:i+2,type:'cargo',x:2+i*3,y:0,rotation:0,hp:65,level:1});
  const frame=g.shipArtFrame();assert.ok(frame.w>300);assert.ok(frame.w*24*frame.scale<=8192+1e-7);
  g.startBattle('pirate');assert.ok(g.getBattle().world.w>=g.shipRadius()*6+400);
});

test('weapon draws can repeat, aggregate quantities, omit other types, and never restock on revisit',()=>{
  const g=game();g.math.random=()=>0;const stock=g.traderStock(),weapons=stock.filter((offer)=>g.MODULES[offer.type].range);
  assert.equal(weapons.length,1);assert.equal(weapons[0].qty,5);
  const save=g.newSave();save.metal=1000;g.setSave(save);const node={type:'trader',stockVersion:4,stock};g.openTrader(node);
  assert.equal(g.buyTraderItem(weapons[0].type),true);assert.equal(weapons[0].qty,4);
  const before=JSON.stringify(node);g.openTrader(node);assert.equal(JSON.stringify(node),before);
});

test('recruited crew have unique persistent identities, can take jobs, and remain sold on return',()=>{
  const g=game(),save=g.newSave();save.metal=1000;g.setSave(save);const node=save.map.nodes.find((node)=>node.type==='trader');g.openTrader(node);
  const recruit=node.recruits[0],metal=save.metal;assert.equal(g.buyRecruit(recruit.id),true);assert.equal(g.buyRecruit(recruit.id),false);
  assert.equal(save.crew.length,4);assert.equal(save.metal,metal-recruit.price);const person=save.crew[3];assert.equal(person.name,recruit.name);
  person.task='engine';assert.equal(g.crewGoal(person,{}).module.type,'engine');g.renderCrew();assert.ok(g.elements.get('crewList').innerHTML.includes(person.name));g.persist();
  const loaded=g.loadSave();assert.equal(loaded.crew.length,4);assert.equal(loaded.crew[3].task,'engine');assert.equal(loaded.crew[3].color,recruit.color);
  assert.equal(loaded.map.nodes.find((n)=>n.id===node.id).recruits[0].hired,true);
  g.setSave(loaded);g.openTrader(loaded.map.nodes.find((n)=>n.id===node.id));assert.equal(g.buyRecruit(recruit.id),false);
  assert.equal(new Set(loaded.crew.map((person)=>person.id)).size,4);
});

test('reactor allocation prevents overspending, upgrades add power, and damage caps usable bars',()=>{
  const g=game(),save=g.newSave();save.metal=500;g.setSave(save);g.setMode('trade');assert.equal(g.reactorCapacity(),8);assert.equal(g.powerUsed(),6);
  const shield={id:10,type:'shield',x:7,y:7,rotation:0,level:1,hp:85,power:0};save.modules.push(shield);
  assert.equal(g.setSystemPower(10,2),true);const engine=save.modules.find((m)=>m.type==='engine');
  const extra={...engine,id:11,power:0};save.modules.push(extra);assert.equal(g.setSystemPower(11,2),false);assert.equal(extra.power,0);
  assert.equal(g.upgradeReactor(),true);assert.equal(save.metal,460);assert.equal(g.reactorCapacity(),10);assert.equal(g.setSystemPower(11,2),true);
  extra.hp=40;assert.equal(g.usablePower(extra),1);extra.hp=0;assert.equal(g.usablePower(extra),0);extra.hp=80;assert.equal(g.usablePower(extra),2);
  const old=g.newSave();delete old.reactorLevel;for(const module of old.modules)delete module.power;
  for(let i=0;i<5;i++)old.modules.push({id:100+i,type:'weapon',x:10+i,y:0,rotation:0,hp:75,level:1});g.normalizeSystems(old,true);
  assert.ok(old.modules.every((module)=>module.power===g.systemMaxPower(module)));assert.ok(g.reactorCapacity(old)>=11);
});

test('crew engine bonuses apply at the console and powered engines require a pilot for evasion',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const engine=save.modules.find((m)=>m.type==='engine'),command=save.modules[0];
  const base=g.engineThrusters().find((entry)=>entry.module===engine).force;assert.equal(g.evasionChance(),0);
  Object.assign(save.crew[0],{task:'pilot',...g.moduleStation(command)});assert.ok(g.evasionChance()>0);
  Object.assign(save.crew[1],{task:'engine',...g.moduleStation(engine)});near(g.engineThrusters().find((entry)=>entry.module===engine).force,base*1.25);
  save.crew[1].x+=5;near(g.engineThrusters().find((entry)=>entry.module===engine).force,base);
  for(const part of save.modules.filter((m)=>m.type==='engine'))part.power=0;assert.equal(g.evasionChance(),0);assert.equal(g.engineThrusters().length,0);
});

test('two power bars provide one rechargeable hit layer and shield operators accelerate recharge',()=>{
  const g=game(),save=g.newSave();save.modules=[core(0,0),{id:2,type:'shield',x:2,y:0,rotation:0,level:2,hp:110,power:4}];save.reactorLevel=2;const b=battle(g,save),shield=save.modules[1];
  assert.equal(g.shieldStats(shield).layers,2);assert.equal(g.shieldState(shield).charge,2);
  assert.equal(g.absorbShields(100,0),0);assert.equal(g.absorbShields(1,0),0);assert.equal(g.absorbShields(100,0),100);
  g.updateShields(3.4);assert.ok(g.shieldState(shield).charge<1);assert.equal(g.shieldInterception({x:700,y:500},-1,0,b.player,300),null);
  g.updateShields(.1);near(g.shieldState(shield).charge,1);assert.ok(g.shieldInterception({x:700,y:500},-1,0,b.player,300));
  const recharge=g.shieldStats(shield).recharge;Object.assign(save.crew[0],{task:'shield',...g.moduleStation(shield)});assert.ok(g.shieldStats(shield).recharge<recharge);
  g.setSystemPower(shield.id,1);g.updateShields(.1);assert.equal(g.shieldState(shield).charge,0);assert.equal(g.shieldStats(shield).layers,0);
});

test('pilot evasion rolls once per approaching shot and an evaded shot passes both shields and hull',()=>{
  const g=game(),save=g.newSave();Object.assign(save.crew[0],{task:'pilot',...g.moduleStation(save.modules[0])});const b=battle(g,save);g.math.random=()=>0;
  const hp=save.modules[0].hp;g.fireProjectile('enemy',600,500,b.player,30,300,500);const shot=b.projectiles[0];
  g.updateBattle(.5,0);assert.equal(shot.evaded,true);assert.equal(save.modules[0].hp,hp);assert.ok(b.projectiles.includes(shot));assert.ok(b.effects.some((effect)=>effect.text==='MISS'));
  g.math.random=()=>1;g.updateBattle(.1,0);assert.equal(shot.evaded,true);assert.equal(save.modules[0].hp,hp);
});
