const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),draws=[];
  const context=new Proxy({},{get:(o,k)=>o[k]??((...args)=>{draws.push([k,...args]);}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({dataset:{},width:0,height:0,style:{removeProperty(){},setProperty(){}},classList:{add(){},remove(){}},
    getBoundingClientRect(){return {left:12,top:24,width:parseFloat(this.style.width)||600,height:parseFloat(this.style.height)||400};},getContext:()=>context,addEventListener(){},querySelectorAll:()=>[],setAttribute(){},append(){},replaceChildren(){},parentElement:{clientWidth:600,clientHeight:500}});
  const math=Object.create(Math);
  const sandbox={Math:math,innerWidth:1200,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,startBattle,combatPanelLayout,combatPanelPoint,arenaCamera,canvasPoint,fitArenaCanvas,drawArena,renderCombatTargets,selectCombatTarget,enemyRoomPoint,enemyAlive,weaponCanTarget,orderCrewWorld,selectCrew,hullPointWorld,newSave,loadSave,persist,moduleCells,moduleStation,moduleGeometry,canPlace,canPlaceFootprint,moduleClearance,droneBayDoor,droneBayClear,
      updateDroneAssembly,updateDrones,updateCrew,recoverDrones,droneBayCapacity,droneCount,assemblyTime,setDroneDesign,toggleDroneProduction,normalizeDrones,updateBoarding,enemyLayout,fireProjectile,
      weaponGeometry,weaponWorld,weaponAim,turnWeapon,fireWeapon,updateBattle,drawExteriorHardware,renderOperations,renderInspector,openTrader,
      setSave(value){save=value;},getSave(){return save;},setBattle(value){battle=value;},getBattle(){return battle;},select(id){selectedModuleId=id;},setMode(value){mode=value;},
      stubFlight(){navigatePlayer=()=>{};crewAtStation=()=>0;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements,math,draws};
}


const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function setup(g,kind='rescue',large=false){
  const save=g.newSave();if(large)for(let i=0;i<40;i++)save.modules.push({id:100+i,type:'armor',x:10+i*2,y:5,rotation:0,hp:115,level:1});g.setSave(save);g.startBattle(kind);g.stubFlight();
  const b=g.getBattle();for(const room of save.modules)if(g.MODULES[room.type].range)room.cooldown=1000;for(const enemy of b.enemies)for(const room of enemy.modules)if(room.type==='weapon')room.cooldown=1000;
  return {save,b};
}
function screenPoint(panel,point){return {x:panel.content.x+(point.x-panel.camera.x)*panel.scale,y:panel.content.y+(point.y-panel.camera.y)*panel.scale};}

test('two enemies have separate compact monitors side by side beside the player view',()=>{
  const g=game();setup(g);const panels=g.combatPanelLayout(),player=panels[0],first=panels[1],second=panels[2];assert.equal(panels.length,3);
  assert.equal(player.kind,'player');assert.equal(first.enemyIndex,0);assert.equal(second.enemyIndex,1);assert.ok(first.x>player.x+player.w);assert.ok(second.x>first.x+first.w);assert.equal(first.y,second.y);assert.ok(first.w<player.w);assert.ok(first.h<player.h);
});

test('one enemy uses a single separate monitor and defeated contacts retain their slot',()=>{
  const g=game(),{b}=setup(g,'pirate');assert.equal(g.combatPanelLayout().length,2);const before=g.combatPanelLayout()[1];b.enemies[0].modules.find((room)=>room.type==='core').hp=0;const after=g.combatPanelLayout()[1];assert.equal(after.x,before.x);assert.equal(after.w,before.w);
  g.renderCombatTargets();const html=g.elements.get('combatTargets').innerHTML;assert.match(html,/DESTROYED/);assert.match(html,/disabled/);
});

test('monitor room clicks map to each real enemy room without changing combat geometry',()=>{
  const g=game(),{b}=setup(g),positions=b.enemies.map((enemy)=>[enemy.x,enemy.y]);
  for(const panel of g.combatPanelLayout().slice(1)){
    const enemy=b.enemies[panel.enemyIndex],room=enemy.modules.find((room)=>room.type==='weapon'),point=g.enemyRoomPoint(enemy,room),mapped=g.combatPanelPoint(screenPoint(panel,point));near(mapped.x,point.x);near(mapped.y,point.y);assert.equal(mapped.enemyIndex,panel.enemyIndex);
    assert.equal(g.selectCombatTarget(mapped),true);assert.equal(b.targetEnemy,panel.enemyIndex);assert.equal(enemy.modules[b.targetRoom],room);assert.equal(b.droneTarget,panel.enemyIndex);
  }
  assert.deepEqual(b.enemies.map((enemy)=>[enemy.x,enemy.y]),positions);
});

test('display-density scaling preserves precise targeting inside a compact monitor',()=>{
  const g=game(),{b}=setup(g);g.fitArenaCanvas();const panel=g.combatPanelLayout()[2],enemy=b.enemies[1],point=g.enemyRoomPoint(enemy,enemy.modules[0]),screen=screenPoint(panel,point),view=g.arenaCamera(),canvas=g.elements.get('combatCanvas'),rect=canvas.getBoundingClientRect();
  const mapped=g.canvasPoint({clientX:rect.left+screen.x/view.w*rect.width,clientY:rect.top+screen.y/view.h*rect.height});near(mapped.x,point.x);near(mapped.y,point.y);assert.equal(mapped.enemyIndex,1);
});

test('gaps and monitor borders do not produce a false room target',()=>{
  const g=game(),{b}=setup(g),before=b.targetEnemy;assert.equal(g.combatPanelPoint({x:590,y:400}).outside,true);assert.equal(g.combatPanelPoint({x:610,y:182}).outside,true);assert.equal(b.targetEnemy,before);
});

test('larger player hulls fit their own view while enemy monitor size and detail stay unchanged',()=>{
  const g=game();setup(g);const before=g.combatPanelLayout();setup(g,'rescue',true);const after=g.combatPanelLayout();assert.equal(before[0].w,after[0].w);assert.ok(after[0].scale<before[0].scale);
  for(let i=1;i<before.length;i++){near(after[i].w,before[i].w);near(after[i].h,before[i].h);near(after[i].scale,before[i].scale);}
});

test('rendering draws each hostile once in its monitor and draws the player once',()=>{
  const g=game(),{b}=setup(g),before=b.enemies.map((enemy)=>({x:enemy.x,y:enemy.y,hp:enemy.hp}));g.fitArenaCanvas();g.draws.length=0;g.drawArena(0);
  const labels=g.draws.filter(([kind])=>kind==='fillText').map(([,text])=>text);assert.ok(labels.includes('YOUR SHIP'));assert.ok(labels.includes('HOSTILE TARGET MONITORS'));assert.ok(labels.includes('CONTACT 01 · LOCKED'));assert.ok(labels.includes('CONTACT 02'));
  const images=g.draws.filter(([kind])=>kind==='drawImage');assert.equal(images.length,3);assert.equal(g.draws.filter(([kind])=>kind==='clip').length,3);assert.deepEqual(b.enemies.map((enemy)=>({x:enemy.x,y:enemy.y,hp:enemy.hp})),before);
});

test('shots still fire at the enemy selected through its monitor without moving either ship',()=>{
  const g=game(),{save,b}=setup(g),panel=g.combatPanelLayout()[2],enemy=b.enemies[1],point=g.enemyRoomPoint(enemy,enemy.modules.find((room)=>room.type==='weapon'));
  g.selectCombatTarget(g.combatPanelPoint(screenPoint(panel,point)));const positions=[b.player.x,b.player.y,...b.enemies.flatMap((enemy)=>[enemy.x,enemy.y])];for(const room of save.modules)if(g.MODULES[room.type].range)room.cooldown=0;
  let fired=false;for(let i=0;i<60;i++){g.updateBattle(.02,0);if(b.projectiles.some((shot)=>shot.burstTarget===enemy))fired=true;}
  assert.equal(fired,true);assert.deepEqual([b.player.x,b.player.y,...b.enemies.flatMap((enemy)=>[enemy.x,enemy.y])],positions);
});

test('crew selection and movement use the player monitor camera',()=>{
  const g=game(),{save,b}=setup(g),person=save.crew[0],panel=g.combatPanelLayout()[0],point=g.hullPointWorld({x:5.5,y:4.5},b.player);g.selectCrew(person.id);
  const mapped=g.combatPanelPoint(screenPoint(panel,point));near(mapped.x,point.x);near(mapped.y,point.y);assert.equal(g.orderCrewWorld(mapped),true);near(person.manualGoal.x,5.5);near(person.manualGoal.y,4.5);
});
