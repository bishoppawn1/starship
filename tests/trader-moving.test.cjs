const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map(),context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const el=()=>{const classes=new Set(),handlers={};return {classes,handlers,dataset:{},style:{setProperty(){},removeProperty(){}},
    classList:{add:(c)=>classes.add(c),remove:(c)=>classes.delete(c)},getContext:()=>context,addEventListener(type,fn){(handlers[type]??=[]).push(fn);},
    querySelectorAll:()=>[],setAttribute(key,value){this[key]=value;},append(){},replaceChildren(){},setPointerCapture(){},hasPointerCapture:()=>false,
    getBoundingClientRect(){if(this.dataset.x!==undefined){const left=+this.dataset.x*24,top=+this.dataset.y*24;return {left,top,right:left+24,bottom:top+24,width:24,height:24};}return {left:0,top:0,right:288,bottom:240,width:288,height:240};},parentElement:{clientWidth:900,clientHeight:700}};};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    globalThis.game={MODULES,newSave,persist,loadSave,openTrader,buyTraderItem,onGridClick,canPlace,moduleStation,moduleCells,createGrid,gridButtons,
      connectedHull,openMap,toggleMap,openHangar,showGame,returnToMainMenu,toggleRearrangeShip,cancelRoomMove,beginModuleMove,startRoomDrag,updateRoomDrag,finishRoomDrag,buildPointerPoint,panBuild,zoomBuild,setMode,selectCrew,placementPreview,
      getSave(){return save;},setSave(value){save=value;},getState(){return {mode,screen,rearrangingShip,movingModuleId,selectedCatalog,selectedCrewId,roomDrag,hoverCell};},getView(){return buildView;},hover(x,y){hoverCell={x,y};}};
  })();`);
  const sandbox={Math,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},window:{devicePixelRatio:1},
    localStorage:{getItem:(k)=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:(id)=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el,querySelectorAll:()=>[]}};
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements};
}
function setup(g){
  const save=g.newSave();save.modules=[{id:1,type:'core',x:4,y:4,rotation:0,level:1,hp:170,powerLevel:1},{id:2,type:'armor',x:6,y:4,rotation:0,level:2,hp:41,footprint:{shape:[[0,0],[1,0],[2,0]],station:null,mount:null,muzzle:null}}];
  save.inventory={};save.crew.forEach(person=>Object.assign(person,{task:'idle',x:4.5,y:4.5}));Object.assign(save.crew[0],{x:7.5,y:4.5});g.setSave(save);g.createGrid();g.openTrader({type:'trader',stock:[]});return {save,room:save.modules[1],person:save.crew[0]};
}
const pointer=(x,y,extra={})=>({clientX:(x+.5)*24,clientY:(y+.5)*24,pointerId:1,button:0,pointerType:'mouse',preventDefault(){},...extra});

test('a trader exposes free click-to-move controls and keeps rearranging active after placement',()=>{
  const g=game(),{save,room,person}=setup(g),metal=save.metal;g.selectCrew(person.id);assert.equal(g.toggleRearrangeShip(),true);assert.equal(g.elements.get('rearrangeShip')['aria-pressed'],'true');
  g.onGridClick(7,4);assert.equal(g.getState().movingModuleId,room.id);assert.equal(g.getState().selectedCrewId,null);assert.equal(room.x,6);assert.equal(room.y,4);assert.equal(g.elements.get('cancelRoomMove').hidden,false);
  assert.ok(g.elements.get('refitStatus').textContent.includes('Moving Armor Plating'));assert.equal(g.canPlace('armor',6,5,0),true);g.onGridClick(6,5);
  assert.equal(room.x,6);assert.equal(room.y,5);assert.equal(room.id,2);assert.equal(room.level,2);assert.equal(room.hp,41);assert.equal(save.metal,metal);assert.equal(save.inventory.armor,undefined);
  assert.equal(g.getState().rearrangingShip,true);assert.equal(g.getState().movingModuleId,null);assert.equal(g.elements.get('cancelRoomMove').hidden,true);
  assert.equal(person.x,g.moduleStation(room).x);assert.equal(person.y,g.moduleStation(room).y);g.persist();const loaded=g.loadSave();assert.equal(loaded.modules[1].y,5);assert.equal(loaded.modules[1].hp,41);
});

test('rearrangement clicks prioritize the room over crew standing in that tile',()=>{
  const g=game(),{person,room}=setup(g),cell=g.gridButtons.find(cell=>+cell.dataset.x===7&&+cell.dataset.y===4),event=pointer(7,4);
  cell.handlers.click[0](event);assert.equal(g.getState().selectedCrewId,person.id);assert.equal(g.getState().movingModuleId,null);
  g.toggleRearrangeShip();cell.handlers.click[0](event);assert.equal(g.getState().selectedCrewId,null);assert.equal(g.getState().movingModuleId,room.id);
});

test('desktop dragging retains the grabbed-cell offset and commits only when dropped',()=>{
  const g=game(),{room}=setup(g),original=JSON.stringify(room);g.startRoomDrag(pointer(8,4));
  g.updateRoomDrag(pointer(8,4,{clientX:205,clientY:109}));assert.equal(g.getState().movingModuleId,null);
  g.updateRoomDrag(pointer(8,5));assert.equal(g.getState().movingModuleId,2);assert.equal(JSON.stringify(room),original);assert.equal(g.getState().hoverCell.x,6);assert.equal(g.getState().hoverCell.y,5);
  assert.equal(g.placementPreview().valid,true);g.finishRoomDrag(pointer(8,5));assert.equal(room.x,6);assert.equal(room.y,5);assert.equal(g.getState().movingModuleId,null);assert.equal(g.getState().roomDrag,null);
});

test('invalid moves retain the original and dropping outside cancels without losing the room',()=>{
  const g=game(),{room,save}=setup(g),before=JSON.stringify(save.modules);g.startRoomDrag(pointer(7,4));g.updateRoomDrag(pointer(4,4));g.finishRoomDrag(pointer(4,4));
  assert.equal(JSON.stringify(save.modules),before);assert.equal(g.getState().movingModuleId,room.id);assert.equal(g.cancelRoomMove(),true);assert.equal(g.getState().movingModuleId,null);
  g.startRoomDrag(pointer(7,4));g.updateRoomDrag(pointer(7,5));g.finishRoomDrag(pointer(7,5,{clientX:400}));assert.equal(JSON.stringify(save.modules),before);assert.equal(g.getState().movingModuleId,null);
});

test('touch uses two taps without capturing scrolling gestures and moving stays trader-only',()=>{
  const g=game(),{room}=setup(g);g.startRoomDrag(pointer(7,4,{pointerType:'touch'}));g.updateRoomDrag(pointer(7,5,{pointerType:'touch'}));assert.equal(g.getState().roomDrag,null);assert.equal(room.y,4);
  g.toggleRearrangeShip();g.onGridClick(7,4);g.onGridClick(6,5);assert.equal(room.y,5);
  const before=JSON.stringify(room);g.onGridClick(7,5);g.setMode('hangar');g.finishRoomDrag(pointer(7,4));g.onGridClick(6,4);assert.equal(JSON.stringify(room),before);assert.equal(g.getState().rearrangingShip,false);assert.equal(g.toggleRearrangeShip(),false);
});

test('drag pointer positions follow the zoomed viewport and signed world coordinates',()=>{
  const g=game();setup(g);g.panBuild(-20,30);g.zoomBuild(-1,.5,.5);const view=g.getView(),event={clientX:4.5/view.cols*288,clientY:2.5/view.rows*240};
  const point=g.buildPointerPoint(event);assert.equal(point.x,view.x+4);assert.equal(point.y,view.y+2);assert.equal(g.buildPointerPoint({clientX:288,clientY:100}),null);assert.equal(g.buildPointerPoint({clientX:-1,clientY:100}),null);
});

test('buying a part exits rearrangement and crew selection cancels a pending room move',()=>{
  const g=game(),{save,person,room}=setup(g);g.toggleRearrangeShip();g.onGridClick(7,4);g.selectCrew(person.id);assert.equal(g.getState().movingModuleId,null);assert.equal(g.getState().rearrangingShip,false);assert.equal(room.y,4);
  g.openTrader({type:'trader',stock:[{type:'armor',qty:1,price:20}]});g.toggleRearrangeShip();g.onGridClick(7,4);assert.equal(g.buyTraderItem('armor'),true);assert.equal(g.getState().rearrangingShip,false);assert.equal(g.getState().selectedCatalog,'armor');assert.equal(g.getState().movingModuleId,null);assert.equal(save.inventory.armor,1);assert.equal(room.y,4);
});


test('detached room placements preserve room and crew state, block all departure paths, then unlock after reconnection',()=>{
  const g=game(),{save,room,person}=setup(g),metal=save.metal;
  g.toggleRearrangeShip();g.onGridClick(7,4);assert.equal(g.canPlace('armor',9,8,0),true);g.onGridClick(9,8);
  assert.equal(room.x,9);assert.equal(room.y,8);assert.equal(room.hp,41);assert.equal(room.level,2);assert.equal(save.metal,metal);
  assert.equal(person.x,g.moduleStation(room).x);assert.equal(person.y,g.moduleStation(room).y);
  assert.equal(g.connectedHull(save.modules),false);assert.equal(g.elements.get('leaveTrader').disabled,true);
  assert.match(g.elements.get('refitStatus').textContent,/ROOMS DISCONNECTED/);
  g.toggleRearrangeShip();assert.match(g.elements.get('refitStatus').textContent,/ROOMS DISCONNECTED/);
  for(const depart of [g.openMap,g.toggleMap,g.openHangar,()=>g.setMode('combat')]){
    depart();assert.equal(g.getState().mode,'trade');assert.equal(room.x,9);
  }
  // Diagonal contact does not count as a connected hull.
  g.toggleRearrangeShip();g.onGridClick(10,8);g.onGridClick(6,6);assert.equal(g.connectedHull(save.modules),false);
  assert.equal(g.elements.get('leaveTrader').disabled,true);
  g.onGridClick(7,6);g.onGridClick(6,5);assert.equal(g.connectedHull(save.modules),true);
  assert.equal(g.elements.get('leaveTrader').disabled,false);assert.doesNotMatch(g.elements.get('refitStatus').textContent,/ROOMS DISCONNECTED/);
  g.openMap();assert.equal(g.getState().mode,'map');
});

test('moving a bridge can split existing rooms, and cancellation preserves the confirmed disconnected layout',()=>{
  const g=game(),{save,room}=setup(g);
  save.modules.push({id:3,type:'armor',x:9,y:4,rotation:0,level:1,hp:50,footprint:{shape:[[0,0]],station:null,mount:null,muzzle:null}});
  assert.equal(g.connectedHull(save.modules),true);g.toggleRearrangeShip();g.onGridClick(7,4);
  assert.equal(g.canPlace('armor',4,6,0),true);g.onGridClick(4,6);
  assert.equal(g.connectedHull(save.modules),false);assert.equal(room.x,4);
  g.onGridClick(5,6);assert.equal(g.cancelRoomMove(),true);assert.equal(room.x,4);assert.equal(room.y,6);
  assert.equal(g.elements.get('leaveTrader').disabled,true);
  // A held part still requires an edge connection, and may bridge separated sections.
  g.openTrader({type:'trader',stock:[{type:'armor',qty:1,price:1}]});g.buyTraderItem('armor');
  assert.equal(g.canPlace('armor',-15,-15,0),false);
});

test('detached refits resume at their trader after menu continuation and saved-game reload',()=>{
  const g=game(),{save,room}=setup(g),node=save.map.nodes.find(node=>node.type==='trader');save.map.current=node.id;
  g.showGame();g.openTrader(node);g.toggleRearrangeShip();g.onGridClick(7,4);g.onGridClick(-4,-3);
  assert.equal(room.x,-4);assert.equal(g.connectedHull(save.modules),false);
  g.returnToMainMenu();assert.equal(g.getState().screen,'menu');g.showGame();assert.equal(g.getState().mode,'trade');
  assert.equal(g.elements.get('leaveTrader').disabled,true);assert.equal(g.getSave().modules[1].x,-4);
  const loaded=g.loadSave(),fresh=game();fresh.setSave(loaded);fresh.createGrid();fresh.showGame();
  assert.equal(fresh.getState().mode,'trade');assert.equal(fresh.elements.get('leaveTrader').disabled,true);
  assert.equal(fresh.getSave().modules[1].x,-4);assert.equal(fresh.getSave().modules[1].hp,41);
});
