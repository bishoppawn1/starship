const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),context=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  const el=()=>({getContext:()=>context,style:{},classList:{add(){},remove(){}},querySelectorAll:()=>[],addEventListener(){},setAttribute(){}});
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,WEAPON_TYPES,copyFootprint,migrateWeaponFootprints,moduleCells,moduleGeometry,weaponGeometry,
      weaponHasEscape,weaponWorld,fireWeapon,updateBattle,newSave,openTrader,onGridClick,beginModuleMove,canPlace,
      drawWeaponSprite,weaponBehavior,legacyWeaponLayouts,placementPreview,
      setSave(value){save=value;},getSave(){return save;},select(id){selectedModuleId=id;},
      setBattle(value){battle=value;},stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  const sandbox={console,Math,innerWidth:1280,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el}};
  vm.runInNewContext(source,sandbox);return sandbox.game;
}

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const gun=(type)=>({id:6,type,x:3,y:3,rotation:0,level:1,hp:75,cooldown:1000});
const enemy=(x,y)=>({x,y,hp:1000,maxHp:1000,r:25,speed:0,angle:0,path:[],pathTimer:100,cooldown:1000,phase:0,name:'TARGET'});
function combat(g,type){
  const save=g.newSave(),weapon=gun(type);save.modules=[{id:1,type:'core',x:0,y:0,rotation:0,hp:170,level:1},weapon];save.crew=[];g.setSave(save);g.stubFlight();
  const b={world:{w:2000,h:2000},player:{x:500,y:500,angle:0,r:35},enemies:[],asteroids:[],projectiles:[],ammo:100,shake:0};g.setBattle(b);
  const mount=g.weaponWorld(weapon,b.player),target=enemy(mount.x+150,mount.y);b.enemies=[target];return {b,weapon,target,mount};
}
function normalized(cells){const forms=[];for(let rot=0;rot<4;rot++){const turned=cells.map(([x,y])=>{for(let i=0;i<rot;i++)[x,y]=[-y,x];return[x,y];}),mx=Math.min(...turned.map(([x])=>x)),my=Math.min(...turned.map(([,y])=>y));forms.push(turned.map(([x,y])=>[x-mx,y-my]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map((c)=>c.join(',')).join(';'));}return forms.sort()[0];}

test('the roster has ten footprint patterns and six compact one- or two-cell weapons',()=>{
  const g=game(),shapes=new Set();let compact=0;
  for(const type of g.WEAPON_TYPES){const d=g.MODULES[type];shapes.add(normalized(d.shape));if(d.shape.length<=2)compact++;
    for(let rotation=0;rotation<4;rotation++)for(let facing=0;facing<(d.mountFacings||1);facing++){
      const weapon={...gun(type),rotation,weaponFacing:facing},geometry=g.moduleGeometry(weapon);
      assert.ok(geometry.cells.some((c)=>c.join(',')===geometry.station.join(',')),`${type} station`);
      assert.ok(geometry.cells.some((c)=>c.join(',')===geometry.mount.join(',')),`${type} mount`);
      assert.ok(g.weaponHasEscape(weapon,g.moduleCells(weapon)),`${type} blocked facing ${rotation}/${facing}`);
    }
  }
  assert.ok(shapes.size>=10,`only ${shapes.size} patterns`);assert.ok(compact>=6);
});

test('old installed weapons retain occupied cells, muzzle positions, and their saved settings',()=>{
  const g=game();
  for(const type of g.WEAPON_TYPES){const module={...gun(type),hp:41,level:2,range:150,footprint:g.copyFootprint(g.legacyWeaponLayouts[type])},old=g.moduleCells(module).map((c)=>c.join(',')).join(';'),mount=g.weaponGeometry(module);
    delete module.footprint;const save={modules:[module]};g.migrateWeaponFootprints(save);
    assert.equal(g.moduleCells(module).map((c)=>c.join(',')).join(';'),old,type);near(g.weaponGeometry(module).x,mount.x);near(g.weaponGeometry(module).y,mount.y);
    assert.equal(module.hp,41);assert.equal(module.level,2);assert.equal(module.range,150);const before=JSON.stringify(save);g.migrateWeaponFootprints(save);assert.equal(JSON.stringify(save),before);
  }
});

test('a free footprint refit preserves the old room until a valid confirmation, then adopts the compact shape',()=>{
  const g=game(),save=g.newSave(),module={...gun('autocannon'),x:6,y:1,hp:41,level:2,range:150,footprint:g.copyFootprint(g.legacyWeaponLayouts.autocannon)};
  save.modules.push(module);g.setSave(save);g.openTrader({type:'trader',stock:[]});g.select(6);assert.equal(g.beginModuleMove(true),true);
  const before=JSON.stringify(module),metal=save.metal;g.onGridClick(0,0);assert.equal(JSON.stringify(module),before);
  assert.equal(g.canPlace('autocannon',6,2,0),true);g.onGridClick(6,2);
  assert.equal(g.moduleCells(module).length,2);assert.equal(module.footprint,undefined);assert.equal(module.id,6);assert.equal(module.hp,41);assert.equal(module.level,2);assert.equal(module.range,150);assert.equal(save.metal,metal);
});

test('Gatling rounds are timed and later rounds follow a moving mount and target',()=>{
  const g=game(),{b,weapon,target}=combat(g,'gatling');g.fireWeapon(weapon,b.player,target);
  const shots=[...b.projectiles];assert.equal(shots.filter((s)=>s.delay===0).length,1);near(shots[1].delay,.09);near(shots[2].delay,.18);
  g.updateBattle(.02,0);near(shots[1].remaining,g.MODULES.gatling.range);
  b.player.x+=20;target.y+=15;const nextMount=g.weaponWorld(weapon,b.player);g.updateBattle(.08,0);
  assert.equal(shots[1].delay,0);assert.ok(shots[1].x>=nextMount.x);assert.ok(shots[1].vy>0);assert.ok(shots[2].delay>0);
});

test('queued burst rounds stop when their emitter is destroyed',()=>{
  const g=game(),{b,weapon,target}=combat(g,'gatling');g.fireWeapon(weapon,b.player,target);weapon.hp=0;g.updateBattle(.2,0);
  assert.ok(b.projectiles.every((shot)=>!(shot.delay>0)));assert.ok(b.projectiles.length<=1);
});

test('swarm rockets launch one at a time while scatter and flak salvos remain simultaneous',()=>{
  const g=game();
  for(const [type,count,immediate] of [['swarm',4,1],['scattergun',7,7],['flak',5,5]]){
    const {b,weapon,target}=combat(g,type);g.fireWeapon(weapon,b.player,target);assert.equal(b.projectiles.length,count);assert.equal(b.projectiles.filter((s)=>s.delay===0).length,immediate);
  }
});

test('all twenty weapon types can land real shots through the combat loop',()=>{
  const g=game();for(const type of g.WEAPON_TYPES){const {b,weapon,target}=combat(g,type);g.fireWeapon(weapon,b.player,target);for(let i=0;i<150;i++)g.updateBattle(.02,0);assert.ok(target.hp<1000,`${type} never hit its target`);}
});

test('each weapon has a distinct drawn silhouette, including pods and torpedo tubes',()=>{
  const g=game(),signatures=new Set();for(const type of g.WEAPON_TYPES){const rectangles=[],context={save(){},restore(){},translate(){},fillRect(...args){rectangles.push(args);}};g.drawWeaponSprite(context,type);signatures.add(JSON.stringify(rectangles));}assert.equal(signatures.size,20);
});

test('UI behavior details are derived from the real burst, guidance, and status settings',()=>{
  const g=game();assert.ok(g.weaponBehavior('gatling').includes('0.09s apart'));assert.ok(g.weaponBehavior('missile').includes('Homing'));assert.ok(g.weaponBehavior('torpedo').includes('Unguided'));
  assert.ok(g.weaponBehavior('ion').includes('50% for 3s'));assert.ok(g.weaponBehavior('inferno').includes('5/s for 4s'));assert.ok(g.weaponBehavior('railgun').includes('2 ships'));
});
