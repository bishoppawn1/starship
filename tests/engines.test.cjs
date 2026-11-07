const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),draws=[];
  const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>{draws.push([k,o.fillStyle,...args]);}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({dataset:{},width:0,height:0,style:{removeProperty(){},setProperty(){}},classList:{add(){},remove(){}},
    getContext:()=>context,addEventListener(){},querySelectorAll:()=>[],setAttribute(){},append(){},parentElement:{clientWidth:600,clientHeight:500}});
  const math=Object.create(Math);
  const sandbox={Math:math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,ENGINE_TYPES,newSave,loadSave,persist,canPlace,moduleCells,moduleClearance,moduleStation,moduleGeometry,
      engineThrusters,systemSupply,systemPower,evasionChance,crewGoal,traderStock,upgradeTraderStock,openTrader,buyTraderItem,onGridClick,
      renderCatalog,renderInspector,renderMap,drawExteriorHardware,navigatePlayer,shipRadius,shipBounds,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},
      setMode(value){mode=value;},select(id){selectedModuleId=id;},setFilter(value){marketFilter=value;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const core=(x=0,y=0)=>({id:1,type:'core',x,y,rotation:0,hp:170,level:1});
function engine(g,type,rotation=0){return {id:2,type,x:-Math.max(...g.moduleGeometry({type,rotation}).cells.map(([x])=>x))-1,y:0,rotation,hp:g.MODULES[type].hp,level:1};}

test('engine sizes fit, rotate, and reserve only their actual nozzle lanes',()=>{
  const g=game();
  assert.equal(g.ENGINE_TYPES.length,3);
  assert.deepEqual(Array.from(g.ENGINE_TYPES,(type)=>g.MODULES[type].shape.length).sort((a,b)=>a-b),[1,3,6]);
  for(const type of g.ENGINE_TYPES)for(let rotation=0;rotation<4;rotation++){
    const module={id:2,type,x:-100,y:200,rotation,hp:g.MODULES[type].hp,level:1},cells=g.moduleCells(module),station=g.moduleStation(module);
    const occupied=new Set(cells.map(([x,y])=>`${x},${y}`));
    assert.ok(occupied.has(`${Math.floor(station.x)},${Math.floor(station.y)}`));
    const clearance=g.moduleClearance(module);assert.equal(clearance.length,type==='heavyEngine'?4:2);
    assert.ok(clearance.every(([x,y])=>!occupied.has(`${x},${y}`)));
    // Put one core beside the front of the drive; exhaust must remain outside.
    const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][rotation];
    const forward=cells.reduce((best,cell)=>(cell[0]*dx+cell[1]*dy>best[0]*dx+best[1]*dy?cell:best));
    const command=core(forward[0]+(dx<0?-2:dx),forward[1]+(dy<0?-2:dy));
    const save=g.newSave();save.modules=[command];g.setSave(save);
    assert.equal(g.canPlace(type,module.x,module.y,rotation),true,`${type} rotation ${rotation}`);
    save.modules.push(module);
    for(const [x,y] of clearance)assert.equal(g.canPlace('smallEngine',x,y,0),false);
    save.modules=[command,core(clearance[0][0],clearance[0][1])];
    assert.equal(g.canPlace(type,module.x,module.y,rotation),false);
  }
});

test('standard engines allow rooms beside the plume but keep its center lane and outer mount clear',()=>{
  const g=game(),save=g.newSave();save.modules=[core(1,1)];g.setSave(save);
  assert.equal(g.canPlace('engine',0,0,0),true);
  const drive={id:2,type:'engine',x:0,y:0,rotation:0,hp:80,level:1};save.modules.push(drive);
  assert.equal(g.canPlace('smallEngine',-1,0,0),true);
  assert.equal(g.canPlace('smallEngine',-1,2,0),true);
  assert.equal(g.canPlace('smallEngine',-1,1,0),false);
  assert.equal(g.canPlace('smallEngine',-2,1,0),false);
  assert.equal(g.canPlace('shield',-2,-1,0),true);
  save.modules.push({id:3,type:'smallEngine',x:-1,y:0,rotation:0,hp:50,level:1});
  assert.equal(g.moduleClearance(drive).length,2);
});

test('each drive produces its own thrust, with shared power, upgrades and crew bonuses',()=>{
  const g=game();
  for(const type of g.ENGINE_TYPES){
    const save=g.newSave(),drive=engine(g,type);save.modules=[core(),drive];save.crew=[];g.setSave(save);
    near(g.engineThrusters()[0].force,g.MODULES[type].thrust);
    drive.level=3;near(g.engineThrusters()[0].force,g.MODULES[type].thrust*1.4);
    save.crew=[{id:'engineer',task:'engine',...g.moduleStation(drive)}];
    near(g.engineThrusters()[0].force,g.MODULES[type].thrust*1.4*1.25);
    for(let i=0;i<4;i++)save.modules.push({...drive,id:3+i,x:10+i*5});
    near(g.systemPower(drive),.8);near(g.engineThrusters()[0].force,g.MODULES[type].thrust*1.4*1.25*.8);
    drive.hp=0;assert.ok(!g.engineThrusters().some((entry)=>entry.module===drive));
  }
});

test('compact and heavy drives support crew operation, piloting evasion and sector travel',()=>{
  const g=game();
  for(const type of ['smallEngine','heavyEngine']){
    const save=g.newSave(),drive=engine(g,type);save.modules=[core(),drive];g.setSave(save);
    Object.assign(save.crew[0],{task:'pilot',...g.moduleStation(save.modules[0])});
    Object.assign(save.crew[1],{task:'engine',...g.moduleStation(drive)});
    assert.equal(g.crewGoal(save.crew[1],{}).module,drive);assert.ok(g.evasionChance()>.1);
    g.renderMap();assert.ok(!g.elements.get('mapHint').textContent.includes('OFFLINE'));
    drive.hp=0;assert.equal(g.evasionChance(),0);g.renderMap();assert.ok(g.elements.get('mapHint').textContent.includes('OFFLINE'));
  }
});

test('markets preserve offered engine sizes without restocking on return',()=>{
  const g=game(),save=g.newSave();save.metal=1000;g.setSave(save);
  const node={type:'trader',stockVersion:4,stock:[{type:'engine',qty:0,price:31},{type:'smallEngine',qty:1,price:22},{type:'heavyEngine',qty:1,price:70}]};g.openTrader(node);
  for(const type of g.ENGINE_TYPES)assert.ok(node.stock.some((offer)=>offer.type===type));
  assert.equal(node.stock[0].qty,0);assert.equal(node.stock[0].price,31);
  for(const type of ['smallEngine','heavyEngine']){
    assert.equal(g.buyTraderItem(type),true);assert.equal(save.inventory[type],1);
    const position=type==='smallEngine'?[-1,0]:[-2,0];save.modules=[core()];
    g.onGridClick(...position);assert.equal(save.modules.at(-1).type,type);assert.equal(save.inventory[type],0);
  }
  const before=JSON.stringify(node.stock);g.openTrader(node);assert.equal(JSON.stringify(node.stock),before);
  g.persist();const loaded=g.loadSave();assert.equal(loaded.modules.at(-1).type,'heavyEngine');assert.equal(g.moduleCells(loaded.modules.at(-1)).length,6);
});

test('engine cards and inspector show footprints, base thrust and actual force',()=>{
  const g=game(),save=g.newSave();g.setSave(save);g.openTrader({type:'trader',stock:g.ENGINE_TYPES.map(type=>({type,qty:1,price:g.MODULES[type].cost}))});g.setFilter('systems');g.renderCatalog();
  const cards=g.elements.get('catalog').innerHTML;
  for(const type of g.ENGINE_TYPES){assert.ok(cards.includes(g.MODULES[type].name.toUpperCase()));assert.ok(cards.includes(`${g.MODULES[type].thrust} BASE THRUST`));}
  const drive=engine(g,'heavyEngine');save.modules=[core(),drive];save.crew=[];g.select(drive.id);g.renderInspector();
  const inspector=g.elements.get('moduleInspector').innerHTML;assert.ok(inspector.includes('620 BASE'));assert.ok(inspector.includes('6 CELLS'));assert.ok(inspector.includes('620</span> FORCE'));
});

test('engine artwork has one, two or three active exhaust nozzles',()=>{
  const g=game();
  for(const [type,count] of [['smallEngine',1],['engine',2],['heavyEngine',3]]){
    g.draws.length=0;const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>g.draws.push([k,o.fillStyle,...args])),set:(o,k,v)=>(o[k]=v,true)});
    g.drawExteriorHardware(context,engine(g,type),1);
    assert.equal(g.draws.filter(([op,color])=>op==='fillRect'&&color==='#3ad8ed').length,count);
  }
});

test('larger drives accelerate an equal-mass ship more when its engines are saturated',()=>{
  const speeds=[];
  for(const type of ['smallEngine','engine','heavyEngine']){
    const g=game(),save=g.newSave();save.crew=[];save.modules=[core(1,0)];
    // A heavy hull requires more force than even the largest single drive.
    for(let i=0;i<80;i++)save.modules.push({id:10+i,type:'armor',footprint:{shape:[[0,0],[1,0],[2,0]],station:null},x:2+i*3,y:0,rotation:0,hp:65,level:1});
    const drive={id:2,type,x:0,y:0,rotation:0,hp:g.MODULES[type].hp,level:1};save.modules.push(drive);
    const cells=g.MODULES[type].shape.length;
    for(let i=cells;i<6;i++)save.modules.push({id:100+i,type:'smallEngine',x:10+i,y:10,rotation:0,hp:0,level:1});
    g.setSave(save);const p={x:10000,y:10000,vx:0,vy:0,angle:0,omega:0,targetAngle:0,r:g.shipRadius(),dest:{x:20000,y:10000},path:[],thrusters:{}};
    g.setBattle({player:p,world:{w:100000,h:100000},asteroids:[]});g.navigatePlayer(.02);speeds.push(p.vx);
    assert.ok(p.thrusters[2]>.99);
  }
  assert.ok(speeds[0]<speeds[1]&&speeds[1]<speeds[2],speeds.join(', '));
});
