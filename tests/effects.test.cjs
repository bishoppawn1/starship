const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function game(){
  const elements=new Map();
  const context=new Proxy({},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  const element=()=>({getContext:()=>context,style:{},classList:{add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],setAttribute(){}});
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,SHIELD_TYPES,newSave,traderStock,upgradeTraderStock,openTrader,buyTraderItem,renderCatalog,
      fireWeapon,weaponImpact,enemyRoomPoint,systemEfficiency,updateBattle,
      setSave(value){save=value;},setBattle(value){battle=value;},filter(value){marketFilter=value;renderCatalog();},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  const sandbox={console,Math,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},
    localStorage:{getItem:()=>null,setItem(){}},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element}};
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const system=(type,x,hp=100)=>({type,cells:[[x,0]],hp,maxHp:100});
const ship=(x,modules)=>({x,y:500,angle:0,r:70,modules,hp:modules.reduce((sum,room)=>sum+room.hp,0),maxHp:600,speed:0,path:[],pathTimer:100,cooldown:100,phase:0,name:'TEST'});
function combat(g){
  const save=g.newSave();save.modules=[{id:1,type:'core',x:0,y:0,rotation:0,hp:170,level:1}];save.crew=[];g.setSave(save);g.stubFlight();
  const target=ship(800,[system('core',0),system('weapon',2),system('engine',-2),system('armor',1)]);
  const b={player:{x:500,y:500,angle:0,r:35},world:{w:2000,h:2000},enemies:[target],asteroids:[],projectiles:[],ammo:100,shake:0};g.setBattle(b);
  return {b,target};
}
function shot(g,b,type,x,y){
  g.fireWeapon({id:5,type,x:3,y:3,rotation:0,hp:75,level:1},b.player,b.enemies[0]);
  const shot=b.projectiles.pop();Object.assign(shot,{x,y});return shot;
}

test('disruptor weakens multiple nearby systems more gently than a focused ion hit',()=>{
  const g=game(),{b,target}=combat(g);
  const nearby=ship(910,[system('core',0),system('engine',-2)]),distant=ship(1200,[system('core',0)]);b.enemies.push(nearby,distant);
  const pulse=shot(g,b,'disruptor',800,500);g.weaponImpact(pulse,target,null,target.modules[0]);
  assert.ok(g.MODULES.disruptor.arc>g.MODULES.ion.arc);assert.ok(g.MODULES.disruptor.damage<g.MODULES.ion.damage);
  for(const room of target.modules.filter((room)=>room.type!=='armor')){assert.equal(room.ionTime,2);near(g.systemEfficiency(room),.8);}
  assert.equal(target.modules[3].ionTime,undefined);assert.equal(target.slowTime,undefined);
  assert.equal(nearby.modules[1].ionTime,2);assert.equal(nearby.modules[0].ionTime,undefined);assert.equal(distant.modules[0].ionTime,undefined);
  assert.equal(target.modules[0].hp,95);assert.equal(nearby.modules[1].hp,100);
  g.updateBattle(.5,0);near(target.modules[1].ionTime,1.5);g.updateBattle(1.6,0);near(g.systemEfficiency(target.modules[1]),1);
  assert.ok(b.effects.every((effect)=>effect.pulse||effect.time<=.4));
});

test('Tesla bounces between systems on the struck ship with decreasing damage and no cross-ship hit',()=>{
  const g=game(),{b,target}=combat(g),other=ship(805,[system('core',0),system('engine',1)]);b.enemies.push(other);
  const first=target.modules[1],point=g.enemyRoomPoint(target,first),bolt=shot(g,b,'tesla',point.x,point.y);
  g.weaponImpact(bolt,target,null,first);
  near(first.hp,94);near(target.modules[0].hp,95.8);near(target.modules[2].hp,97.06);assert.equal(target.modules[3].hp,100);
  assert.ok(other.modules.every((room)=>room.hp===100));assert.equal(b.effects.length,3);
  const damage=target.modules.filter((room)=>room.type!=='armor').map((room)=>100-room.hp);near(damage.reduce((a,b)=>a+b,0),13.14);
});

test('Tesla hits at most four distinct live systems and skips armor, disabled, and distant systems',()=>{
  const g=game(),{b}=combat(g),target=ship(800,[system('core',0),...Array.from({length:5},(_,i)=>system('weapon',i+1))]);b.enemies=[target];
  let bolt=shot(g,b,'tesla',800,500);g.weaponImpact(bolt,target,null,target.modules[0]);
  assert.equal(target.modules.filter((room)=>room.hp<100).length,4);assert.equal(b.effects.length,4);
  near(target.modules[3].hp,97.942);assert.equal(target.modules[4].hp,100);
  const isolated=ship(800,[system('core',0),system('engine',1,0),system('armor',2),system('weapon',20)]);b.enemies=[isolated];b.effects=[];
  bolt=shot(g,b,'tesla',800,500);g.weaponImpact(bolt,isolated,null,isolated.modules[0]);
  assert.equal(b.effects.length,1);assert.equal(isolated.modules[1].hp,0);assert.equal(isolated.modules[2].hp,100);assert.equal(isolated.modules[3].hp,100);
});

test('Tesla system damage and arc endpoints follow a rotated ship',()=>{
  const g=game(),{b,target}=combat(g);target.angle=Math.PI/2;
  const first=target.modules[1],point=g.enemyRoomPoint(target,first);near(point.x,800);near(point.y,544);
  const bolt=shot(g,b,'tesla',point.x,point.y);g.weaponImpact(bolt,target,null,first);
  near(b.effects[0].to.x,800);near(b.effects[0].to.y,544);assert.equal(first.hp,94);
});

test('saved traders keep their shield selection and sold offers',()=>{
  const g=game();
  for(const stockVersion of [2,3]){
    const node={stockVersion,stock:[{type:'engine',qty:0,price:29},{type:'shield',qty:0,price:43}]};g.upgradeTraderStock(node);
    assert.equal(node.stock.length,2);
    const before=JSON.stringify(node);g.upgradeTraderStock(node);assert.equal(JSON.stringify(node),before);assert.equal(node.stock[1].qty,0);assert.equal(node.stock[1].price,43);
  }
});

test('shield cards appear first, filter correctly, and can be bought from a saved trader',()=>{
  const g=game(),save=g.newSave();save.metal=250;g.setSave(save);
  const node={type:'trader',stockVersion:3,stock:[{type:'weapon',qty:1,price:45},...g.SHIELD_TYPES.map(type=>({type,qty:1,price:g.MODULES[type].cost}))]};g.openTrader(node);
  let catalog=g.elements.get('catalog').innerHTML;assert.ok(catalog.indexOf('SHIELD')<catalog.indexOf('PULSE CANNON'));
  g.filter('shields');catalog=g.elements.get('catalog').innerHTML;assert.ok(!catalog.includes('PULSE CANNON'));
  for(const type of g.SHIELD_TYPES){
    const item=node.stock.find((offer)=>offer.type===type),metal=save.metal;assert.ok(catalog.includes(g.MODULES[type].name.toUpperCase()));
    assert.equal(g.buyTraderItem(type),true);assert.equal(save.inventory[type],1);assert.equal(save.metal,metal-item.price);assert.equal(item.qty,0);
  }
});
