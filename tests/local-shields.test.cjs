const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),draws=[];
  const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>{draws.push([k,...args]);}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({dataset:{},width:0,height:0,style:{removeProperty(){},setProperty(){}},classList:{add(){},remove(){}},
    getContext:()=>context,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},fire(type,event={}){this.listeners[type]?.(event);},querySelectorAll:()=>[],setAttribute(){},append(){},replaceChildren(){},parentElement:{clientWidth:600,clientHeight:500}});
  const math=Object.create(Math);
  const sandbox={Math:math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,damageRandomModule,shieldContacts,shieldContains,rayShield,hullPointWorld,shipRadius,enemyMissileImpact,STARTER_SHIPS,normalizeSystems,coreOutput,totalPower,upgradeCorePower,renderSystems,renderCrew,refreshCrewStatus,hurtCrew,selectCrew,stationConsole,drawStation,shieldGeometry,playerHullContact,shieldDirection,setShieldDirection,shieldCovers,shieldInterception,absorbShields,shieldState,drawShieldCoverage,drawShields,showStarterPicker,startNewGame,newSave,loadSave,persist,moduleCells,moduleStation,moduleGeometry,canPlace,canPlaceFootprint,moduleClearance,droneBayDoor,droneBayClear,
      updateDroneAssembly,updateDrones,updateCrew,recoverDrones,droneBayCapacity,droneCount,assemblyTime,setDroneDesign,normalizeDrones,updateBoarding,enemyLayout,fireProjectile,
      weaponGeometry,weaponWorld,weaponAim,turnWeapon,fireWeapon,updateBattle,drawExteriorHardware,renderOperations,renderInspector,openTrader,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},select(id){selectedModuleId=id;},setMode(value){mode=value;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}


const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const room=(id,type,x,y,extra={})=>({id,type,x,y,rotation:0,hp:type==='core'?170:85,level:1,...extra});
function setup(g,type='focusShield'){
  const save=g.newSave();save.modules=[room(1,'core',0,0),...Array.from({length:14},(_,i)=>room(i+2,'armor',i+2,0,{hp:115,footprint:{shape:[[0,0]],station:null}})),room(30,type,2,1,{shieldFacing:270})];save.crew=[];save.drones=[];g.setSave(save);g.setMode('combat');g.stubFlight();
  const b={world:{w:3000,h:2400},player:{x:1000,y:1000,angle:0,r:g.shipRadius(),thrusters:{}},enemies:[{x:2000,y:2000,r:30,hp:1000,name:'TARGET',angle:0,speed:0,path:[],pathTimer:100,cooldown:1000,phase:0}],projectiles:[],asteroids:[],effects:[],shields:{}};g.setBattle(b);return {save,b,shield:save.modules.at(-1)};
}
function fireFromAbove(g,x,y,damage=20){const b=g.getBattle(),point=g.hullPointWorld({x:x+.5,y:y+.5},b.player);g.fireProjectile('enemy',point.x,point.y-250,point,damage,1000,600);g.updateBattle(.4,0);}

test('focused fields originate at their room centroid and keep a fixed radius on large hulls',()=>{
  for(const type of ['focusShield']){
    const g=game(),{save,b,shield}=setup(g,type),field=g.shieldGeometry(shield,b.player),cells=g.moduleCells(shield),x=cells.reduce((sum,[x])=>sum+x+.5,0)/cells.length,y=cells.reduce((sum,[,y])=>sum+y+.5,0)/cells.length,point=g.hullPointWorld({x,y},b.player);
    near(field.x,point.x);near(field.y,point.y);assert.equal(field.radius,120);assert.notEqual(field.x,b.player.x);
    const local=g.shieldGeometry(shield,null,30);save.modules.push(room(80,'armor',100,0));near(g.shieldGeometry(shield,null,30).x,local.x);near(g.shieldGeometry(shield,b.player).radius,field.radius);
  }
});

test('an interior focused field protects nearby hull but leaves distant outer rooms exposed',()=>{
  for(const x of [4,14]){
    const g=game(),{save,shield}=setup(g),target=save.modules.find((part)=>part.x===x&&part.y===0),before=target.hp;g.shieldState(shield).delay=100;
    fireFromAbove(g,x,0);near(target.hp,x===4?before:before-20);near(g.shieldState(shield).charge,x===4?140:160);
  }
});

test('moving the shield room relocates protection instead of expanding it across the ship',()=>{
  const g=game(),{save,shield}=setup(g);shield.x=12;g.shieldState(shield).delay=100;
  const nearRoom=save.modules.find((part)=>part.x===14),farRoom=save.modules.find((part)=>part.x===4);fireFromAbove(g,14,0);near(nearRoom.hp,115);near(g.shieldState(shield).charge,140);
  fireFromAbove(g,4,0);near(farRoom.hp,95);near(g.shieldState(shield).charge,140);
});

test('a focused field protects only its local aimed sector and intercepts its side boundaries',()=>{
  const g=game(),{b,shield}=setup(g,'focusShield');shield.shieldFacing=270;const field=g.shieldGeometry(shield,b.player);
  assert.ok(g.shieldContains(field,{x:field.x,y:field.y-100}));assert.equal(g.shieldContains(field,{x:field.x,y:field.y+20}),false);assert.equal(g.shieldContains(field,{x:field.x,y:field.y-121}),false);
  const origin={x:field.x-150,y:field.y-50};assert.ok(Number.isFinite(g.rayShield(origin,1,0,field,300)));
  const contacts=g.shieldContacts(origin,1,0,b.player,300);assert.equal(contacts[0].module,shield);near(contacts[0].distance,150-50*Math.tan(105*Math.PI/360));
});

test('focused interception cannot skip an uncovered outer hull to protect it from behind',()=>{
  const g=game(),{save,b,shield}=setup(g,'focusShield');shield.shieldFacing=0;
  const point=g.hullPointWorld({x:2.5,y:.5},b.player),origin={x:point.x,y:point.y-250},distance=g.playerHullContact(origin,0,1,b.player);
  assert.equal(g.shieldInterception(origin,0,1,b.player,distance),null);const target=save.modules.find((part)=>part.x===2&&part.y===0);fireFromAbove(g,2,0);near(target.hp,95);near(g.shieldState(shield).charge,160);
});

test('overlapping fields absorb only along the shot path and pass exact excess into the actual room',()=>{
  const g=game(),{save,b}=setup(g);save.modules=[room(1,'core',0,0),room(2,'shield',2,0),room(3,'focusShield',2,2),room(4,'focusShield',11,6)];
  for(const shield of save.modules.slice(1))g.shieldState(shield).delay=100;
  const origin=g.hullPointWorld({x:8,y:1},b.player),target=g.hullPointWorld({x:0,y:1},b.player),before=save.modules[1].hp;
  g.fireProjectile('enemy',origin.x,origin.y,target,280,1000,800);g.updateBattle(.3,0);
  near(g.shieldState(save.modules[1]).charge,0);near(g.shieldState(save.modules[2]).charge,0);near(g.shieldState(save.modules[3]).charge,160);near(save.modules[1].hp,before-20);assert.equal(b.projectiles.length,0);
});

test('a collapsed field does not teleport excess damage ahead to a hull it has not reached',()=>{
  const g=game(),{save,b,shield}=setup(g);save.modules=[room(1,'core',0,0),shield];shield.x=2;shield.y=0;shield.shieldFacing=0;g.shieldState(shield).charge=5;g.shieldState(shield).delay=100;
  const field=g.shieldGeometry(shield,b.player),origin={x:field.x+field.radius+10,y:field.y};g.fireProjectile('enemy',origin.x,origin.y,{x:field.x,y:field.y},10,100,600);
  g.updateBattle(.2,0);near(g.shieldState(shield).charge,0);assert.equal(b.projectiles.length,1);near(b.projectiles[0].damage,5);near(shield.hp,85);near(b.projectiles[0].x,origin.x-20);
  for(let i=0;i<10&&b.projectiles.length;i++)g.updateBattle(.1,0);near(shield.hp,80);
});

test('ship translation and rotation move the room emitter and aim together',()=>{
  const g=game(),{b,shield}=setup(g,'focusShield');shield.shieldFacing=45;const before=g.shieldGeometry(shield,b.player),dx=before.x-b.player.x,dy=before.y-b.player.y;
  b.player.angle=Math.PI/2;b.player.x+=75;b.player.y-=20;const after=g.shieldGeometry(shield,b.player);near(after.x,b.player.x-dy);near(after.y,b.player.y+dx);near(after.angle,3*Math.PI/4);near(after.radius,120);
});

test('hangar and combat arcs use the same emitter and range instead of hull bounds',()=>{
  const g=game(),{b,shield}=setup(g,'focusShield'),arcs=[];shield.shieldFacing=180;
  const context=new Proxy({arc(...args){arcs.push(args);}},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});g.drawShieldCoverage(context,shield,24);const local=g.shieldGeometry(shield,null,24);
  near(arcs[0][0],local.x);near(arcs[0][1],local.y);near(arcs[0][2],96);g.draws.length=0;g.drawShields(b.player);const world=g.shieldGeometry(shield,b.player),draw=g.draws.find(([kind])=>kind==='arc');near(draw[1],world.x);near(draw[2],world.y);near(draw[3],120);
});

test('local shields keep their charge on re-aim, save and load, and stop projecting when disabled',()=>{
  const g=game(),{shield}=setup(g,'focusShield');g.shieldState(shield).charge=53;g.setShieldDirection(shield.id,225);near(g.shieldState(shield).charge,53);g.persist();const loaded=g.loadSave(),part=loaded.modules.find((m)=>m.id===shield.id);assert.equal(part.shieldFacing,225);near(g.shieldGeometry(part,null,30).radius,120);
  shield.hp=0;assert.equal(g.shieldInterception({x:800,y:1000},1,0,g.getBattle().player,1000),null);
});

test('blast damage near an uncovered outer room does not drain a distant shield',()=>{
  const g=game(),{save,b,shield}=setup(g),target=save.modules.find((part)=>part.x===14),point=g.hullPointWorld({x:14.5,y:0},b.player);
  g.enemyMissileImpact({x:point.x,y:point.y-10,damage:20,splash:38,color:'#fff'},false);near(target.hp,104);near(g.shieldState(shield).charge,160);
});


test('minefield shielding also protects only the local part selected for the impact',()=>{
  const g=game();setup(g);g.setBattle(null);g.setMode('hangar');g.math.random=()=>.1;assert.equal(g.damageRandomModule(14,true),null);g.math.random=()=>.7;const damaged=g.damageRandomModule(14,true);assert.ok(damaged);near(damaged.hp,101);
});

test('a missile crosses a local field and explodes at the hull rather than the shield boundary',()=>{
  const g=game(),{save,b,shield}=setup(g);save.modules=[room(1,'core',0,0),shield];shield.x=2;shield.y=0;shield.shieldFacing=0;g.shieldState(shield).delay=100;const field=g.shieldGeometry(shield,b.player),impact={x:field.x+field.radius,y:field.y},rock={x:impact.x+10,y:impact.y+25,r:8,hp:100,maxHp:100};b.asteroids=[rock];
  g.fireProjectile('enemy',field.x+field.radius+40,field.y,field,20,1000,600,{splash:38,family:'missile',color:'#fff'});g.updateBattle(.2,0);near(rock.hp,100);near(shield.hp,65);near(g.shieldState(shield).charge,160);assert.equal(b.projectiles.length,0);
  assert.ok(b.effects.some((effect)=>effect.r===38&&effect.x<field.x+field.radius-1));
});

test('a shield boundary coinciding with an outer hull face absorbs before the hull takes damage',()=>{
  const g=game(),{save,b,shield}=setup(g);shield.x=2;shield.y=0;shield.shieldFacing=0;shield.footprint={shape:[[0,0],[1,0],[0,1],[1,1]],station:[0,0]};const armor=room(80,'armor',6,1,{hp:115,footprint:{shape:[[0,0]],station:null}});save.modules=[room(1,'core',0,0),shield,armor];
  const origin=g.hullPointWorld({x:8,y:1},b.player),target=g.hullPointWorld({x:3,y:1},b.player);g.fireProjectile('enemy',origin.x,origin.y,target,20,1000,600);g.updateBattle(.2,0);near(armor.hp,115);near(g.shieldState(shield).charge,140);
});


test('wide shields protect near and distant hull rooms regardless of the projector location',()=>{
  for(const shieldX of [2,12])for(const x of [4,14]){
    const g=game(),{save,shield}=setup(g,'shield');shield.x=shieldX;g.shieldState(shield).delay=100;const target=save.modules.find((part)=>part.x===x&&part.y===0);fireFromAbove(g,x,0);near(target.hp,115);near(g.shieldState(shield).charge,80);
  }
});

test('wide fields stay centered on the hull and expand with it while focused range stays fixed',()=>{
  const g=game(),{save,b,shield}=setup(g,'shield'),before=g.shieldGeometry(shield,b.player);near(before.x,b.player.x);near(before.y,b.player.y);
  const preview=g.shieldGeometry(shield,null,30);shield.x=12;const moved=g.shieldGeometry(shield,null,30);near(moved.x,preview.x);near(moved.y,preview.y);near(moved.radius,preview.radius);
  save.modules.push(room(99,'armor',100,0));assert.ok(g.shieldGeometry(shield,b.player).radius>before.radius);
  const focused=room(100,'focusShield',2,1);near(g.shieldGeometry(focused,b.player).radius,120);
});

test('a wide array protects mine encounters across the whole hull',()=>{
  const g=game();setup(g,'shield');g.setBattle(null);g.setMode('hangar');g.math.random=()=>.7;assert.equal(g.damageRandomModule(14,true),null);
});


test('wide previews and combat both enclose the whole hull rather than marking the room as a local emitter',()=>{
  const g=game(),{b,shield}=setup(g,'shield'),arcs=[];const context=new Proxy({arc(...args){arcs.push(args);}},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  g.drawShieldCoverage(context,shield,24);const preview=g.shieldGeometry(shield,null,24),world=g.shieldGeometry(shield,b.player);near(arcs[0][0],preview.x);near(arcs[0][1],preview.y);near(arcs[0][2],world.radius*.8);g.draws.length=0;g.drawShields(b.player);const draw=g.draws.find(([kind])=>kind==='arc');near(draw[1],b.player.x);near(draw[2],b.player.y);near(draw[3],world.radius);
});
