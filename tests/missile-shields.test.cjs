const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map();
  const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const el=()=>({style:{},classList:{add(){},remove(){}},getContext:()=>context,addEventListener(){},querySelectorAll:()=>[],setAttribute(){}});
  const math=Object.create(Math);math.random=()=>.99;
  const sandbox={Math:math,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,newSave,enemyLayout,enemyShieldStrength,enemyShieldInterception,weaponImpact,enemyMissileImpact,
      fireProjectile,updateBattle,shieldContacts,shieldState,hullPointWorld,weaponBehavior,renderInspector,
      setSave(value){save=value;},setBattle(value){battle=value;},select(id){selectedModuleId=id;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const room=(g,id,type,x,y,extra={})=>({id,type,x,y,rotation:0,hp:g.MODULES[type].hp,level:1,...extra});
function enemy(g,x=1000){
  const layout=g.enemyLayout(true,1,'cannon');
  for(const part of layout.modules)if(part.type==='weapon')part.cooldown=1000;
  const hp=layout.modules.reduce((sum,part)=>sum+part.hp,0);
  return {...layout,x,y:800,angle:Math.PI,hp,maxHp:hp,name:'TEST RAIDER',ammo:22,speed:0,path:[],pathTimer:1000,phase:0,cooldown:1000,crew:[]};
}
function setup(g,type='missile'){
  const save=g.newSave();save.modules=[room(g,1,'core',0,0),room(g,2,type,2,0,{magazine:g.MODULES[type].magazine,cooldown:0})];save.crew=[];save.drones=[];
  g.setSave(save);g.stubFlight();
  const target=enemy(g),b={duel:true,kind:'pirate',shake:0,world:{w:2600,h:1800},player:{x:500,y:800,angle:0,r:70},asteroids:[],enemies:[target],projectiles:[],drones:[],effects:[],shields:{},targetEnemy:0,targetRoom:null};
  g.setBattle(b);return {save,b,target,gun:save.modules[1],shield:target.modules.find((part)=>part.type==='shield')};
}

for(const type of ['missile','swarm','torpedo'])test(`${type} fires its actual rounds through enemy shields into hull rooms`,()=>{
  const g=game(),{b,target,gun,shield}=setup(g,type),def=g.MODULES[type],before=target.hp;
  for(let frame=0;frame<120&&!b.projectiles.length;frame++)g.updateBattle(.05,0);
  assert.ok(b.projectiles.length);assert.equal(gun.magazine,def.magazine-def.ammo);gun.cooldown=1000;
  assert.ok(b.projectiles.every((shot)=>shot.family==='missile'));
  for(let frame=0;frame<400&&b.projectiles.length;frame++)g.updateBattle(.05,0);
  assert.equal(b.projectiles.length,0);near(target.hp,before-def.damage*(def.salvo||1));
  near(shield.charge,100);assert.equal(shield.shieldDelay,0);assert.ok(!shield.shieldFlash);
});

test('missiles cross an enemy shield boundary without exploding before reaching the real hull',()=>{
  const g=game(),{b,target,gun,shield}=setup(g);gun.hp=0;
  const start=target.x-target.r-30;
  g.fireProjectile('player',start,target.y,target,20,100,500,{family:'missile',splash:38});
  g.updateBattle(.2,0);assert.equal(b.projectiles.length,1);near(b.projectiles[0].x,start+20);
  near(target.hp,target.maxHp);near(shield.charge,100);assert.equal(b.effects.length,0);
});

test('missile hull hits injure crew and splash bypasses nearby enemy shields without draining either field',()=>{
  const g=game(),{b,target,shield}=setup(g),other=enemy(g,target.x+90);b.enemies.push(other);
  target.crew=[{room:0,hp:70}];
  g.weaponImpact({family:'missile',x:target.x,y:target.y,damage:20,splash:40,color:'#fff'},target,null,target.modules[0]);
  near(target.hp,target.maxHp-20);near(target.crew[0].hp,40);near(other.hp,other.maxHp-11);
  near(shield.charge,100);near(g.enemyShieldStrength(other),100);assert.equal(shield.shieldDelay,0);
});

test('enemy missile rounds bypass stacked wide and focused player fields and injure the struck room crew',()=>{
  for(const type of ['missile','swarm','torpedo']){
    const g=game(),{save,b,gun}=setup(g,type);gun.hp=0;
    save.modules.push(room(g,3,'shield',2,2),room(g,4,'focusShield',0,2,{shieldFacing:270}));
    save.crew=[{id:'pilot',task:'idle',x:.5,y:.5,hp:100}];
    for(const part of save.modules.slice(2)){g.shieldState(part).charge=73;g.shieldState(part).delay=100;}
    const target=g.hullPointWorld({x:.5,y:.5},b.player),origin={x:target.x,y:target.y-300},def=g.MODULES[type];
    assert.equal(g.shieldContacts({...origin,family:'missile'},0,1,b.player,400).length,0);
    assert.ok(g.shieldContacts(origin,0,1,b.player,400).length>=2,'the same path must intersect both fields for a normal round');
    g.fireProjectile('enemy',origin.x,origin.y,target,def.damage,1000,600,{family:def.family,splash:def.splash});
    g.updateBattle(.4,0);near(save.modules[0].hp,170-def.damage);near(save.crew[0].hp,100-def.damage*1.5);
    for(const part of save.modules.slice(2)){near(g.shieldState(part).charge,73);assert.equal(g.shieldState(part).flash,0);}
    assert.equal(b.projectiles.length,0);
  }
});

test('missile splash also bypasses player shields, while non-missile explosives remain shielded',()=>{
  for(const family of ['missile','cannon']){
    const g=game(),{save,b,gun}=setup(g);gun.hp=0;save.modules.push(room(g,3,'shield',2,2));
    const state=g.shieldState(save.modules[2]);state.delay=100;
    const point=g.hullPointWorld({x:.5,y:0},b.player);
    g.enemyMissileImpact({x:point.x,y:point.y-10,family,damage:20,splash:38,color:'#fff'});
    near(save.modules[0].hp,family==='missile'?159:170);near(state.charge,family==='missile'?100:89);
  }
});

test('ordinary projectiles still hit shields and missile shop and inspector text explains the bypass',()=>{
  const g=game(),{target,shield}=setup(g);
  g.weaponImpact({family:'cannon',x:target.x,y:target.y,damage:20},target,null,target.modules[0]);
  near(target.hp,target.maxHp);near(shield.charge,80);
  for(const type of ['missile','swarm','torpedo']){
    assert.match(g.weaponBehavior(type),/Bypasses shields/);assert.match(g.MODULES[type].description,/bypass/i);
    const {gun}=setup(g,type);g.select(gun.id);g.renderInspector();assert.match(g.elements.get('moduleInspector').innerHTML,/Bypasses shields/);
  }
  assert.doesNotMatch(g.weaponBehavior('railgun'),/Bypasses shields/);
});
