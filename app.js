import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { ADDITION, Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

const $ = (selector) => document.querySelector(selector);
const stage = $("#preview-stage");
const loading = $("#loading-state");
const notice = $("#notice");
const exportMale = $("#export-male");
const exportFemale = $("#export-female");
const exportPin = $("#export-pin");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, stage.clientWidth / stage.clientHeight, 0.1, 1500);
camera.up.set(0, 0, 1);
camera.position.set(110, -150, 130);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 0, 4);
scene.add(new THREE.HemisphereLight(0xfff8eb, 0x80786e, 2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-80, -50, 120);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffdfbf, 1.2);
fillLight.position.set(70, 45, 70);
scene.add(fillLight);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.ShadowMaterial({ opacity: 0.13 }));
floor.position.z = -0.3;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(240, 24, 0xc7bfb2, 0xd7d1c7);
grid.rotation.x = Math.PI / 2;
grid.position.z = -0.2;
grid.visible = false;
scene.add(grid);

const preview = new THREE.Group();
scene.add(preview);
let font = null;
let sourceSvgShapes = null;
let sourceSvgName = "";
let sourceSvgText = "";
let loadedFontName = "helvetiker_bold";
let model = { male: null, female: null, pin: null, material: null };
let mechanism = "hinge";
let designMode = "text";
let viewMode = "simple";
let busy = false;
let rebuildQueued = false;
let debounceTimer;
let dimensionAnchor = null;
let dimensionState = null;
let hingePreview = null;
let dimensionsVisible = false;
let history = [];
let bodyMaterial = new THREE.MeshStandardMaterial({ color: "#e0a165", roughness: .52, metalness: .01 });
const materialColors = { pla: "#e0a165", petg: "#78a18b", resin: "#8393ad" };

function num(id, fallback) { return Number($(id).value) || fallback; }
function config() {
  return {
    width: clamp(num("#plate-width",64),25,120),
    height: clamp(num("#plate-height",42),20,100),
    thickness: clamp(num("#plate-thickness",5),2,15),
    corner: clamp(num("#corner-radius",4),0,15),
    relief: clamp(num("#relief-height",.8),.2,4),
    depth: clamp(num("#impression-depth",.9),.2,Math.min(4,Math.max(.2,num("#plate-thickness",5)-.2))),
    clearance: clamp(num("#clearance",.22),.05,1),
    margin: clamp(num("#design-margin",4),1,12),
    scale: clamp(num("#design-scale",.82),.3,1.2),
    rotation: num("#design-rotation",0) * Math.PI / 180,
    offsetX: clamp(num("#offset-x",0),-30,30),
    offsetY: clamp(num("#offset-y",0),-30,30),
    mirror: $("#mirror-design").checked,
    magnet: num("#magnet-size",6),
    magnetDepth: clamp(num("#magnet-depth",2),1,4),
    magnetCount: Number($("#magnet-count").value),
    angle: Number($("#hinge-angle").value || 145) * Math.PI / 180,
    hingeHole: clamp(num("#hinge-hole",1.75),1,4),
    repetitions: Number($("#pattern-repeat").value)
  };
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

function roundedPlateShape(width,height,radius) {
  const r=clamp(radius,0,Math.min(width,height)/2);
  const s=new THREE.Shape();
  s.moveTo(-width/2+r,-height/2);
  s.lineTo(width/2-r,-height/2); s.quadraticCurveTo(width/2,-height/2,width/2,-height/2+r);
  s.lineTo(width/2,height/2-r); s.quadraticCurveTo(width/2,height/2,width/2-r,height/2);
  s.lineTo(-width/2+r,height/2); s.quadraticCurveTo(-width/2,height/2,-width/2,height/2-r);
  s.lineTo(-width/2,-height/2+r); s.quadraticCurveTo(-width/2,-height/2,-width/2+r,-height/2);
  return s;
}
function plateGeometry(c) {
  return new THREE.ExtrudeGeometry(roundedPlateShape(c.width,c.height,c.corner),{depth:c.thickness,bevelEnabled:false,curveSegments:8});
}
function makeRingGeometry(outerRadius,innerRadius,length) {
  const shape=new THREE.Shape();
  shape.absarc(0,0,outerRadius,0,Math.PI*2,false);
  const hole=new THREE.Path();
  hole.absarc(0,0,innerRadius,0,Math.PI*2,true);
  shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,curveSegments:20});
  g.rotateY(Math.PI/2);
  return g;
}
function hingeOffset(c){return c.height/2+2.7;}
function makeHinge(c,part) {
  const group=new THREE.Group(),radius=2.7,hole=Math.max(.5,c.hingeHole/2);
  const y=part==="female"?-hingeOffset(c):hingeOffset(c),z=c.thickness,gap=Math.max(.45,c.clearance*2);
  if(part==="male"){
    for(const x of [-c.width*.28,c.width*.28]){
      const length=Math.max(4,c.width*.22-gap);
      const ring=new THREE.Mesh(makeRingGeometry(radius,hole,length),bodyMaterial);
      ring.position.set(x-length/2,y,z);ring.castShadow=true;group.add(ring);
    }
  }else{
    const length=Math.max(5,c.width*.34-gap);
    const ring=new THREE.Mesh(makeRingGeometry(radius,hole,length),bodyMaterial);
    ring.position.set(-length/2,y,z);ring.castShadow=true;group.add(ring);
  }
  return group;
}
function makePin(c){
  const length=c.width*.82,pinRadius=Math.max(.25,c.hingeHole/2-c.clearance/2),g=new THREE.CylinderGeometry(pinRadius,pinRadius,length,24,1,false);
  g.rotateZ(Math.PI/2);
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:"#555650",roughness:.4}));
  mesh.position.set(0,hingeOffset(c),c.thickness);mesh.castShadow=true;return mesh;
}
function makeMagnetCutters(c) {
  const cutters=[];
  const pairs=c.magnetCount;
  const xPositions=pairs===1?[0]:Array.from({length:pairs},(_,i)=>-c.width*.34+i*(c.width*.68/(pairs-1)));
  for(const x of xPositions) for(const y of [-c.height*.3,c.height*.3]){
    const geometry=new THREE.CylinderGeometry(c.magnet/2+c.clearance/2,c.magnet/2+c.clearance/2,c.magnetDepth,32);
    geometry.rotateX(Math.PI/2);
    const brush=new Brush(geometry,new THREE.MeshStandardMaterial());
    brush.position.set(x,y,c.thickness-c.magnetDepth/2);
    brush.updateMatrixWorld(true);
    cutters.push(brush);
  }
  return cutters;
}
function buildPatternShapes(c) {
  const shapes=[];
  const cols=c.repetitions, rows=Math.max(2,Math.round(cols*c.height/c.width));
  const cellW=(c.width-2*c.margin)/cols, cellH=(c.height-2*c.margin)/rows;
  const rect=(x,y,w,h)=>{const s=new THREE.Shape();s.moveTo(x,y);s.lineTo(x+w,y);s.lineTo(x+w,y+h);s.lineTo(x,y+h);s.closePath();return s;};
  const type=$("#pattern-select").value;
  if(type==="dots"){
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const s=new THREE.Shape();s.absarc((col-(cols-1)/2)*cellW,(row-(rows-1)/2)*cellH,Math.min(cellW,cellH)*.22,0,Math.PI*2,false);shapes.push(s);
    }
  }else if(type==="stripes"){
    for(let i=-rows;i<cols+rows;i++)shapes.push(rect((i-(cols-1)/2)*cellW-cellW*.1,-c.height/2,cellW*.2,c.height));
  }else if(type==="diamonds"){
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const x=(col-(cols-1)/2)*cellW,y=(row-(rows-1)/2)*cellH,w=cellW*.28,h=cellH*.34;
      const s=new THREE.Shape();s.moveTo(x,y+h);s.lineTo(x+w,y);s.lineTo(x,y-h);s.lineTo(x-w,y);s.closePath();shapes.push(s);
    }
  }else{
    for(let row=0;row<rows;row++){
      const y=(row-(rows-1)/2)*cellH,amp=cellH*.2;
      const s=new THREE.Shape();s.moveTo(-c.width/2,y-amp);
      for(let x=-c.width/2;x<=c.width/2;x+=2)s.lineTo(x,y+Math.sin((x+c.width/2)/cellW*Math.PI*2)*amp);
      for(let x=c.width/2;x>=-c.width/2;x-=2)s.lineTo(x,y+Math.sin((x+c.width/2)/cellW*Math.PI*2)*amp-cellH*.12);
      s.closePath();shapes.push(s);
    }
  }
  return shapes;
}
function designGeometry(c,depth,expanded=0,part="male") {
  let geometry;
  const width=c.width-2*c.margin+expanded*2;
  const height=c.height-2*c.margin+expanded*2;
  if(designMode==="text"){
    const text=$("#stamp-text").value.trim()||" ";
    geometry=new TextGeometry(text,{font,size:clamp(num("#font-size",20),8,32),depth,curveSegments:8,bevelEnabled:false});
  }else{
    const shapes=designMode==="upload"?(sourceSvgShapes||[]):buildPatternShapes(c);
    if(!shapes.length) throw new Error("Upload an SVG with filled paths before creating the mold.");
    geometry=new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:false,curveSegments:4});
  }
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox;
  const bw=Math.max(.01,bounds.max.x-bounds.min.x),bh=Math.max(.01,bounds.max.y-bounds.min.y);
  const fit=Math.min(width/bw,height/bh)*c.scale;
  geometry.translate(-(bounds.min.x+bounds.max.x)/2,-(bounds.min.y+bounds.max.y)/2,-bounds.min.z);
  geometry.scale(fit,fit,fit);
  if(c.mirror) geometry=mirrorX(geometry);
  if(part==="female") geometry=mirrorY(geometry);
  return geometry;
}
function mirrorY(geometry){
  const g=geometry.toNonIndexed(),p=g.getAttribute("position");
  for(let i=0;i<p.count;i+=3){
    p.setY(i,-p.getY(i));p.setY(i+1,-p.getY(i+1));p.setY(i+2,-p.getY(i+2));
    for(const name of Object.keys(g.attributes)){
      const a=g.getAttribute(name),values=[];
      for(let k=0;k<a.itemSize;k++)values.push(a.array[(i+1)*a.itemSize+k]);
      for(let k=0;k<a.itemSize;k++){a.array[(i+1)*a.itemSize+k]=a.array[(i+2)*a.itemSize+k];a.array[(i+2)*a.itemSize+k]=values[k];}
    }
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function mirrorX(geometry){
  let g=geometry.toNonIndexed();
  const p=g.getAttribute("position");
  for(let i=0;i<p.count;i+=3){
    const x0=p.getX(i),x1=p.getX(i+1),x2=p.getX(i+2);
    p.setX(i,-x0);p.setX(i+1,-x2);p.setX(i+2,-x1);
    for(const name of Object.keys(g.attributes)){
      if(name==="position")continue;
      const a=g.getAttribute(name),vals=[];
      for(let k=0;k<a.itemSize;k++) vals.push(a.array[(i+1)*a.itemSize+k]);
      for(let k=0;k<a.itemSize;k++){a.array[(i+1)*a.itemSize+k]=a.array[(i+2)*a.itemSize+k];a.array[(i+2)*a.itemSize+k]=vals[k];}
    }
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function makeDesignBrush(c,depth,baseZ,expanded=0,part="male"){
  const geometry=designGeometry(c,depth,expanded,part);
  const material=new THREE.MeshStandardMaterial({color:"#efc28d",side:THREE.DoubleSide});
  const brush=new Brush(geometry,material);
  brush.position.set(c.offsetX,c.offsetY,baseZ);
  brush.rotation.z=c.rotation;
  brush.updateMatrixWorld(true);
  return brush;
}
function disposeGroup(group){
  group.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  while(group.children.length)group.remove(group.children[0]);
}
function booleanOp(plate,cutter,evaluator,operation){
  plate.updateMatrixWorld(true);cutter.updateMatrixWorld(true);
  const result=evaluator.evaluate(plate,cutter,operation);
  result.geometry.computeVertexNormals();return result;
}
function subtract(plate,cutter,evaluator){return booleanOp(plate,cutter,evaluator,SUBTRACTION);}
function addMagnetPockets(plate,c,evaluator){
  if(mechanism!=="magnet")return plate;
  for(const cutter of makeMagnetCutters(c)){
    plate=subtract(plate,cutter,evaluator);
  }
  return plate;
}
function makePart(c,part,evaluator,material){
  if(designMode==="upload"&&!sourceSvgShapes)throw new Error("Choose an SVG with filled paths before building the stamp.");
  let plate=new Brush(plateGeometry(c),material);plate.position.z=0;plate.updateMatrixWorld(true);
  const hasDesign=!(designMode==="text"&&!$("#stamp-text").value.trim());
  if(hasDesign){
    const depth=part==="female"?c.depth:c.relief;
    const baseZ=part==="female"?c.thickness-depth:c.thickness-.025;
    const cutter=makeDesignBrush(c,depth,baseZ,part==="female"?c.clearance:0,part);
    plate=booleanOp(plate,cutter,evaluator,part==="female"?SUBTRACTION:ADDITION);
  }
  plate=addMagnetPockets(plate,c,evaluator);
  const mesh=new THREE.Mesh(plate.geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
  const partGroup=new THREE.Group();partGroup.add(mesh);
  if(mechanism==="hinge")partGroup.add(makeHinge(c,part));
  return partGroup;
}
function rebuild() {
  if(!font||busy)return;
  busy=true;notice.textContent="Building raised and recessed stamp faces…";
  exportMale.disabled=exportFemale.disabled=true;exportPin.disabled=true;
  try{
    const c=config(),evaluator=new Evaluator();evaluator.useGroups=false;
    bodyMaterial.color.set(viewMode==="white"?"#eeeeeb":(materialColors[$("#material-preset").value]||materialColors.pla));
    const malePart=makePart(c,"male",evaluator,bodyMaterial),femalePart=makePart(c,"female",evaluator,bodyMaterial);
    const d=hingeOffset(c),pin=mechanism==="hinge"?makePin(c):null;
    const maleExport=new THREE.Group();maleExport.add(malePart);
    const femaleExport=new THREE.Group(),femaleExportPart=femalePart.clone(true);
    if(mechanism==="hinge"){
      femaleExportPart.position.set(0,0,c.thickness*2);femaleExportPart.rotation.x=Math.PI;
      pin.position.y=d;
    }else{
      femaleExportPart.position.z=c.thickness;femaleExportPart.rotation.x=Math.PI;
    }
    femaleExport.add(femaleExportPart);
    const pinExport=pin?new THREE.Group():null;if(pin)pinExport.add(pin);
    disposeGroup(preview);
    const maleView=maleExport;
    const femaleView=new THREE.Group();
    if(mechanism==="hinge"){
      femaleView.position.set(0,d,c.thickness);
      const part=femalePart.clone(true);part.position.set(0,-d,c.thickness);part.rotation.x=Math.PI;femaleView.add(part);
      femaleView.rotation.x=-c.angle;
    }else{
      femaleView.position.set(0,c.height*.62,c.thickness);const part=femalePart.clone(true);part.rotation.x=Math.PI;femaleView.add(part);
      maleView.position.y=-c.height*.62;
    }
    dimensionAnchor=maleView;dimensionState={width:c.width,height:c.height,thickness:c.thickness};
    hingePreview=mechanism==="hinge"?femaleView:null;
    preview.add(maleView,femaleView);if(pin)preview.add(pin.clone());
    model={male:maleExport,female:femaleExport,pin:pinExport,material:bodyMaterial};
    $("#body-spec").textContent=c.width+" × "+c.height+" mm";$("#relief-spec").textContent=c.relief.toFixed(1)+" mm";$("#offset-spec").textContent=c.clearance.toFixed(2)+" mm";
    $("#dimension-width").textContent=c.width+" mm";$("#dimension-height").textContent=c.height+" mm";
    const designName=designMode==="text"?"TEXT":designMode==="upload"?"SVG LOGO":$("#pattern-select").value.toUpperCase();
    $("#model-label").textContent=mechanism.toUpperCase()+" · "+designName;
    exportMale.disabled=exportFemale.disabled=false;exportPin.hidden=mechanism!=="hinge";exportPin.disabled=mechanism!=="hinge";notice.textContent="";
  }catch(error){console.error(error);notice.textContent=error.message||"Could not build this model. Check the design and dimensions.";
  }finally{busy=false;if(rebuildQueued){rebuildQueued=false;scheduleRebuild();}}
}

function scheduleRebuild(){
  clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>{if(busy)rebuildQueued=true;else requestAnimationFrame(rebuild);},500);
}
function screenPoint(x,y,z){const p=new THREE.Vector3(x,y,z).applyMatrix4(dimensionAnchor.matrixWorld).project(camera);return {x:(p.x+1)*stage.clientWidth/2,y:(1-p.y)*stage.clientHeight/2,visible:p.z>=-1&&p.z<=1};}
function updateDimensionOverlay(){
  if(!dimensionsVisible||!dimensionAnchor||!dimensionState)return;
  dimensionAnchor.updateMatrixWorld(true);camera.updateMatrixWorld();
  const d=dimensionState,z=d.thickness+.3,gap=5;
  const a=screenPoint(-d.width/2,-d.height/2-gap,z),b=screenPoint(d.width/2,-d.height/2-gap,z);
  const c=screenPoint(-d.width/2-gap,-d.height/2,z),e=screenPoint(-d.width/2-gap,d.height/2,z);
  const lines=[[$("#width-line"),a,b],[$("#height-line"),c,e]];
  for(const [line,p,q] of lines){line.setAttribute("x1",p.x);line.setAttribute("y1",p.y);line.setAttribute("x2",q.x);line.setAttribute("y2",q.y);line.style.display=p.visible&&q.visible?"":"none";}
  const widthLabel=$("#dimension-width"),heightLabel=$("#dimension-height");
  widthLabel.style.left=((a.x+b.x)/2)+"px";widthLabel.style.top=((a.y+b.y)/2)+"px";
  heightLabel.style.left=((c.x+e.x)/2)+"px";heightLabel.style.top=((c.y+e.y)/2)+"px";
}
function animate(){requestAnimationFrame(animate);controls.update();updateDimensionOverlay();renderer.render(scene,camera);}
animate();
function loadSelectedFont(){
  const fontName=$("#stamp-font").value;
  exportMale.disabled=exportFemale.disabled=true;
  new FontLoader().load(`https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/${fontName}.typeface.json`,loaded=>{
  font=loaded;loadedFontName=fontName;
  rebuild();
  loading.classList.add("hidden");
},undefined,()=>{
  notice.textContent="Could not load the selected font. Try another style or check your connection.";
  exportMale.disabled=exportFemale.disabled=false;
});
}
loadSelectedFont();
$("#stamp-font").addEventListener("change",loadSelectedFont);
const resizeObserver=new ResizeObserver(()=>{
  const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
});
resizeObserver.observe(stage);

document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-selected","false");});
  document.querySelectorAll(".tab-content").forEach(x=>{x.classList.remove("active");x.hidden=true;});
  button.classList.add("active");button.setAttribute("aria-selected","true");
  const panel=document.querySelector(`[data-panel="${button.dataset.tab}"]`);panel.hidden=false;panel.classList.add("active");
}));
document.querySelectorAll(".mechanism").forEach(button=>button.addEventListener("click",()=>{
  mechanism=button.dataset.mechanism;
  document.querySelectorAll(".mechanism").forEach(x=>x.classList.toggle("active",x===button));
  document.querySelectorAll(".magnet-only").forEach(x=>x.hidden=mechanism!=="magnet");
  document.querySelectorAll(".hinge-only").forEach(x=>x.hidden=mechanism!=="hinge");
  scheduleRebuild();
}));
document.querySelectorAll(".mode-button").forEach(button=>button.addEventListener("click",()=>{
  designMode=button.dataset.mode;
  document.querySelectorAll(".mode-button").forEach(x=>x.classList.toggle("active",x===button));
  document.querySelectorAll(".design-pane").forEach(x=>x.classList.toggle("active",x.dataset.design===designMode));
  scheduleRebuild();
}));
document.querySelectorAll("input,select,textarea").forEach(input=>{
  if(["svg-file","load-project","stamp-font"].includes(input.id))return;
  input.addEventListener("input",()=>{
    if(input.id==="stamp-text")$("#text-count").textContent=`${input.value.length} / 40`;
    if(input.id==="pattern-repeat")$("#repeat-value").textContent=input.value;
    if(input.id==="magnet-count")$("#magnet-count-value").textContent=input.value;
    if(input.id==="hinge-angle"){
      $("#hinge-angle-value").textContent=input.value+"°";
      if(hingePreview)hingePreview.rotation.x=-Number(input.value)*Math.PI/180;
      return;
    }
    if(input.type!=="range")scheduleRebuild();
  });
  input.addEventListener("change",()=>{if(input.id!=="hinge-angle")scheduleRebuild();});
});
document.querySelectorAll(".view-button").forEach(button=>button.addEventListener("click",()=>{
  viewMode=button.dataset.view;
  document.querySelectorAll(".view-button").forEach(x=>x.classList.toggle("active",x===button));
  stage.classList.toggle("technical",viewMode==="technical");
  stage.classList.toggle("white-view",viewMode==="white");
  grid.visible=viewMode==="technical";
  bodyMaterial.color.set(viewMode==="white"?"#eeeeeb":materialColors[$("#material-preset").value]);
}));
$("#dimensions-toggle").addEventListener("click",()=>{
  const button=$("#dimensions-toggle");dimensionsVisible=button.getAttribute("aria-pressed")!=="true";
  button.setAttribute("aria-pressed",String(dimensionsVisible));$("#dimension-overlay").hidden=!dimensionsVisible;
});
$("#reset-view").addEventListener("click",()=>{
  camera.position.set(110,-150,130);controls.target.set(0,0,4);controls.update();
});
function simplifyShape(shape,segments=48){
  const points=shape.getSpacedPoints(segments);if(points.length<3)return null;
  const result=new THREE.Shape();result.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)result.lineTo(points[i].x,points[i].y);result.closePath();
  for(const hole of shape.holes){const hp=hole.getSpacedPoints(Math.max(24,Math.floor(segments/2)));if(hp.length<3)continue;
    const path=new THREE.Path();path.moveTo(hp[0].x,hp[0].y);for(let i=1;i<hp.length;i++)path.lineTo(hp[i].x,hp[i].y);path.closePath();result.holes.push(path);}
  return result;
}
function parseSvgShapes(text){
  if(text.length>250000)throw new Error("This SVG is too large for a responsive preview (250 KB maximum). Simplify or export a smaller SVG.");
  const pathCount=(text.match(/<path\b/gi)||[]).length,commandCount=(text.match(/[MmLlHhVvCcSsQqTtAaZz]/g)||[]).length;
  if(pathCount>50||commandCount>12000)throw new Error("This SVG has too many vector segments. Simplify it in a vector editor and try again.");
  const svg=new SVGLoader().parse(text),raw=svg.paths.flatMap(path=>SVGLoader.createShapes(path));
  if(raw.length>24)throw new Error("This SVG has more than 24 filled regions. Combine or simplify its paths and retry.");
  const shapes=raw.map(shape=>simplifyShape(shape)).filter(Boolean);
  if(!shapes.length)throw new Error("No filled SVG paths found. Convert strokes to filled paths and retry.");
  return shapes;
}
$("#svg-file").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>250000)throw new Error("This SVG is too large for a responsive preview (250 KB maximum).");
    notice.textContent="Reading and simplifying SVG paths…";const text=await file.text();
    if(!text.toLowerCase().includes("<svg"))throw new Error("That file does not contain an SVG image.");
    const shapes=parseSvgShapes(text);sourceSvgText=text;sourceSvgShapes=shapes;sourceSvgName=file.name;
    $("#file-status").textContent=file.name+" · "+shapes.length+" simplified filled path(s)";designMode="upload";
    document.querySelectorAll(".mode-button").forEach(x=>x.classList.toggle("active",x.dataset.mode==="upload"));
    document.querySelectorAll(".design-pane").forEach(x=>x.classList.toggle("active",x.dataset.design==="upload"));
    scheduleRebuild();
  }catch(error){$("#file-status").textContent=error.message;notice.textContent=error.message;}
});
function projectData(){
  return {version:1,name:$("#project-name").value,mechanism,designMode,svgName:sourceSvgName,svgText:sourceSvgText,
    values:Object.fromEntries(["stamp-text","stamp-font","font-size","design-scale","design-rotation","offset-x","offset-y","mirror-design","plate-width","plate-height","plate-thickness","corner-radius","relief-height","impression-depth","clearance","design-margin","hinge-hole","magnet-size","magnet-depth","magnet-count","hinge-angle","pattern-select","pattern-repeat","material-preset"].map(id=>[id,$("#"+id).type==="checkbox"?$("#"+id).checked:$("#"+id).value]))};
}
function applyProject(data){
  if(data.version!==1||!data.values)throw new Error("Unsupported project file.");
  $("#project-name").value=data.name||"My custom stamp";mechanism=data.mechanism||"hinge";designMode=data.designMode||"text";
  sourceSvgText=data.svgText||"";sourceSvgName=data.svgName||"";
  sourceSvgShapes=sourceSvgText?parseSvgShapes(sourceSvgText):null;
  for(const [id,value] of Object.entries(data.values)){const el=$("#"+id);if(el){if(el.type==="checkbox")el.checked=Boolean(value);else el.value=value;}}
  if($("#stamp-font").value!==loadedFontName)loadSelectedFont();
  document.querySelectorAll(".mechanism").forEach(x=>x.classList.toggle("active",x.dataset.mechanism===mechanism));
  document.querySelectorAll(".magnet-only").forEach(x=>x.hidden=mechanism!=="magnet");
  document.querySelectorAll(".hinge-only").forEach(x=>x.hidden=mechanism!=="hinge");
  document.querySelectorAll(".mode-button").forEach(x=>x.classList.toggle("active",x.dataset.mode===designMode));
  document.querySelectorAll(".design-pane").forEach(x=>x.classList.toggle("active",x.dataset.design===designMode));
  $("#text-count").textContent=`${$("#stamp-text").value.length} / 40`;
  $("#repeat-value").textContent=$("#pattern-repeat").value;
  $("#magnet-count-value").textContent=$("#magnet-count").value;
  $("#hinge-angle-value").textContent=$("#hinge-angle").value+"°";
  scheduleRebuild();
}
$("#save-project").addEventListener("click",()=>{
  localStorage.setItem("abrimor-project",JSON.stringify(projectData()));
  $("#save-status").textContent="Saved on this device.";
});
$("#download-project").addEventListener("click",()=>downloadText(JSON.stringify(projectData(),null,2),`${slug($("#project-name").value)}.json`,"application/json"));
$("#load-project").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{applyProject(JSON.parse(await file.text()));$("#save-status").textContent="Project file opened.";}
  catch(error){notice.textContent=error.message||"Could not open this project file.";}
});
$("#reset-design").addEventListener("click",()=>{
  if(!confirm("Reset all stamp settings to the starter design?"))return;
  const defaults={"stamp-text":"MAKE IT","stamp-font":"helvetiker_bold","font-size":"20","design-scale":".82","design-rotation":"0","offset-x":"0","offset-y":"0","plate-width":"64","plate-height":"42","plate-thickness":"5","corner-radius":"4","relief-height":".8","impression-depth":".9","clearance":".22","design-margin":"4","hinge-hole":"1.75","magnet-size":"6","magnet-depth":"2","magnet-count":"2","hinge-angle":"145","pattern-select":"dots","pattern-repeat":"5","material-preset":"pla"};
  for(const [id,value]of Object.entries(defaults))$("#"+id).value=value;
  $("#mirror-design").checked=true;$("#hinge-angle-value").textContent="145°";mechanism="hinge";designMode="text";sourceSvgShapes=null;sourceSvgName="";sourceSvgText="";
  document.querySelectorAll(".mechanism").forEach(x=>x.classList.toggle("active",x.dataset.mechanism==="hinge"));
  document.querySelectorAll(".mode-button").forEach(x=>x.classList.toggle("active",x.dataset.mode==="text"));
  document.querySelectorAll(".design-pane").forEach(x=>x.classList.toggle("active",x.dataset.design==="text"));
  document.querySelectorAll(".magnet-only").forEach(x=>x.hidden=true);
  scheduleRebuild();
});
$("#undo-button").addEventListener("click",()=>{
  const old=history.pop();if(!old){$("#save-status").textContent="Nothing to undo yet.";return;}
  applyProject(old);$("#save-status").textContent="Last edit restored.";
});
let editSnapshot=null;
document.addEventListener("focusin",()=>{editSnapshot=JSON.stringify(projectData());},true);
document.addEventListener("change",()=>{
  if(editSnapshot){if(history.length>=20)history.shift();history.push(JSON.parse(editSnapshot));editSnapshot=null;}
},true);

function slug(value){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"abrimor-stamp";}
function downloadText(text,name,type){const blob=new Blob([text],{type});downloadBlob(blob,name);}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPart(group,name){
  if(!group)return;
  try{
    const data=new STLExporter().parse(group,{binary:true});
    downloadBlob(new Blob([data],{type:"model/stl"}),`${slug($("#project-name").value)}-${name}.stl`);
    notice.textContent=`${name[0].toUpperCase()+name.slice(1)} STL downloaded.`;
  }catch(error){console.error(error);notice.textContent="STL export failed. Check the design and try again.";}
}
exportMale.addEventListener("click",()=>exportPart(model.male,"male"));
exportFemale.addEventListener("click",()=>exportPart(model.female,"female"));
exportPin.addEventListener("click",()=>exportPart(model.pin,"hinge-pin"));
try{
  const saved=localStorage.getItem("abrimor-project");
  if(saved)applyProject(JSON.parse(saved));
}catch(error){console.warn("Saved local project could not be restored.",error);}
