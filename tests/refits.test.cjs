const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map();
  const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const el=()=>({getContext:()=>context,width:0,height:0,parentElement:{clientWidth:900,clientHeight:700},dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){}},replaceChildren(){},append(){},querySelectorAll:()=>[],setAttribute(){},addEventListener(){}});
  const sandbox={Math,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{createElement:el,getElementById:(id)=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);}}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,WEAPON_TYPES,newSave,persist,loadSave,moduleGeometry,moduleCells,moduleStation,weaponGeometry,weaponWorld,
      moduleClearance,weaponRange,weaponCanTarget,weaponHasEscape,hullRay,legacyWeaponLayouts,placementPreview,canPlace,
      openTrader,buyTraderItem,onGridClick,beginModuleMove,flipBuild,rotateBuild,setMode,renderInspector,drawWeaponArc,drawExteriorHardware,
      enemyLayout,enemyAlive,hurtEnemy,enemySystemEfficiency,startBattle,fireWeapon,updateBattle,
      setSave(value){save=value;},getSave(){return save;},select(id){selectedModuleId=id;},hover(x,y){hoverCell={x,y};},
      getBattle(){return battle;},setBattle(value){battle=value;},stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const room=(type,id,x,y,rest={})=>({type,id,x,y,rotation:0,level:1,hp:type==='core'?170:75,cooldown:0,...rest});
function setup(g,type,rest={}){
  const save=g.newSave(),weapon=room(type,20,5,0,rest);save.modules=[room('core',1,0,3),weapon];save.crew=[];
  g.setSave(save);g.stubFlight();
  const b={shake:0,ammo:100,maxAmmo:100,world:{w:10000,h:10000},asteroids:[],projectiles:[],player:{x:4000,y:4000,angle:0,r:40},enemies:[]};g.setBattle(b);
  return {save,weapon,b};
}
const enemy=(x,y)=>({x,y,angle:0,r:18,hp:10000,maxHp:10000,speed:0,path:[],pathTimer:1000,cooldown:1000,phase:0});
function findPlacement(g,type,rotation=0){
  for(let y=-8;y<16;y++)for(let x=-8;x<16;x++)if(g.canPlace(type,x,y,rotation))return{x,y};
  assert.fail(`no valid ${type} placement`);
}

test('all mirrored weapons reflect their cells, console, muzzle, facing, and reserved outside cell',()=>{
  const g=game();
  for(const type of g.WEAPON_TYPES)for(const footprint of [null,g.legacyWeaponLayouts[type]])for(let rotation=0;rotation<4;rotation++)for(let facing=0;facing<(g.MODULES[type].mountFacings||1);facing++){
    const normal=room(type,2,3,3,{rotation,weaponFacing:facing,footprint}),flipped={...normal,flipped:true};
    const geo=g.moduleGeometry(flipped),cells=g.moduleCells(flipped),mount=g.weaponGeometry(flipped);
    assert.ok(geo.cells.some(([x,y])=>x===geo.station[0]&&y===geo.station[1]),`${type} station outside room`);
    assert.ok(g.weaponHasEscape(flipped,cells),`${type} ${rotation}/${facing} blocked by its mirrored room`);
    near(g.hullRay(mount,mount.direction,cells,50),50);
    if(!facing){near(mount.x,flipped.x+geo.muzzle[0]);near(mount.y,flipped.y+geo.muzzle[1]);}
    assert.ok(!g.moduleClearance(flipped).some(([x,y])=>cells.some(([cx,cy])=>cx===x&&cy===y)));
    if(rotation===0){
      const n=g.moduleGeometry(normal),width=Math.max(...n.cells.map(([x])=>x))+1;
      assert.deepEqual(Array.from(geo.cells,([x,y])=>`${x},${y}`).sort(),Array.from(n.cells,([x,y])=>`${width-1-x},${y}`).sort());
      const original=g.weaponGeometry(normal);near(mount.x-normal.x,width-(original.x-normal.x));near(mount.y,original.y);
    }
  }
});

test('flipped trader previews install exactly their mirrored geometry and retain it in saves',()=>{
  const g=game(),save=g.newSave();save.modules=[room('core',1,4,4)];save.metal=500;g.setSave(save);
  g.openTrader({type:'trader',stock:[{type:'weapon',qty:1,price:45}]});assert.equal(g.buyTraderItem('weapon'),true);assert.equal(g.flipBuild(),true);
  const spot=findPlacement(g,'weapon');g.hover(spot.x,spot.y);const preview=g.placementPreview();assert.equal(preview.valid,true);assert.equal(preview.module.flipped,true);
  const expected=JSON.stringify(g.moduleCells(preview.module)),mount=g.weaponGeometry(preview.module);g.onGridClick(spot.x,spot.y);
  const installed=save.modules.at(-1);assert.equal(installed.flipped,true);assert.equal(JSON.stringify(g.moduleCells(installed)),expected);
  near(g.weaponGeometry(installed).x,mount.x);assert.equal(save.inventory.weapon,0);
  g.persist();const loaded=g.loadSave(),saved=loaded.modules.find((m)=>m.id===installed.id);assert.equal(saved.flipped,true);assert.equal(JSON.stringify(g.moduleCells(saved)),expected);
});

test('flipping installed rooms confirms through a valid move, keeps upgrades and crew, and cancels cleanly',()=>{
  const g=game(),save=g.newSave();save.modules=[room('core',1,4,4),room('weapon',2,6,4,{hp:41,level:2,range:175})];
  const weapon=save.modules[1];Object.assign(save.crew[0],{...g.moduleStation(weapon),task:'gun'});g.setSave(save);g.openTrader({type:'trader',stock:[]});g.select(2);
  const original=JSON.stringify(weapon),metal=save.metal;assert.equal(g.beginModuleMove(),true);assert.equal(g.flipBuild(),true);assert.equal(JSON.stringify(weapon),original);
  g.hover(1000,1000);g.onGridClick(1000,1000);assert.equal(JSON.stringify(weapon),original,'invalid flip mutated the installed room');
  const spot=findPlacement(g,'weapon');g.onGridClick(spot.x,spot.y);
  assert.equal(weapon.flipped,true);assert.equal(weapon.hp,41);assert.equal(weapon.level,2);assert.equal(weapon.range,175);assert.equal(save.metal,metal);
  near(save.crew[0].x,g.moduleStation(weapon).x);near(save.crew[0].y,g.moduleStation(weapon).y);
  const confirmed=JSON.stringify(weapon);g.beginModuleMove();g.flipBuild();g.setMode('hangar');assert.equal(JSON.stringify(weapon),confirmed);assert.equal(g.flipBuild(),false);
});

test('mirrored weapon sprites and hull-clipped overlays agree with real shot directions',()=>{
  const g=game();for(const type of g.WEAPON_TYPES){
    const {weapon,b}=setup(g,type,{flipped:true}),mount=g.weaponWorld(weapon,b.player),target=enemy(mount.x-120,mount.y);b.enemies=[target];
    assert.equal(g.weaponCanTarget(weapon,b.player,target),true,type);g.fireWeapon(weapon,b.player,target);
    assert.ok(b.projectiles[0].vx<0,type);
    for(let step=0;step<180;step++)g.updateBattle(.02,0);assert.ok(target.hp<10000,`${type} did not hit from its mirrored mount`);
  }
  const {weapon,save}=setup(g,'weapon',{flipped:true}),points=[],context={beginPath(){},moveTo(){},lineTo(x,y){points.push([x,y]);},closePath(){},fill(){},stroke(){}};
  g.drawWeaponArc(context,weapon,1,'rgba(1,2,3,.2)');assert.ok(points.every(([x])=>x<=g.weaponGeometry(weapon).x+1e-7));
  const reflection=[],art={save(){},restore(){},translate(){},rotate(){},scale(...args){reflection.push(args);},fillRect(){}};g.drawExteriorHardware(art,weapon);assert.deepEqual(reflection,[[1,-1]]);
  save.modules.push(room('core',50,2,0));points.length=0;g.drawWeaponArc(context,weapon,1,'rgba(1,2,3,.2)');
  assert.ok(points.some(([x])=>x>=4-1e-7&&x<=4+1e-7),'reflected arc did not clip at the neighboring room');
});

test('missile launchers auto-fire across the arena and hit beyond all legacy range limits',()=>{
  const g=game();for(const type of ['missile','swarm']){
    const {weapon,b}=setup(g,type,{range:30}),mount=g.weaponWorld(weapon,b.player),target=enemy(mount.x+2400,mount.y);b.enemies=[target];
    assert.equal(g.weaponRange(weapon),Infinity);assert.equal(g.weaponCanTarget(weapon,b.player,target),true);
    g.updateBattle(.01,0);assert.equal(b.ammo,100-g.MODULES[type].ammo);const lead=b.projectiles[0];assert.equal(lead.remaining,Infinity);
    weapon.cooldown=1000;for(let step=0;step<1300&&target.hp===10000;step++)g.updateBattle(.01,0);
    assert.ok(target.hp<10000,`${type} did not hit a distant enemy`);assert.ok(lead.x-mount.x>2300);
    g.select(weapon.id);g.renderInspector();const html=g.elements.get('moduleInspector').innerHTML;
    assert.ok(html.includes('UNLIMITED RANGE'));assert.ok(!html.includes('id="weaponRange"'));assert.ok(!html.includes('Infinity'));
    const points=[],ctx={beginPath(){},moveTo(){},lineTo(x,y){points.push([x,y]);},closePath(){},fill(){},stroke(){}};g.drawWeaponArc(ctx,weapon,1,'rgba(1,2,3,.2)');assert.ok(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)));
  }
});

test('guided shots can turn outside arena bounds and reacquire a living ship',()=>{
  const g=game(),{weapon,b}=setup(g,'missile'),mount=g.weaponWorld(weapon,b.player),dead=enemy(mount.x+200,mount.y),next=enemy(mount.x-200,mount.y+100);b.enemies=[dead,next];
  g.fireWeapon(weapon,b.player,dead);const shot=b.projectiles[0];dead.hp=0;shot.x=b.world.w+20;shot.y=5000;shot.launchRemaining=0;
  g.updateBattle(.01,0);assert.equal(shot.target,next);assert.ok(b.projectiles.includes(shot));assert.equal(shot.remaining,Infinity);
  next.hp=0;g.updateBattle(.01,0);assert.ok(!b.projectiles.includes(shot));
});

test('beefier enemies scale every room by sector and still lose functions when rooms are destroyed',()=>{
  const g=game(),old={core:64,weapon:42,engine:40,armor:55};
  for(const heavy of [false,true]){
    const first=g.enemyLayout(heavy,1),fifth=g.enemyLayout(heavy,5);for(const part of first.modules){
      assert.ok(part.hp>=old[part.type]*2);assert.equal(part.maxHp,part.hp);assert.equal(fifth.modules.find(m=>m.type===part.type).hp,Math.round(part.hp*1.48));
    }
  }
  const save=g.newSave();save.sector=5;g.setSave(save);g.startBattle('pirate');const ship=g.getBattle().enemies[0];
  assert.equal(ship.hp,ship.modules.reduce((sum,part)=>sum+part.hp,0));assert.equal(ship.maxHp,ship.hp);
  const weapon=ship.modules.find(m=>m.type==='weapon');g.hurtEnemy(ship,weapon.hp,weapon);assert.equal(g.enemySystemEfficiency(ship,'weapon'),0);assert.equal(g.enemyAlive(ship),true);
  const core=ship.modules.find(m=>m.type==='core');g.hurtEnemy(ship,core.hp,core);assert.equal(g.enemyAlive(ship),false);
});
