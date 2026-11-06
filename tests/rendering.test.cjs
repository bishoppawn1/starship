const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function game(){
  const elements=new Map(),draws=[];
  const context=new Proxy({}, {get:(target,key)=>target[key]??((...args)=>{if(key==='drawImage')draws.push(args);}),set:(target,key,value)=>(target[key]=value,true)});
  const element=()=>({width:0,height:0,style:{},parentElement:{clientWidth:600,clientHeight:500},getContext:()=>context,
    getBoundingClientRect(){return {left:12,top:24,width:parseFloat(this.style.width),height:parseFloat(this.style.height)};}});
  const sandbox={Math,performance:{now:()=>0},requestAnimationFrame(){},localStorage:{getItem:()=>null},window:{devicePixelRatio:2},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.art={newSave,arenaDisplaySize,arenaViewport,fitArenaCanvas,canvasPoint,changeCombatZoom,drawArena,shipBounds,SPRITE_SCALE,
      setBattle(value){battle=value;},setSave(value){save=value;},shipSprite,
      frameStep(time,previous){lastFrame=previous;screen='playing';mode='combat';battle={};let delta;
        updateBattle=(dt)=>{delta=dt;};drawArena=()=>{};updateCrew=()=>{};refreshCrewStatus=()=>{};frame(time);return delta;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.art,elements,context,draws};
}

test('arena backing pixels follow display density while aiming stays in world coordinates',()=>{
  const g=game(),world={w:1364,h:1136};g.setBattle({world});g.fitArenaCanvas();
  const canvas=g.elements.get('combatCanvas');assert.equal(canvas.width,2*parseFloat(canvas.style.width));assert.equal(canvas.height,2*parseFloat(canvas.style.height));
  const point=g.canvasPoint({clientX:12+parseFloat(canvas.style.width)/2,clientY:24+parseFloat(canvas.style.height)/2});
  assert.equal(point.x,world.w/2);assert.equal(point.y,world.h/2);
  const size=g.arenaDisplaySize(world,300,250,3);assert.ok(size.width<=300&&size.height<=250);assert.equal(size.pixelWidth,size.width*3);
  // Changing the display canvas never changes the arena's gameplay dimensions.
  assert.equal(world.w,1364);assert.equal(world.h,1136);
  const largeWorld={w:2700,h:1944},player={x:1100,y:900};g.setBattle({world:largeWorld,player});g.fitArenaCanvas();
  const center=g.canvasPoint({clientX:12+parseFloat(canvas.style.width)/2,clientY:24+parseFloat(canvas.style.height)/2});
  assert.equal(center.x,player.x);assert.equal(center.y,player.y);
  const right=g.canvasPoint({clientX:12+parseFloat(canvas.style.width),clientY:24+parseFloat(canvas.style.height)/2});
  assert.equal(right.x,player.x+540);assert.equal(right.y,player.y);
  g.changeCombatZoom(1);
  assert.equal(g.arenaViewport(largeWorld).w,1350);
  const zoomedRight=g.canvasPoint({clientX:12+parseFloat(canvas.style.width),clientY:24+parseFloat(canvas.style.height)/2});
  assert.equal(zoomedRight.x,player.x+675);assert.equal(zoomedRight.y,player.y);
  assert.equal(g.elements.get('combatZoomLabel').textContent,'80%');
});

test('rotation composites the high-resolution sprite with smooth sampling and a correct source crop',()=>{
  const g=game(),save=g.newSave();g.setSave(save);
  assert.equal(g.shipSprite.width,12*24*g.SPRITE_SCALE);assert.equal(g.shipSprite.height,10*24*g.SPRITE_SCALE);
  g.setBattle({world:{w:1364,h:1136},player:{x:300.25,y:500.75,angle:.37,selected:false,thrusters:{}},stars:[],asteroids:[],enemies:[],projectiles:[]});
  g.fitArenaCanvas();g.drawArena(0);
  const call=g.draws.find((args)=>args[0]===g.shipSprite);assert.ok(call);
  assert.equal(call[3]/call[7],24*g.SPRITE_SCALE/30);assert.equal(call[4]/call[8],24*g.SPRITE_SCALE/30);
  assert.equal(g.context.imageSmoothingEnabled,true);assert.equal(g.context.imageSmoothingQuality,'high');
});


test('an initial animation timestamp before setup time never creates a negative simulation step',()=>{
  const g=game();assert.equal(g.frameStep(30,38.5),0);assert.equal(g.frameStep(500,100),.05);assert.equal(g.frameStep(116,100),.016);
});
