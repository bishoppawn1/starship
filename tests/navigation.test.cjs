const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const sandbox={Math,performance:{now:()=>0},localStorage:{getItem:()=>null},document:{getElementById:()=>({getContext:()=>({})}),createElement:()=>({getContext:()=>({})})}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={newSave,navigatePlayer,engineThrusters,angleForAvailableTorque,angleDifference,shipRadius,routeAroundRocks,orderMove,rotateArrival,
      setSave(value){save=value;},setBattle(value){battle=value;}};
  })();`);
  vm.runInNewContext(source,sandbox);return sandbox.game;
}
function setup(starter='wayfarer',rest={}){
  const g=game(),save=g.newSave(starter);g.setSave(save);
  const player={x:1000,y:1000,angle:0,vx:0,vy:0,omega:0,targetAngle:0,dest:null,path:[],thrusters:{},selected:true,r:g.shipRadius(),...rest};
  const battle={player,asteroids:[],world:{w:3000,h:3000}};g.setBattle(battle);return {g,save,player,battle};
}
function fly(g,player,seconds=120){
  let turning=0;
  for(let frame=0;frame<seconds*60;frame++){
    const previous=player.angle;g.navigatePlayer(1/60);turning+=Math.abs(g.angleDifference(previous,player.angle));
    if(!player.dest&&Math.abs(g.angleDifference(player.angle,player.targetAngle))<.06&&Math.hypot(player.vx,player.vy)<2&&Math.abs(player.omega)<.04)return {seconds:frame/60,turning};
  }
  return {seconds,turning};
}

test('bidirectional ships select the shortest clockwise and counterclockwise turns',()=>{
  for(const targetAngle of [-.6,.6]){
    const {g,player}=setup('wayfarer',{targetAngle});g.navigatePlayer(1/60);
    assert.ok(player.omega*targetAngle>0,`target ${targetAngle}, angular velocity ${player.omega}`);
  }
});
for(const starter of ['wayfarer','arsenal','bulwark'])test(`${starter} arrives and settles from destinations on both sides and behind`,()=>{
  for(const [dx,dy,targetAngle] of [[400,0,0],[200,300,.7],[200,-300,-.7],[-300,100,0],[50,30,Math.PI]]){
    const {g,player}=setup(starter,{targetAngle}),destination={x:player.x+dx,y:player.y+dy};player.dest={...destination};player.path=[{...destination}];
    const result=fly(g,player);
    assert.equal(player.dest,null,`${starter} ${dx},${dy}: ${Math.hypot(player.x-destination.x,player.y-destination.y).toFixed(1)} away after ${result.seconds}s, ${result.turning.toFixed(1)} radians turning`);
    assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);
    assert.ok(Math.abs(g.angleDifference(player.angle,targetAngle))<.06,`arrival angle ${player.angle}, requested ${targetAngle}`);
    assert.equal(player.vx,0);assert.equal(player.vy,0);assert.equal(player.omega,0);assert.equal(player.angle,targetAngle);
    for(let frame=0;frame<300;frame++)g.navigatePlayer(1/60);
    assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);assert.equal(player.angle,targetAngle);assert.equal(Object.keys(player.thrusters).length,0);
    assert.ok(result.turning<Math.PI*6,`excessive turning: ${result.turning}`);
  }
});

test('a ship with only counterclockwise torque can still take the long route and stop',()=>{
  const {g,save,player}=setup('wayfarer',{targetAngle:-.5});
  for(const module of save.modules)if(module.type==='smallEngine'||module.id===2)module.hp=0;
  assert.ok(g.engineThrusters().every((engine)=>engine.torque<0));
  player.targetAngle=.5;assert.ok(g.angleForAvailableTorque(player,.5,g.engineThrusters())< -Math.PI);
  const result=fly(g,player,160);assert.ok(Math.abs(g.angleDifference(player.angle,player.targetAngle))<.06);
  assert.ok(player.angle< -Math.PI);assert.ok(Math.abs(player.omega)<.04);assert.ok(result.turning<Math.PI*3);
});

test('a new order reverses an existing turn without committing to another full revolution',()=>{
  const {g,player}=setup('arsenal',{targetAngle:1});for(let frame=0;frame<120;frame++)g.navigatePlayer(1/60);
  assert.ok(player.omega>0);player.targetAngle=-.4;const result=fly(g,player);
  assert.ok(Math.abs(g.angleDifference(player.angle,-.4))<.06);assert.ok(result.turning<Math.PI*2);
});

test('a destination change during translation settles at the new requested pose',()=>{
  const {g,player}=setup('bulwark');player.dest={x:1400,y:1200};player.path=[{...player.dest}];
  for(let frame=0;frame<180;frame++)g.navigatePlayer(1/60);
  const destination={x:850,y:1250};player.dest={...destination};player.path=[{...destination}];player.targetAngle=-.5;
  const result=fly(g,player,160);assert.equal(player.dest,null);assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);
  assert.ok(Math.abs(g.angleDifference(player.angle,-.5))<.06);assert.ok(result.turning<Math.PI*6);
});

test('changing arrival rotation during a move turns immediately and still completes the route',()=>{
  const {g,player}=setup('wayfarer',{selected:true});g.orderMove({x:1450,y:1000});
  for(let frame=0;frame<90;frame++)g.navigatePlayer(1/60);
  assert.ok(player.x>1000&&player.dest);
  for(let step=0;step<6;step++)g.rotateArrival(1);
  assert.ok(player.turnOrderPending);const angle=player.angle,position=player.x;
  for(let frame=0;frame<120;frame++)g.navigatePlayer(1/60);
  assert.ok(player.angle>angle+.2,'the ship should begin turning before reaching the waypoint');
  assert.ok(player.x<1450&&player.dest,'the ship should still be en route');
  assert.ok(player.x>position-15,'turning should not erase the move order');
  const result=fly(g,player,160);
  assert.equal(player.dest,null,`route unfinished after ${result.seconds}s`);
  assert.ok(Math.abs(g.angleDifference(player.angle,Math.PI/2))<.06);
});

test('a rotation chosen before a move also starts turning during travel',()=>{
  const {g,player}=setup('wayfarer',{selected:true});
  for(let step=0;step<4;step++)g.rotateArrival(-1);
  g.orderMove({x:1400,y:1000});assert.ok(player.turnOrderPending);
  for(let frame=0;frame<120;frame++)g.navigatePlayer(1/60);
  assert.ok(player.angle<-.2&&player.dest);
});

test('a ship follows its wreck-avoidance waypoints and completes the move order',()=>{
  const {g,player,battle}=setup('wayfarer');battle.asteroids=[{x:1230,y:1000,r:35}];const destination={x:1460,y:1000};
  player.dest={...destination};player.path=g.routeAroundRocks(player,player.dest,player.r,battle.asteroids,battle.world);
  assert.ok(player.path.length>1);const result=fly(g,player,180);
  assert.equal(player.dest,null,`still ${Math.hypot(player.x-destination.x,player.y-destination.y)} away after ${result.seconds}s`);
  assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);
});

test('the final approach eases onto fractional coordinates and remains exactly stopped',()=>{
  const {g,player}=setup('wayfarer',{x:1007.25,y:1002.75});const destination={x:1000.125,y:1000.375};
  player.dest={...destination};player.path=[{...destination}];g.navigatePlayer(1/60);
  assert.ok(player.arrival);assert.ok(player.x>destination.x&&player.x<1007.25);assert.notEqual(player.dest,null);
  for(let frame=0;frame<30;frame++)g.navigatePlayer(1/60);
  assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);assert.equal(player.dest,null);
  for(let frame=0;frame<600;frame++)g.navigatePlayer(1/60);
  assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);assert.equal(player.vx,0);assert.equal(player.vy,0);assert.equal(player.omega,0);
});

test('a ship holds the exact point while finishing its selected arrival rotation',()=>{
  const {g,player}=setup('arsenal',{x:1006,y:1001,targetAngle:Math.PI/2}),destination={x:1000,y:1000};
  player.dest={...destination};player.path=[{...destination}];for(let frame=0;frame<30;frame++)g.navigatePlayer(1/60);
  assert.equal(player.x,1000);assert.equal(player.y,1000);assert.notEqual(player.dest,null);
  assert.ok(Math.abs(g.angleDifference(player.angle,player.targetAngle))>.01);
  fly(g,player);assert.equal(player.x,1000);assert.equal(player.y,1000);assert.equal(player.angle,Math.PI/2);assert.equal(player.omega,0);assert.equal(player.dest,null);
});

test('a new move cancels the arrival hold immediately, including during final correction',()=>{
  for(const settlingFrames of [1,40]){
    const {g,player}=setup('wayfarer',{x:1007,y:1000});g.orderMove({x:1000,y:1000});
    for(let frame=0;frame<settlingFrames;frame++)g.navigatePlayer(1/60);assert.ok(player.arrival);
    const destination={x:1250.25,y:1100.5};g.orderMove(destination);assert.equal(player.arrival,null);
    fly(g,player);assert.equal(player.dest,null);assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);
  }
});

test('a fast pass near the destination cannot trigger a premature arrival correction',()=>{
  const {g,player}=setup('wayfarer',{x:1005,y:1000,vx:35});player.dest={x:1000,y:1000};player.path=[{...player.dest}];g.navigatePlayer(1/60);
  assert.ok(!player.arrival);assert.notEqual(player.dest,null);
});

test('clicks inside a wreck still finish exactly at the adjusted reachable destination',()=>{
  const {g,player,battle}=setup('wayfarer');battle.asteroids=[{x:1250,y:1000,r:35}];g.orderMove({x:1249,y:1000});
  const destination={...player.dest};assert.notEqual(destination.x,1249);
  fly(g,player,180);assert.equal(player.dest,null);assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);
  assert.ok(Math.hypot(player.x-1250,player.y-1000)>35+player.r);
});

test('changing arrival rotation after stopping turns in place and settles exactly again',()=>{
  const {g,player}=setup('wayfarer',{x:1005,y:1000});g.orderMove({x:1000,y:1000});
  for(let frame=0;frame<30;frame++)g.navigatePlayer(1/60);assert.equal(player.dest,null);
  player.targetAngle=.6;for(let frame=0;frame<1800;frame++)g.navigatePlayer(1/60);
  assert.equal(player.x,1000);assert.equal(player.y,1000);assert.equal(player.angle,.6);assert.equal(player.omega,0);assert.equal(player.vx,0);assert.equal(player.vy,0);
});

// Existing saves can still have the original reverse-thruster starter layouts.
function withReverseThrusters(starter){
  const state=setup(starter),{g,save,player}=state;
  save.modules=save.modules.filter((room)=>room.type!=='shield');
  const positions=starter==='wayfarer'?[[5,2],[5,7]]:starter==='arsenal'?[[7,1],[7,8]]:[[8,1],[8,8]];
  save.modules.push(...positions.map(([x,y],index)=>({id:100+index,type:'smallEngine',x,y,rotation:2,level:1,hp:50})));
  player.r=g.shipRadius();return state;
}

for(const starter of ['wayfarer','arsenal','bulwark'])test(`${starter} holds its travel heading through acceleration and braking`,()=>{
  for(const reverse of [false,true])for(const side of [-1,1]){
    const {g,player}=reverse?withReverseThrusters(starter):setup(starter),destination={x:1400,y:1000+side*200};
    g.orderMove(destination);let turning=0,travelDeviation=0;const rotations=new Set();
    for(let frame=0;frame<7200&&player.dest;frame++){
      const previous=player.angle;g.navigatePlayer(1/60);
      turning+=Math.abs(g.angleDifference(previous,player.angle));
      if(!player.arrival)travelDeviation=Math.max(travelDeviation,Math.abs(g.angleDifference(0,player.angle)));
      if(player.travel)rotations.add(player.travel.rotation);
      assert.equal(player.targetAngle,0,'autopilot must preserve the selected arrival angle');
    }
    assert.equal(player.dest,null,`${starter}, reverse=${reverse}, side=${side}: move unfinished`);
    assert.ok(travelDeviation<1.2,`unexpected mid-flight turn: ${travelDeviation} radians`);
    assert.ok(turning<2.5,`unnecessary turning: ${turning} radians`);
    assert.equal(rotations.size,1,'braking must not switch travel drive direction');
    assert.equal(player.x,destination.x);assert.equal(player.y,destination.y);assert.equal(player.angle,0);assert.equal(player.omega,0);
  }
});

test('reverse engines back toward a destination without flipping the hull to brake',()=>{
  const {g,player}=withReverseThrusters('wayfarer');g.orderMove({x:600,y:1000});let maxAngle=0;
  for(let frame=0;frame<7200&&player.dest;frame++){
    g.navigatePlayer(1/60);maxAngle=Math.max(maxAngle,Math.abs(g.angleDifference(0,player.angle)));
  }
  assert.equal(player.dest,null);assert.ok(maxAngle<.05,`backward move rotated ${maxAngle} radians`);
  assert.equal(player.x,600);assert.equal(player.y,1000);assert.equal(player.angle,0);
});

test('repeated angle changes during flight keep the latest selected angle at arrival',()=>{
  for(const dt of [1/30,1/144]){
    const {g,player}=withReverseThrusters('arsenal');g.orderMove({x:1400,y:1200});
    for(let frame=0;frame<5/dt;frame++)g.navigatePlayer(dt);
    for(let step=0;step<8;step++)g.rotateArrival(1);
    for(let frame=0;frame<1/dt;frame++)g.navigatePlayer(dt);
    for(let step=0;step<11;step++)g.rotateArrival(-1);
    const selected=player.targetAngle;
    for(let frame=0;frame<120/dt&&player.dest;frame++){g.navigatePlayer(dt);assert.equal(player.targetAngle,selected);}
    assert.equal(player.dest,null,`move unfinished at dt=${dt}`);assert.equal(player.x,1400);assert.equal(player.y,1200);
    assert.equal(player.angle,selected);assert.equal(player.omega,0);
    for(let frame=0;frame<3/dt;frame++)g.navigatePlayer(dt);
    assert.equal(player.angle,selected);assert.equal(player.x,1400);assert.equal(player.y,1200);
  }
});
