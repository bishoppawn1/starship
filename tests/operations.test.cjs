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
    globalThis.game={MODULES,newSave,loadSave,persist,normalizeCrew,crewAlive,crewHome,crewStatus,moduleStation,moduleCells,crewWorkPlan,crewAtStation,updateCrew,
      selectCrew,orderCrewMove,orderCrewWorld,hullPointWorld,selectCrewAtWorld,resumeCrewJob,hurtCrew,damagePlayer,hurtEnemy,enemyLayout,enemyAlive,
      boardCrew,tryBoardCrew,boardingReady,recallCrew,recoverBoarders,orderBoardedRoom,updateBoarding,deployDrone,updateDrones,buyDroneParts,finishBattle,returnToMainMenu,
      fireProjectile,updateBattle,openTrader,systemPower,renderCrew,renderOperations,renderCrewOrders,crewRoutes,
      setSave(value){save=value;for(const id of Object.keys(crewRoutes))delete crewRoutes[id];},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},
      setMode(value){mode=value;},setScreen(value){screen=value;},stubFlight(){navigatePlayer=()=>{};}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function setup(g){
  const save=g.newSave();save.metal=500;save.modules=[
    {id:1,type:'core',x:0,y:0,rotation:0,hp:170,level:1},
    {id:2,type:'teleporter',x:2,y:0,rotation:0,hp:80,level:1},
    {id:3,type:'droneControl',x:2,y:2,rotation:0,hp:75,level:1}];
  save.crew.forEach((person)=>Object.assign(person,{x:.5,y:.5,task:'idle',hp:100}));g.setSave(save);g.setMode('combat');g.stubFlight();
  const layout=g.enemyLayout(true),enemy={x:800,y:500,angle:Math.PI,r:90,modules:layout.modules,hp:415,maxHp:415,name:'RAIDER',crew:[],speed:0,path:[],pathTimer:100,cooldown:100,phase:0};
  const battle={kind:'pirate',player:{x:500,y:500,r:80,angle:0,vx:0,vy:0,omega:0,thrusters:{}},world:{w:3000,h:2200},enemies:[enemy],asteroids:[],projectiles:[],effects:[],drones:[],teleportCooldown:0,ammo:20,maxAmmo:20,shake:0,stars:[]};g.setBattle(battle);return {save,battle,enemy,person:save.crew[0]};
}
function settle(g){for(let i=0;i<200;i++)g.updateCrew(.05);}

test('old saves gain living crew and drone parts without reviving dead crew on reload',()=>{
  const g=game(),save=g.newSave();delete save.droneParts;delete save.crew[0].hp;save.crew[1].hp=0;save.crew[1].aboard={enemy:0};g.setSave(save);g.persist();
  const loaded=g.loadSave();assert.equal(loaded.crew[0].hp,100);assert.equal(loaded.crew[1].hp,0);assert.equal(loaded.crew[1].aboard,undefined);assert.equal(loaded.droneParts,5);
});

test('crew damage is localized to the struck room and natural healing respects its delay',()=>{
  const g=game(),{save,battle,person}=setup(g);save.crew[1].x=2.5;save.crew[1].y=.5;
  g.damagePlayer(10,g.hullPointWorld(person,battle.player));near(person.hp,85);near(save.crew[1].hp,100);
  g.updateCrew(4);near(person.hp,85);g.updateCrew(1);near(person.hp,85);g.updateCrew(1);near(person.hp,88);
  g.updateCrew(100);near(person.hp,100);
});

test('dead and away crew cannot operate systems or regenerate',()=>{
  const g=game(),{save,person}=setup(g);person.task='pilot';Object.assign(person,g.moduleStation(save.modules[0]));
  g.updateCrew(0);assert.equal(g.crewAtStation('pilot',save.modules[0]),1);g.hurtCrew(person,100);settle(g);assert.equal(person.hp,0);assert.equal(g.crewAtStation('pilot',save.modules[0]),0);assert.equal(g.loadSave().crew[0].hp,0);
  const away=save.crew[1];away.hp=60;away.aboard={enemy:0,room:0,x:0,y:0,path:[]};g.updateCrew(20);near(away.hp,60);
});

test('manual crew orders walk to valid cells, pause jobs and can resume them',()=>{
  const g=game(),{save,person}=setup(g);person.task='pilot';g.selectCrew(person.id);
  assert.equal(g.orderCrewMove(3,1),true);assert.equal(g.crewWorkPlan().has(person),false);assert.equal(g.orderCrewMove(100,100),false);settle(g);
  near(person.x,3.5);near(person.y,1.5);assert.equal(g.crewStatus(person),'MANUAL');assert.equal(g.crewAtStation('pilot',save.modules[0]),0);
  g.resumeCrewJob();settle(g);assert.equal(person.manualGoal,undefined);assert.equal(g.crewAtStation('pilot',save.modules[0]),1);
});

test('crew selection and right-click destinations use rotated ship coordinates',()=>{
  const g=game(),{battle,person}=setup(g);battle.player.angle=1.1;
  assert.equal(g.selectCrewAtWorld(g.hullPointWorld(person,battle.player)),true);
  assert.equal(g.orderCrewWorld(g.hullPointWorld({x:3.5,y:1.5},battle.player)),true);settle(g);near(person.x,3.5);near(person.y,1.5);
});

test('boarding walks to a pad, requires range and power, and recall obeys its recharge',()=>{
  const g=game(),{save,battle,enemy,person}=setup(g);enemy.x=1200;
  assert.equal(g.boardCrew(person.id,0),true);settle(g);assert.equal(person.aboard,undefined);assert.ok(person.boardOrder);
  enemy.x=800;g.updateCrew(.1);assert.equal(person.aboard.enemy,0);assert.equal(person.boardOrder,undefined);assert.equal(battle.teleportCooldown,12);
  assert.equal(g.recallCrew(person.id),false);g.updateBoarding(12);assert.equal(g.recallCrew(person.id),true);assert.equal(person.aboard,undefined);
  battle.teleportCooldown=0;save.modules[1].hp=0;assert.equal(g.boardCrew(person.id,0),false);
});

test('boarders can walk between enemy rooms, fight guards, capture a ship and return home',()=>{
  const g=game(),{battle,enemy,person}=setup(g);Object.assign(person,g.moduleStation(g.getSave().modules[1]));g.boardCrew(person.id,0);assert.ok(person.aboard);
  const room=enemy.modules[0];enemy.crew=[{hp:10,room:0,x:room.cells[0][0],y:room.cells[0][1]}];
  assert.equal(g.orderBoardedRoom(person,0),true);for(let i=0;i<400&&g.enemyAlive(enemy);i++)g.updateBoarding(.05);
  assert.equal(enemy.captured,true);assert.equal(g.enemyAlive(enemy),false);assert.equal(person.aboard,undefined);assert.ok(person.hp>0&&person.hp<100);
});

test('sabotage does not injure the saboteur, while friendly weapon fire does',()=>{
  const g=game(),{enemy,person}=setup(g);Object.assign(person,g.moduleStation(g.getSave().modules[1]));g.boardCrew(person.id,0);
  const room=enemy.modules[person.aboard.room],hp=room.hp;g.updateBoarding(1);assert.ok(room.hp<hp);near(person.hp,100);
  g.hurtEnemy(enemy,10,room);near(person.hp,85);
});

test('surviving boarders are recovered at encounter end and on main-menu exit',()=>{
  const g=game(),{save,person}=setup(g);Object.assign(person,g.moduleStation(save.modules[1]));g.boardCrew(person.id,0);g.finishBattle(true);assert.equal(person.aboard,undefined);assert.equal(save.wins,1);
  const next=setup(g);Object.assign(next.person,g.moduleStation(next.save.modules[1]));g.boardCrew(next.person.id,0);g.setScreen('playing');g.returnToMainMenu();assert.equal(next.person.aboard,undefined);assert.equal(g.getBattle(),null);
});

test('drone deployment consumes parts, enforces bay capacity and does not refund destroyed drones',()=>{
  const g=game(),{save,battle}=setup(g);assert.equal(g.deployDrone('combat'),true);assert.equal(g.deployDrone('defense'),true);assert.equal(g.deployDrone('repair'),false);assert.equal(save.droneParts,3);
  battle.drones[0].hp=0;assert.equal(g.deployDrone('repair'),true);assert.equal(save.droneParts,2);
  save.modules[2].level=2;assert.equal(g.deployDrone('boarding'),true);assert.equal(save.droneParts,1);
  save.modules[2].hp=0;assert.equal(g.deployDrone('combat'),false);assert.equal(save.droneParts,1);
});

test('combat drones fire real damage and defense drones intercept incoming fire',()=>{
  const g=game(),{battle,enemy}=setup(g);g.deployDrone('combat');battle.drones[0].angle=Math.PI-1.1;g.updateDrones(1);assert.equal(battle.projectiles.length,0);battle.drones[0].angle=-1.1;g.updateDrones(1);assert.ok(battle.projectiles.some((shot)=>shot.owner==='player'&&shot.drone));
  const before=enemy.hp;for(let i=0;i<20;i++)g.updateBattle(.05,0);assert.ok(enemy.hp<before);
  g.deployDrone('defense');const defense=battle.drones[1];defense.cooldown=0;
  g.fireProjectile('enemy',battle.player.x+150,battle.player.y,battle.player,20,100,400);const incoming=battle.projectiles.at(-1);g.updateDrones(.01);assert.ok(!battle.projectiles.includes(incoming));
});

test('disabled bays pause drones, repairs restore rooms, and boarding drones obey power',()=>{
  const g=game(),{save,battle,enemy}=setup(g);g.deployDrone('repair');const drone=battle.drones[0];save.modules[0].hp=100;
  for(let i=0;i<100;i++)g.updateDrones(.1);assert.ok(save.modules[0].hp>100);
  save.modules[2].hp=0;const before=save.modules[0].hp;g.updateDrones(10);near(save.modules[0].hp,before);
  save.modules[2].hp=75;g.deployDrone('boarding');const weapon=enemy.modules.find((room)=>room.type==='weapon'),hp=weapon.hp;g.updateBoarding(1);assert.ok(weapon.hp<hp);
  save.modules[2].hp=0;const stopped=weapon.hp;g.updateBoarding(1);near(weapon.hp,stopped);
});

test('drone parts are limited persistent trader stock and do not refill on revisit',()=>{
  const g=game(),save=g.newSave();save.metal=100;g.setSave(save);const node=save.map.nodes.find((node)=>node.type==='trader');g.openTrader(node);
  assert.equal(g.buyDroneParts(),true);assert.equal(g.buyDroneParts(),true);assert.equal(g.buyDroneParts(),false);assert.equal(save.droneParts,11);assert.equal(save.metal,70);
  g.persist();const loaded=g.loadSave();g.setSave(loaded);g.openTrader(loaded.map.nodes.find((item)=>item.id===node.id));assert.equal(g.buyDroneParts(),false);assert.equal(loaded.droneParts,11);
});


test('a two-person boarding team departs together after both reach the pad',()=>{
  const g=game(),{save,battle,person}=setup(g);assert.equal(g.boardCrew(person.id,0,2),true);
  for(let i=0;i<200&&!person.aboard;i++)g.updateCrew(.05);
  const team=save.crew.filter((member)=>member.aboard);assert.equal(team.length,2);assert.equal(battle.teleportCooldown,12);
});


test('shielded projectile hits do not injure protected crew',()=>{
  const g=game(),{save,battle}=setup(g);save.modules.push({id:4,type:'shield',x:4,y:0,rotation:0,hp:85,level:1});
  g.fireProjectile('enemy',battle.player.x+200,battle.player.y,battle.player,30,400,400);g.updateBattle(.5,0);
  assert.ok(save.crew.every((person)=>person.hp===100));assert.equal(battle.projectiles.length,0);
});
