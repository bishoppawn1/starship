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
    globalThis.game={MODULES,newSave,loadSave,persist,moduleStation,crewWorkPlan,crewGoal,updateCrew,crewAtStation,crewStatus,crewRoutes,
      setSave(value){save=value;for(const id of Object.keys(crewRoutes))delete crewRoutes[id];},setBattle(value){battle=value;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}

const room=(id,type,x,y,hp)=>({id,type,x,y,rotation:0,hp,level:1});
function setup(g,task,types=['weapon','weapon']){
  const save=g.newSave();save.modules=[room(1,'core',0,0,170),...types.map((type,i)=>room(i+2,type,2+i*3,0,g.MODULES[type].hp))];
  // A connected corridor joins all stations, with both crew closest to the left.
  save.modules.push({...room(20,'armor',2,1,115),footprint:{shape:[[0,0],[1,0],[2,0]],station:null}},{...room(21,'armor',5,1,115),footprint:{shape:[[0,0],[1,0],[2,0]],station:null}},{...room(22,'armor',8,1,115),footprint:{shape:[[0,0],[1,0],[2,0]],station:null}});
  save.crew=[{id:'one',task,x:.5,y:.5},{id:'two',task,x:1.5,y:.5}];g.setSave(save);return save;
}
function settle(g){for(let i=0;i<180;i++)g.updateCrew(.05);}

test('weapons, engines, shields and repairs reserve separate rooms before either crew arrives',()=>{
  for(const [task,types] of [['gun',['weapon','weapon']],['engine',['smallEngine','heavyEngine']],['shield',['shield','focusShield']],['repair',['weapon','weapon']]]){
    const g=game(),save=setup(g,task,types);if(task==='repair')for(const module of save.modules.slice(1,3))module.hp-=20;
    g.updateCrew(0);assert.notEqual(save.crew[0].workModuleId,save.crew[1].workModuleId,task);
    const choices=save.crew.map((person)=>person.workModuleId);settle(g);
    assert.deepEqual(save.crew.map((person)=>person.workModuleId),choices);
    for(const person of save.crew){const module=save.modules.find((module)=>module.id===person.workModuleId);assert.equal(g.crewAtStation(task,module),1);assert.equal(g.crewStatus(person),'AT STATION');}
  }
});

test('a newly assigned crew member cannot displace an operator or a reservation already walking there',()=>{
  const g=game(),save=setup(g,'idle');save.crew[1].task='gun';g.updateCrew(.1);const reserved=save.crew[1].workModuleId;
  save.crew[0].task='gun';g.updateCrew(.1);assert.equal(save.crew[1].workModuleId,reserved);assert.notEqual(save.crew[0].workModuleId,reserved);
  settle(g);assert.equal(save.crew[1].workModuleId,reserved);
  // Moving closer to the other station must not cause assignments to alternate.
  Object.assign(save.crew[0],g.moduleStation(save.modules.find((module)=>module.id===reserved)));
  g.updateCrew(.01);assert.equal(save.crew[1].workModuleId,reserved);
});

test('surplus operators wait and do not stack bonuses, then take a released station',()=>{
  const g=game(),save=setup(g,'gun',['weapon']);save.crew.push({id:'three',task:'gun',x:.5,y:1.5});
  settle(g);const worker=save.crew.find((person)=>person.workModuleId!==null),waiting=save.crew.filter((person)=>person.workModuleId===null);
  assert.equal(waiting.length,2);assert.ok(waiting.every((person)=>g.crewStatus(person)==='WAITING'));
  const gun=save.modules[1];assert.equal(g.crewAtStation('gun',gun),1);
  worker.task='idle';g.updateCrew(0);assert.ok(waiting.some((person)=>person.workModuleId===gun.id));
  settle(g);assert.equal(g.crewAtStation('gun',gun),1);
});

test('disabled or removed stations release claims and returning stations fill from waiting crew',()=>{
  const g=game(),save=setup(g,'engine',['smallEngine','heavyEngine']);settle(g);
  const drive=save.modules[1],owner=save.crew.find((person)=>person.workModuleId===drive.id);drive.hp=0;g.updateCrew(0);assert.equal(owner.workModuleId,null);
  drive.hp=20;g.updateCrew(0);assert.equal(owner.workModuleId,drive.id);
  save.modules.splice(1,1);g.updateCrew(0);assert.equal(owner.workModuleId,null);
});

test('repair crews keep their own work until complete and choose another unclaimed damaged room',()=>{
  const g=game(),save=setup(g,'repair');save.modules[1].hp=10;save.modules[2].hp=40;save.modules[0].hp=160;
  g.updateCrew(0);assert.equal(save.crew[0].workModuleId,2);assert.equal(save.crew[1].workModuleId,3);
  save.modules[2].hp=1;g.updateCrew(0);assert.equal(save.crew[0].workModuleId,2);
  save.modules[1].hp=g.MODULES.weapon.hp;g.updateCrew(0);assert.equal(save.crew[0].workModuleId,1);assert.equal(save.crew[1].workModuleId,3);
});

test('loaders keep separate heavy-weapon reservations during shared pickup and delivery',()=>{
  const g=game(),save=setup(g,'load',['railgun','railgun']);save.ammunition.heavy=16;g.updateCrew(0);
  assert.notEqual(save.crew[0].workModuleId,save.crew[1].workModuleId);
  const destinations=save.crew.map((person)=>person.workModuleId);
  for(let i=0;i<12;i++)g.updateCrew(.05);
  for(const person of save.crew){assert.equal(person.carrying.type,'heavy');assert.equal(g.crewGoal(person,g.crewRoutes[person.id]).module.id,person.workModuleId);}
  settle(g);assert.ok(save.modules.filter((module)=>module.type==='railgun').every((module)=>module.magazine>0));
  assert.equal(save.ammunition.heavy+save.modules.filter((module)=>module.type==='railgun').reduce((n,m)=>n+(m.magazine||0),0)+save.crew.reduce((n,p)=>n+(p.carrying?.amount||0),0),16);
});

test('loaders without a matching ammo weapon wait instead of creating ammo',()=>{
  const g=game(),save=setup(g,'load',['ion','laser']);const before=JSON.stringify(save.ammunition);settle(g);
  assert.equal(JSON.stringify(save.ammunition),before);assert.ok(save.crew.every((person)=>person.workModuleId===null&&g.crewStatus(person)==='WAITING'));
  save.modules[1].type='railgun';g.updateCrew(0);assert.equal(save.crew.filter((person)=>person.workModuleId!==null).length,1);
  settle(g);assert.ok(save.modules[1].magazine>0);
});

test('a single pilot console has one operator and persistent reservations survive save and reload',()=>{
  const g=game(),save=setup(g,'pilot');settle(g);assert.equal(g.crewAtStation('pilot',save.modules[0]),1);assert.equal(save.crew.filter((person)=>person.workModuleId===null).length,1);
  save.crew.forEach((person)=>person.task='gun');g.updateCrew(.1);const choices=save.crew.map((person)=>person.workModuleId);g.persist();
  const loaded=g.loadSave();g.setSave(loaded);g.updateCrew(0);assert.deepEqual(Array.from(loaded.crew.slice(0,2),(person)=>person.workModuleId),choices);
});

test('crew skip unreachable free stations rather than reserving them indefinitely',()=>{
  const g=game(),save=setup(g,'gun');save.modules[2].x=100;save.modules[2].y=100;g.updateCrew(0);
  assert.equal(save.crew.filter((person)=>person.workModuleId!==null).length,1);assert.ok(save.crew.every((person)=>person.workModuleId!==3));
});


test('crew finish walking to a console when a saved position is already inside its cell',()=>{
  const g=game(),save=setup(g,'gun',['ion']);save.crew=[{id:'one',task:'gun',x:2.1,y:.1}];settle(g);
  assert.equal(g.crewAtStation('gun',save.modules[1]),1);
});
