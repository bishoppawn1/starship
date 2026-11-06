const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const sandbox={Math,performance:{now:()=>0},localStorage:{getItem:()=>null},document:{getElementById:()=>({getContext:()=>({})}),createElement:()=>({getContext:()=>({})})}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={newSave,navigatePlayer,engineThrusters,angleForAvailableTorque,angleDifference,shipRadius,routeAroundRocks,
      setSave(value){save=value;},setBattle(value){battle=value;}};
  })();`);
  vm.runInNewContext(source,sandbox);return sandbox.game;
}
function setup(starter='wayfarer',rest={}){
  const g=game(),save=g.newSave(starter);g.setSave(save);
  const player={x:1000,y:1000,angle:0,vx:0,vy:0,omega:0,targetAngle:0,dest:null,path:[],thrusters:{},r:g.shipRadius(),...rest};
  const battle={player,asteroids:[],world:{w:3000,h:3000}};g.setBattle(battle);return {g,save,player,battle};
}
function fly(g,player,seconds=120){
  let turning=0;
  for(let frame=0;frame<seconds*60;frame++){
    const previous=player.angle;g.navigatePlayer(1/60);turning+=Math.abs(player.angle-previous);
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
    assert.ok(Math.hypot(player.x-destination.x,player.y-destination.y)<25);
    assert.ok(Math.abs(g.angleDifference(player.angle,targetAngle))<.06,`arrival angle ${player.angle}, requested ${targetAngle}`);
    assert.ok(Math.hypot(player.vx,player.vy)<2);
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
  const result=fly(g,player,160);assert.equal(player.dest,null);assert.ok(Math.hypot(player.x-destination.x,player.y-destination.y)<25);
  assert.ok(Math.abs(g.angleDifference(player.angle,-.5))<.06);assert.ok(result.turning<Math.PI*6);
});

test('a ship follows its wreck-avoidance waypoints and completes the move order',()=>{
  const {g,player,battle}=setup('wayfarer');battle.asteroids=[{x:1230,y:1000,r:35}];const destination={x:1460,y:1000};
  player.dest={...destination};player.path=g.routeAroundRocks(player,player.dest,player.r,battle.asteroids,battle.world);
  assert.ok(player.path.length>1);const result=fly(g,player,180);
  assert.equal(player.dest,null,`still ${Math.hypot(player.x-destination.x,player.y-destination.y)} away after ${result.seconds}s`);
  assert.ok(Math.hypot(player.x-destination.x,player.y-destination.y)<25);
});
