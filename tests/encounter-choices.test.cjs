const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){
  const elements=new Map(),storage=new Map();
  const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  function element(){return {children:[],listeners:{},style:{},classList:{add(){},remove(){}},getContext:()=>context,
    append(child){this.children.push(child);},replaceChildren(){this.children=[];},addEventListener(type,action){this.listeners[type]=action;}};}
  const sandbox={Math,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},
    localStorage:{getItem:(key)=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element}};
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace('  init();\n})();',`
    renderHud=()=>{};renderAll=()=>{};openMap=()=>{mode='map';};
    globalThis.game={newSave,openMapEvent,openOutpost,setSave(value){save=value;},getMode(){return mode;},getEventOpen(){return eventOpen;}};
  })();`);
  vm.runInNewContext(source,sandbox);return {...sandbox.game,elements};
}
function encounter(type,variant=0){
  const g=game(),save=g.newSave();save.metal=90;
  const node={id:'event',type,variant,mapX:600,mapY:300,links:['start']};
  save.map={version:3,current:'start',visited:['start'],resolved:['start'],nodes:[{id:'start',type:'start',mapX:100,mapY:300,links:['event']},node]};
  g.setSave(save);g.openMapEvent('event');return {g,save,node,buttons:g.elements.get('eventChoices').children};
}

test('all encounter variants describe choices without quantified reward or damage spoilers',()=>{
  for(const type of ['pirate','rescue','salvage','anomaly','derelict','relay','minefield','lifeboat','clinic','workshop','courier'])for(let variant=0;variant<3;variant++){
    const {g,save,buttons}=encounter(type,variant);
    assert.ok(buttons.length>=2,`${type} ${variant}`);
    for(const button of buttons)assert.doesNotMatch(button.textContent,/\+|\bNET\b|\bGAIN\b|\bHP\b|\bHULL\b|\bCRATE\b/,`${type} ${variant}: ${button.textContent}`);
    assert.equal(save.metal,90);assert.equal(save.crew.length,3);assert.equal(save.passengers,0);
    assert.doesNotMatch(g.elements.get('eventBody').textContent,/pays 20 metal|working ion blaster|will strike your hull|will strain an engine/i);
  }
});

test('choosing an encounter shows its consequences until Continue is clicked',()=>{
  const {g,save,buttons}=encounter('salvage'),before=save.modules.reduce((sum,room)=>sum+room.hp,0);
  assert.equal(buttons[1].textContent,'CUT OPEN THE INNER RACK');assert.equal(save.metal,90);
  buttons[1].listeners.click();
  assert.equal(save.metal,120);assert.equal(save.modules.reduce((sum,room)=>sum+room.hp,0),before-12);
  assert.match(g.elements.get('captainsLog').innerHTML,/30 metal/);assert.match(g.elements.get('captainsLog').innerHTML,/by 12/);
  assert.equal(g.getEventOpen(),true);assert.equal(g.elements.get('eventType').textContent,'ENCOUNTER RESULT');
  assert.match(g.elements.get('eventEffects').children.map((row)=>row.textContent).join(' '),/Metal: \+30/);
  assert.match(g.elements.get('eventEffects').children.map((row)=>row.textContent).join(' '),/hull/);
  assert.equal(g.elements.get('eventChoices').children[0].textContent,'CONTINUE →');
  assert.ok(save.map.resolved.includes('event'));
  g.elements.get('eventChoices').children[0].listeners.click();
  assert.equal(g.getMode(),'map');assert.equal(g.getEventOpen(),false);
});

test('upfront costs remain visible and unaffordable actions stay disabled',()=>{
  for(const [type,variant,index,cost] of [['rescue',1,1,10],['minefield',1,0,8],['lifeboat',1,0,6]]){
    const {g,save,buttons}=encounter(type,variant);assert.match(buttons[index].textContent,new RegExp(`◆ ${cost}$`));
    save.metal=cost-1;g.openMapEvent('event');assert.equal(g.elements.get('eventChoices').children[index].disabled,true);
  }
});

test('outpost survivor handoff does not advertise its reward before choosing',()=>{
  const g=game(),save=g.newSave();save.passengers=2;g.setSave(save);g.openOutpost({type:'outpost'});
  const button=g.elements.get('eventChoices').children[0];assert.equal(button.textContent,'DELIVER 2 SURVIVORS');
  const before=save.metal;button.listeners.click();assert.equal(save.passengers,0);assert.equal(save.metal,before+40);
  assert.match(g.elements.get('captainsLog').innerHTML,/40 metal paid/);
});

test('courier packages persist until a later outpost delivery',()=>{
  const {g,save,buttons}=encounter('courier',2);
  buttons[0].listeners.click();assert.equal(save.courierCargo,2);
  assert.match(g.elements.get('eventEffects').children.map((row)=>row.textContent).join(' '),/Courier cargo: \+2/);
  g.elements.get('eventChoices').children[0].listeners.click();
  const before=save.metal;g.openOutpost({type:'outpost'});
  assert.match(g.elements.get('eventChoices').children[0].textContent,/DELIVER 2 SEALED PACKAGES/);
  g.elements.get('eventChoices').children[0].listeners.click();
  assert.equal(save.courierCargo,0);assert.equal(save.metal,before+64);
  assert.match(g.elements.get('eventEffects').children.map((row)=>row.textContent).join(' '),/Metal: \+64/);
});

test('workshop choices upgrade real installed systems and state the cost in the result',()=>{
  const {g,save,buttons}=encounter('workshop',2),before=save.reactorLevel;
  buttons[0].listeners.click();
  assert.equal(save.reactorLevel,before+1);assert.equal(save.metal,66);
  assert.match(g.elements.get('eventEffects').children.map((row)=>row.textContent).join(' '),/Reactor level: 1 → 2/);
});
