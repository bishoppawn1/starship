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
  const sandbox={Math:math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,SHIELD_TYPES,TASKS,newSave,loadSave,persist,canPlace,moduleCells,moduleStation,exteriorCells,weaponHasEscape,
      createGrid,panBuild,zoomBuild,centerBuildView,shipArtFrame,shipBounds,drawArena,shipSprite,gridButtons,buildView,startBattle,shipRadius,
      traderStock,openTrader,buyTraderItem,buyRecruit,upgradeTraderStock,onGridClick,crewGoal,renderCrew,crewAtStation,
      normalizeSystems,commandCore,coreOutput,generatorOutput,auxiliaryOutput,totalPower,powerUsed,systemDemand,sharedPower,systemSupply,systemPower,upgradeCorePower,engineThrusters,evasionChance,weaponWorld,renderSystems,
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
  const centerX=g.buildView.x+g.buildView.cols/2,centerY=g.buildView.y+g.buildView.rows/2;
  g.zoomBuild(-1);assert.equal(g.buildView.cols,15);assert.equal(g.buildView.rows,13);assert.equal(g.gridButtons.length,195);
  assert.ok(Math.abs(g.buildView.x+g.buildView.cols/2-centerX)<=.5);
  assert.ok(Math.abs(g.buildView.y+g.buildView.rows/2-centerY)<=.5);
  assert.equal(+g.gridButtons.at(-1).dataset.x,g.buildView.x+14);
  g.zoomBuild(1);assert.equal(g.gridButtons.length,120);
  g.centerBuildView();assert.ok(g.buildView.x<5&&g.buildView.y<4);
});

test('artwork follows translated hulls and scales its backing texture without limiting construction',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const original=g.shipArtFrame();
  for(const module of save.modules){module.x-=10000;module.y+=20000;}
  const shifted=g.shipArtFrame();assert.equal(shifted.x,original.x-10000);assert.equal(shifted.y,original.y+20000);assert.equal(shifted.w,original.w);
  battle(g,save).enemies=[];g.drawArena(0);const call=g.draws.find((args)=>args[0]===g.shipSprite);assert.ok(call);assert.equal(call[1],0);assert.equal(call[2],0);
  save.modules=[core(0,0)];for(let i=0;i<100;i++)save.modules.push({id:i+2,type:'armor',footprint:{shape:[[0,0],[1,0],[2,0]],station:null},x:2+i*3,y:0,rotation:0,hp:65,level:1});
  const frame=g.shipArtFrame();assert.ok(frame.w>300);assert.ok(frame.w*24*frame.scale<=8192+1e-7);
  g.startBattle('pirate');assert.ok(g.getBattle().world.w>=g.shipRadius()*6+400);
});

test('trader draws can repeat, aggregate quantities, omit other types, and never restock on revisit',()=>{
  const g=game();g.math.random=()=>0;const stock=g.traderStock();
  assert.equal(stock.length,1);assert.equal(stock[0].qty,4);
  const save=g.newSave();save.metal=1000;g.setSave(save);const node={type:'trader',stockVersion:4,stock};g.openTrader(node);
  assert.equal(g.buyTraderItem(stock[0].type),true);assert.equal(stock[0].qty,3);
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

test('the command core shares power evenly and upgrades improve every underpowered system',()=>{
  const g=game(),save=g.newSave();save.modules=save.modules.slice(0,5);save.nextId=6;save.metal=500;g.setSave(save);g.setMode('trade');assert.equal(g.coreOutput(),8);assert.equal(g.powerUsed(),8);
  const shield={id:10,type:'shield',x:7,y:7,rotation:0,level:1,hp:85};save.modules.push(shield);
  for(const module of save.modules.filter((m)=>g.systemDemand(m))){near(g.systemSupply(module),1.6);near(g.systemPower(module),.8);}
  const engine=save.modules.find((m)=>m.type==='engine'),extra={...engine,id:11};save.modules.push(extra);
  near(g.systemSupply(engine),8/6);near(g.systemSupply(shield),8/6);
  assert.equal(g.upgradeCorePower(),true);assert.equal(save.metal,460);assert.equal(g.coreOutput(),10);assert.equal(g.commandCore().powerLevel,2);
  for(const module of save.modules.filter((m)=>g.systemDemand(m)))near(g.systemSupply(module),10/6);
  extra.hp=1;near(g.systemSupply(extra),10/6);near(g.systemSupply(engine),10/6);
  extra.hp=0;assert.equal(g.systemSupply(extra),0);near(g.systemSupply(engine),2);
  save.modules[0].hp=1;assert.equal(g.coreOutput(),10);save.modules[0].hp=0;assert.equal(g.coreOutput(),0);assert.equal(g.systemPower(engine),0);
});

test('core power can be upgraded on the sector map but remains locked during combat',()=>{
  const g=game(),save=g.newSave();g.setSave(save);g.setMode('map');
  g.renderSystems();assert.doesNotMatch(g.elements.get('systemsPanel').innerHTML,/<button id="upgradeCorePower"[^>]*disabled/);
  assert.equal(g.upgradeCorePower(),true);assert.equal(save.metal,50);assert.equal(g.coreOutput(),10);
  assert.equal(g.loadSave().modules.find((module)=>module.type==='core').powerLevel,2);
  g.setMode('combat');g.renderSystems();assert.match(g.elements.get('systemsPanel').innerHTML,/<button id="upgradeCorePower"[^>]*disabled/);
  assert.equal(g.upgradeCorePower(),false);assert.equal(save.metal,50);
});

test('old reactor upgrades migrate into the core and manual allocations no longer restrict systems',()=>{
  const g=game(),old=g.newSave();delete old.modules[0].powerLevel;old.reactorLevel=3;
  for(const module of old.modules)module.power=0;g.setSave(old);g.persist();const loaded=g.loadSave();g.setSave(loaded);
  assert.equal(g.commandCore().powerLevel,3);assert.equal(g.coreOutput(),12);assert.equal(loaded.reactorLevel,undefined);
  assert.ok(loaded.modules.every((module)=>module.power===undefined));
  for(const module of loaded.modules.filter((module)=>g.systemDemand(module)))assert.equal(g.systemPower(module),1);
});

test('crew engine bonuses apply at the console and powered engines require a pilot for evasion',()=>{
  const g=game(),save=g.newSave();g.setSave(save);const engine=save.modules.find((m)=>m.type==='engine'),command=save.modules[0];
  const base=g.engineThrusters().find((entry)=>entry.module===engine).force;assert.equal(g.evasionChance(),0);
  Object.assign(save.crew[0],{task:'pilot',...g.moduleStation(command)});assert.ok(g.evasionChance()>0);
  Object.assign(save.crew[1],{task:'engine',...g.moduleStation(engine)});near(g.engineThrusters().find((entry)=>entry.module===engine).force,base*1.25);
  save.crew[1].x+=5;near(g.engineThrusters().find((entry)=>entry.module===engine).force,base);
  for(const part of save.modules.filter((m)=>g.MODULES[m.type].thrust))part.hp=0;assert.equal(g.evasionChance(),0);assert.equal(g.engineThrusters().length,0);
});

test('shields absorb exact damage from a strength pool and pass excess damage through',()=>{
  const g=game(),save=g.newSave();save.modules=[core(0,0),{id:2,type:'shield',x:2,y:0,rotation:0,level:2,hp:110}];const b=battle(g,save),shield=save.modules[1];
  assert.equal(g.shieldStats(shield).capacity,135);assert.equal(g.shieldState(shield).charge,135);
  assert.equal(g.absorbShields(100,0),0);assert.equal(g.shieldState(shield).charge,35);
  assert.equal(g.absorbShields(50,0),15);assert.equal(g.shieldState(shield).charge,0);
  assert.equal(g.shieldInterception({x:700,y:500},-1,0,b.player,300),null);
  g.updateShields(1.7);assert.equal(g.shieldState(shield).charge,0);g.updateShields(.1);near(g.shieldState(shield).charge,1);
  g.shieldState(shield).charge=.25;assert.ok(g.shieldInterception({x:700,y:500},-1,0,b.player,300));near(g.absorbShields(1,0),.75);
  g.updateShields(100);assert.equal(g.shieldState(shield).charge,135);
  const recharge=g.shieldStats(shield).recharge;Object.assign(save.crew[0],{task:'shield',...g.moduleStation(shield)});assert.ok(g.shieldStats(shield).recharge>recharge);
  for(let i=0;i<4;i++)save.modules.push({id:10+i,type:'engine',x:4+i,y:0,rotation:0,level:1,hp:80});
  near(g.systemPower(shield),.8);near(g.shieldStats(shield).recharge,recharge*1.4*.8);assert.equal(g.shieldStats(shield).capacity,135);
  shield.hp=1;near(g.systemPower(shield),.8);shield.hp=0;g.updateShields(.1);assert.equal(g.shieldState(shield).charge,0);
});

test('lower shared power slows actual weapon reload and the panel has no manual allocation controls',()=>{
  const g=game(),save=g.newSave(),gun={id:2,type:'weapon',x:3,y:3,rotation:0,hp:75,level:1,cooldown:0};
  save.modules=[core(0,0),gun];save.crew=[];
  for(let i=0;i<4;i++)save.modules.push({id:10+i,type:'engine',x:5+i,y:0,rotation:0,hp:80,level:1});
  const b=battle(g,save),mount=g.weaponWorld(gun,b.player);b.enemies[0].x=mount.x+100;b.enemies[0].y=mount.y;
  g.updateBattle(.001,0);near(gun.cooldown,g.MODULES.weapon.reload/.8);
  g.renderSystems();const panel=g.elements.get('systemsPanel').innerHTML;
  assert.ok(panel.includes('COMMAND CORE'));assert.ok(panel.includes('80% POWER'));assert.ok(!panel.includes('data-power='));assert.ok(!panel.includes('power-bars'));
});

test('pilot evasion rolls once per approaching shot and an evaded shot passes both shields and hull',()=>{
  const g=game(),save=g.newSave();Object.assign(save.crew[0],{task:'pilot',...g.moduleStation(save.modules[0])});const b=battle(g,save);g.math.random=()=>0;
  const hp=save.modules[0].hp;g.fireProjectile('enemy',600,500,b.player,30,300,500);const shot=b.projectiles[0];
  g.updateBattle(.5,0);assert.equal(shot.evaded,true);assert.equal(save.modules[0].hp,hp);assert.ok(b.projectiles.includes(shot));assert.ok(b.effects.some((effect)=>effect.text==='MISS'));
  g.math.random=()=>1;g.updateBattle(.1,0);assert.equal(shot.evaded,true);assert.equal(save.modules[0].hp,hp);
});


test('combat sends only damage beyond the remaining shield strength to the hull',()=>{
  const g=game(),save=g.newSave();save.modules=[core(0,0),{id:2,type:'shield',x:2,y:0,rotation:0,level:1,hp:85}];save.crew=[];
  const b=battle(g,save),shield=save.modules[1],state=g.shieldState(shield);state.charge=12;state.delay=5;
  const before=save.modules.reduce((sum,module)=>sum+module.hp,0);
  g.fireProjectile('enemy',700,500,b.player,20,400,400);g.updateBattle(.5,0);
  near(save.modules.reduce((sum,module)=>sum+module.hp,0),before-8);assert.equal(state.charge,0);assert.equal(b.projectiles.length,0);
});


test('purchased generators contribute only after installation and survive save/load without restocking',()=>{
  const g=game(),save=g.newSave();save.modules=save.modules.slice(0,5);save.nextId=6;save.metal=500;g.setSave(save);
  const node=save.map.nodes.find((n)=>n.type==='trader');node.stock=[{type:'generator',qty:2,price:35}];g.openTrader(node);
  const offer=node.stock.find((item)=>item.type==='generator'),qty=offer.qty,metal=save.metal;
  assert.ok(offer);assert.equal(g.buyTraderItem('generator'),true);
  assert.equal(save.inventory.generator,1);assert.equal(offer.qty,qty-1);assert.equal(save.metal,metal-offer.price);assert.equal(g.totalPower(),8);
  let spot;
  for(let y=-10;y<15&&!spot;y++)for(let x=-10;x<15;x++)if(g.canPlace('generator',x,y,0)){spot={x,y};break;}
  assert.ok(spot);g.onGridClick(spot.x,spot.y);
  const generator=save.modules.find((module)=>module.type==='generator');assert.ok(generator);
  assert.equal(g.moduleCells(generator).length,2);assert.equal(save.inventory.generator,0);assert.equal(g.totalPower(),10);
  assert.equal(g.systemDemand(generator),0);assert.equal(g.powerUsed(),8);g.renderSystems();
  const panel=g.elements.get('systemsPanel').innerHTML;assert.ok(panel.includes('SHIP POWER · 10'));assert.ok(panel.includes('COMMAND CORE 8 + GENERATORS 2'));
  g.persist();const loaded=g.loadSave();g.setSave(loaded);assert.equal(g.totalPower(),10);
  const market=loaded.map.nodes.find((n)=>n.id===node.id),before=JSON.stringify(market);g.openTrader(market);
  assert.equal(JSON.stringify(market),before);assert.equal(market.stock.find((item)=>item.type==='generator').qty,qty-1);
  assert.equal(loaded.modules.find((module)=>module.id===generator.id).type,'generator');
});

test('stacked generators raise equal system performance and lose output only when disabled',()=>{
  const g=game(),save=g.newSave();save.modules=save.modules.slice(0,5);save.nextId=6;g.setSave(save);
  save.modules.push({id:10,type:'shield',x:7,y:7,rotation:0,level:1,hp:85},{id:11,type:'engine',x:7,y:10,rotation:0,level:1,hp:80});
  const consumers=save.modules.filter((module)=>g.systemDemand(module));for(const module of consumers)near(g.systemPower(module),8/12);
  const generator={id:12,type:'generator',x:9,y:7,rotation:0,level:1,hp:65};save.modules.push(generator);
  for(const module of consumers)near(g.systemPower(module),10/12);
  const second={...generator,id:13,x:9,y:8};save.modules.push(second);assert.equal(g.auxiliaryOutput(),4);
  for(const module of consumers)near(g.systemPower(module),1);
  generator.hp=1;assert.equal(g.generatorOutput(generator),2);assert.equal(g.totalPower(),12);
  generator.hp=0;assert.equal(g.generatorOutput(generator),0);for(const module of consumers)near(g.systemPower(module),10/12);
  generator.hp=65;generator.level=3;assert.equal(g.generatorOutput(generator),4);assert.equal(g.totalPower(),14);
  assert.equal(g.powerUsed(),12);assert.equal(g.coreOutput(),8);assert.equal(g.systemSupply(generator),0);
  g.persist();g.setSave(g.loadSave());assert.equal(g.totalPower(),14);
});

test('older traders keep sold-out stock without gaining guaranteed generator offers',()=>{
  const g=game(),node={type:'trader',stockVersion:4,stock:[{type:'weapon',qty:0,price:51},{type:'shield',qty:0,price:53}]};
  g.upgradeTraderStock(node);assert.ok(node.stockVersion>=9);
  assert.deepEqual(node.stock[0],{type:'weapon',qty:0,price:51});assert.equal(node.stock[1].qty,0);
  assert.equal(node.stock.length,2);
  const before=JSON.stringify(node);g.upgradeTraderStock(node);assert.equal(JSON.stringify(node),before);
});

test('a projectile stronger than full overlapping shields carries only the excess through to player hull',()=>{
  const g=game(),save=g.newSave();save.modules=[core(0,0),{id:2,type:'shield',x:2,y:0,rotation:0,level:1,hp:85},{id:3,type:'focusShield',x:2,y:2,rotation:0,level:1,hp:75}];save.crew=[];
  const b=battle(g,save);for(const module of save.modules.slice(1))g.shieldState(module).delay=100;
  const before=save.modules.reduce((sum,module)=>sum+module.hp,0);
  g.fireProjectile('enemy',700,500,b.player,280,400,400);g.updateBattle(.5,0);
  near(save.modules.reduce((sum,module)=>sum+module.hp,0),before-20);
  for(const module of save.modules.slice(1))assert.equal(g.shieldState(module).charge,0);
  assert.equal(b.projectiles.length,0);
});
