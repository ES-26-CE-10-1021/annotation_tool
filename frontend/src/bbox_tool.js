import { pointMaterial } from "./point_cloud.js";
import * as GUI from "@babylonjs/gui";
import { CONFIG } from "./config.js";

let labelGroup;
let instanceInput;
let instanceLabel;
let noteInput;
let annotationOverviewPanel; 
let cameraRef = null;
let sceneRef = null; 

let labelIdToName;

const DEFAULT_SIZE = 5; 

const CLASS_COLORS = {
  0:[0.5,0.5,0.5],
  1:[1,0,0],
  2:[0,1,0],
  3:[0,0,1],
  4:[1,1,0],
  5:[1,0,1],
  6:[0,1,1]
};



const annotationAssets = []; 
let activeAnnotationAsset = null; 
let activeAnnotationRoot = annotationAssets;

export async function fetchAnnotations(scene, gizmoManager) {
  const res = await fetch("/api/bboxes");
  const data = await res.json();

  loadAnnotations(scene, data, gizmoManager);
}

export async function uploadAnnotations() {

  const json = saveAnnotations();
  console.log(json)
  await fetch("/api/bboxes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: json
  });
}


function groupAnnotationsByLabel() {

  const groups = new Map();

  annotationAssets.forEach(annotation => {
    const label = annotation.meta.label;

    if (!groups.has(label)) {
      groups.set(label, []);
    }

    groups.get(label).push(annotation);
  });

  return groups;
}

function collectByType(root, type, out = []) {
  for (const asset of root) {
    if (asset.type === type) {
      out.push(asset);
    }
    if (asset.children.length > 0) {
      collectByType(asset.children, type, out);
    }
  }
  return out;
}


export function createAnnotationOverview(scene, gizmoManager, camera) {
  const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
  const panel = new GUI.StackPanel(); 
  panel.width = "150px";
  panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
  panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  gui.addControl(panel);

  cameraRef = camera; 
  sceneRef = scene;

  // store panel so we can update it later
  annotationOverviewPanel = panel;

  labelIdToName = Object.fromEntries(
    Object.entries(CONFIG.frontend.label_dict).map(([k, v]) => [v, k])
  );
  refreshAnnotationOverview(gizmoManager);


}

function hasChildren(annotation){
  if (annotation.children.length > 0) return true; 
  return false;  
}

function isAnnotationActive(annotation){
  if (annotation === activeAnnotationAsset){
    return true;
  };
  for (const child of annotation.children){
    if (isAnnotationActive(child)) {
      return true;
    };
  };
  return false; 
}

function isAncestorOfActive(annotation) {
  let current = activeAnnotationAsset;

  while (current) {
    if (current === annotation) return true;
    current = current.parent;
  }
  return false;
}

function addAnnotationNode(annotation, gizmoManager, depth = 0) {
  console.log("adding node")
  const shouldExpand =
    isAnnotationActive(annotation) || // subtree
    isAncestorOfActive(annotation);   // parent chain

  // 🔹 Button
  const btn = GUI.Button.CreateSimpleButton(
    "ann_" + Math.random(),
    `${"-".repeat(depth)} ${annotation.meta.instance ?? ""}`
  );

  btn.height = "30px";
  btn.color = "white";
  btn.background =
    (annotation === activeAnnotationAsset)
      ? "#00aa00"
      : shouldExpand
        ? "#666666"
        : "#333333";

  btn.onPointerClickObservable.add(() => {
    selectAnnotationAsset(annotation, gizmoManager);
    focusCameraSmooth(cameraRef, annotation.mesh, sceneRef);
    refreshAnnotationOverview(gizmoManager); // 🔥 re-render
  });

  annotationOverviewPanel.addControl(btn);

  // 🔹 Children (only if expanded)
  if (shouldExpand) {
    annotation.children.forEach(child => {
      addAnnotationNode(child, gizmoManager, depth + 1);
    });
  } else if (hasChildren(annotation)) { 
    const childIndicator = GUI.Button.CreateSimpleButton(
      "child_ann_" + Math.random(),
      ""
    );
    childIndicator.height = "5px";
    childIndicator.color = "white";
    annotationOverviewPanel.addControl(childIndicator)
  }
  
}

function refreshAnnotationOverview(gizmoManager) {
  console.log("refreshing annotation overview")
  if (!annotationOverviewPanel) return;
  annotationOverviewPanel.clearControls();

  const groups = groupAnnotationsByLabel();

  groups.forEach((annotations, labelId) => {

    // 🔹 Group title
    const header = new GUI.TextBlock();
    header.text = labelIdToName[labelId] || `Label ${labelId}`;
    header.height = "30px";
    header.color = "white";
    header.fontSize = 16;
    header.paddingTop = "10px";

    annotationOverviewPanel.addControl(header);

    // 🔥 IMPORTANT: start recursion at root annotations
    annotations.forEach(annotation => {
      addAnnotationNode(annotation, gizmoManager, 0);
    });

  });
}


export function createAnnotationMenu(scene, gizmoManager) {

  const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

  const panel = new GUI.StackPanel()
  panel.width = "200px";
  panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  panel.paddingTop = "20px";
  panel.paddingLeft = "10px";
  panel.spacing = 10;
  panel.adaptHeightToChildren = true;
  
  gui.addControl(panel);
  // TITLE
  const title = new GUI.TextBlock();
  title.text = "Bounding Box";
  title.height = "30px";
  title.color = "white";
  title.fontSize = 20;

  panel.addControl(title);

  const createBtn = GUI.Button.CreateSimpleButton("createBBox", "Create Box");

  createBtn.height = "40px";
  createBtn.color = "white";
  createBtn.background = "#2e7d32";
  createBtn.cornerRadius = 10;

  createBtn.onPointerClickObservable.add(() => {
    createAnnotationAsset(scene, "bbox",gizmoManager);
  });

  panel.addControl(createBtn);

  
  const createHopperBtn = GUI.Button.CreateSimpleButton("createHopper", "Create Hopper");

  createHopperBtn.height = "40px";
  createHopperBtn.color = "white";
  createHopperBtn.background = "#2e7d32";
  createHopperBtn.cornerRadius = 10;

  createHopperBtn.onPointerClickObservable.add(() => {
    createAnnotationAsset(scene, "hopper",gizmoManager, parent=activeAnnotationAsset);
  });

  panel.addControl(createHopperBtn);
  const createChildBtn = GUI.Button.CreateSimpleButton("createBBox", "Create Sub Box");

  createChildBtn.height = "40px";
  createChildBtn.color = "white";
  createChildBtn.background = "#2e7f32";
  createChildBtn.cornerRadius = 10;

  createChildBtn.onPointerClickObservable.add(() => {
    createAnnotationAsset(scene, "bbox",gizmoManager, parent=activeAnnotationAsset);
  });

  panel.addControl(createChildBtn);

  const deleteBtn = GUI.Button.CreateSimpleButton("deleteBBox", "Delete Box");

  deleteBtn.height = "40px";
  deleteBtn.color = "white";
  deleteBtn.background = "#b71c1c";
  deleteBtn.cornerRadius= 10;
  

  deleteBtn.onPointerClickObservable.add(() => {
    deleteAnnotationAsset(scene, gizmoManager);
  });

  panel.addControl(deleteBtn);




  
  // -----------------------------
  // LABEL SELECTOR
  // -----------------------------

  // const labelTitle = new GUI.TextBlock();
  // labelTitle.text = "Label";
  // labelTitle.height = "25px";
  // labelTitle.color = "white";
  //
  // panel.addControl(labelTitle);

  labelGroup = new GUI.RadioGroup("labels");

  const labels = Object.entries(CONFIG.frontend.label_dict)
    .map(([name, id]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      id: id
    }))
    .sort((a, b) => a.id - b.id);
  labels.forEach(l => {
    labelGroup.addRadio(l.name, (state)=>{

      if(state && activeAnnotationAsset){

        activeAnnotationAsset.meta.label = l.id;
        updateShaderBoxes();

      }

    });
  });

  labelGroup.selectors.forEach((selector, i) => {
    selector._labelId = labels[i].id;
  });


  const selector = new GUI.SelectionPanel("labelPanel");
  selector.adaptHeightToChildren= true;  
  selector.paddingBottomInPixels = -5;
  selector.addGroup(labelGroup);
  selector.cornerRadius = 10;
  // selector.background = "#285154";
  selector.background = "#333333";
  selector.headerColor = "white";
  selector.labelColor = "white";
  // selector.spacerHeight = "50px";
  panel.addControl(selector);

  // -----------------------------
  // INSTANCE ID
  // -----------------------------

  const instanceLabel = new GUI.TextBlock();
  instanceLabel.text = "Instance ID";
  instanceLabel.height = "25px";
  instanceLabel.color = "white";

  panel.addControl(instanceLabel);

  instanceInput = new GUI.InputText();
  instanceInput.height = "35px";
  instanceInput.width = "200px"; 
  instanceInput.color = "white";
  instanceInput.background = "#333333";

  instanceInput.onTextChangedObservable.add(()=>{

    if(activeAnnotationAsset){

      activeAnnotationAsset.meta.instance = parseInt(instanceInput.text);

    }

  });

  panel.addControl(instanceInput);

  // -----------------------------
  // NOTE
  // -----------------------------

  const noteLabel = new GUI.TextBlock();
  noteLabel.text = "Annotation Note";
  noteLabel.height = "25px";
  noteLabel.color = "white";

  panel.addControl(noteLabel);

  noteInput = new GUI.InputText();
  noteInput.height = "40px";
  noteInput.width = "200px";
  noteInput.color = "white";
  noteInput.background = "#333333";

  noteInput.onTextChangedObservable.add(()=>{
    if(activeAnnotationAsset){
      activeAnnotationAsset.meta.note = noteInput.text;
    }
  });
  panel.addControl(noteInput);
}



function updateBBoxMenuFromSelection() {
  
  if (!activeAnnotationAsset || !labelGroup) return;
  
  console.log(activeAnnotationAsset)

  const label = activeAnnotationAsset.meta.label;

  const target = labelGroup.selectors.find(
    s => s._labelId === label
  );

  if (target) {
    target.isChecked = true; 
  }

  // Instance
  if (instanceInput){
    instanceInput.text = String(activeAnnotationAsset.meta.instance ?? "");
  }

  // Note
  if (noteInput){
    noteInput.text = activeAnnotationAsset.meta.note ?? "";
  }
}



export function setupAnnotationPicking(scene, gizmoManager) {

  scene.onPointerObservable.add((pointerInfo) => {

    if(pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN)
      return;

    const pick = scene.pick(scene.pointerX, scene.pointerY);

    if(!pick.hit)
      return;

    if(pick.pickedMesh && pick.pickedMesh.name === "bbox") {

      selectAnnotationAsset(findAssetByMesh(annotationAssets, pick.pickedMesh), gizmoManager);
      refreshAnnotationOverview(gizmoManager);
    }

  });

}



class AnnotationAsset{
  constructor(type, mesh, parent = null){
    this.type = type;
    this.mesh = mesh;
    this.activeChild = null;
    this.meta = {};
    this.children = [];
    this.parent = parent;
  }
}

function findAssetByMesh(root, mesh) {
  for (const asset of root) {
    if (asset.mesh === mesh) return asset;

    const found = findAssetByMesh(asset.children, mesh);
    if (found) return found;
  }
  console.log("asset not found")
  return null;
}


function createAnnotationAsset(scene, type, gizmoManager, parent = null){
  
  let mesh = (type === "bbox")
    ? createBoundingBox(scene)
    : createHopper(scene);

  const asset = new AnnotationAsset(type, mesh, parent);

  asset.meta = {
    label: 0,
    instance: 0,
    note: "",
    size: DEFAULT_SIZE,
    type
  };

  if (parent) {
    parent.children.push(asset);
    // this makes the child follow the parent movements
    asset.mesh.position = parent.mesh.position.clone();
  } else {
    annotationAssets.push(asset);
  }

  

  refreshAnnotationOverview(gizmoManager)
  return asset;
}



function deleteAnnotationAsset(scene, gizmoManager){
  const asset = activeAnnotationAsset;
  if (!asset) return;

  // 🔥 determine correct container
  let container;

  if (asset.parent) {
    container = asset.parent.children;
  } else {
    container = annotationAssets;
  }

  const index = container.indexOf(asset);

  if (index !== -1) {
    container.splice(index, 1);
  } else {
    console.warn("Could not find asset in its container", asset);
  }

  // 🔥 recursively delete children (important!)
  function disposeRecursive(a) {
    a.children.forEach(child => disposeRecursive(child));
    a.mesh.dispose();
  }

  disposeRecursive(asset);

  gizmoManager.attachToMesh(null);
  activeAnnotationAsset = null;

  updateShaderBoxes();
  refreshAnnotationOverview(gizmoManager);
}

export function createHopper(scene){
  console.log("creating hopper")
  const default_size = DEFAULT_SIZE
  const plane = BABYLON.MeshBuilder.CreatePlane(
    "plane", 
    {size: default_size}, 
    scene
  );
  const mat = new BABYLON.StandardMaterial("bboxMat", scene);
  mat.wireframe = false;
  mat.alpha = 0.5;
  mat.emissiveColor = new BABYLON.Color3(0.5,0.5,0.9);
  mat.backFaceCulling = false;
  plane.material = mat;
  plane.enableEdgesRendering();
  plane.edgesWidth = 5.0;
  plane.edgesColor = new BABYLON.Color4(0.1, 0.8, 0.1, 0.5);
  
  return plane;

}




export function createBoundingBox(scene) {
  const default_size = DEFAULT_SIZE
  const bbox = BABYLON.MeshBuilder.CreateBox(
    "bbox",
    { size: default_size },
    scene
  );

  const mat = new BABYLON.StandardMaterial("bboxMat", scene);
  mat.wireframe = false;
  mat.alpha = 0.0;
  mat.emissiveColor = new BABYLON.Color3(0,0,0.9);

  bbox.material = mat;
  bbox.enableEdgesRendering();
  bbox.edgesWidth = 5.0;
  bbox.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.8, 0.5);

  return bbox;
}


export function deleteBoundingBox(gizmoManager){

  if (!activeBBox) return;

  // Remove from array
  const index = bboxes.indexOf(activeBBox);
  if (index !== -1) {
    bboxes.splice(index, 1);
  }

  // Dispose mesh
  activeBBox.dispose();

  // Detach gizmo
  gizmoManager.attachToMesh(null);

  // Clear selection
  activeBBox = null;

  // Update shader
  updateShaderBoxes();
  refreshAnnotationOverview(gizmoManager);
}



function dictAnnotation(annotation){
  
  const childStrings = annotation.children.map(child =>
    dictAnnotation(child)
  );

  const q = annotation.mesh.rotationQuaternion 
      ? annotation.mesh.rotationQuaternion 
      : BABYLON.Quaternion.FromEulerVector(annotation.mesh.rotation);

  return {
    type: annotation.type, 
    position: annotation.mesh.position.asArray(),
    rotationQuaternion: [q.x, q.y, q.z, q.w],
    scaling: annotation.mesh.scaling.asArray(),
    base_size: annotation.meta.size ?? 5,
    label: annotation.meta.label,
    instance: annotation.meta.instance,
    note: annotation.meta.note,
    children: childStrings
  };

}


export function saveAnnotations() {
  const data = annotationAssets.map(annotation => {
    return dictAnnotation(annotation)
  });
  console.log("constructed json string from", data);
  return JSON.stringify({ annotations: data }, null, 2);
}


function buildAnnotation(scene, data, gizmoManager, parent = null) {

  // create asset (returns asset + mesh)
  const asset = createAnnotationAsset(
    scene,
    data.type,
    gizmoManager,
    parent
  );

  const mesh = asset.mesh;

  // --- TRANSFORM ---
  mesh.position = new BABYLON.Vector3(...data.position);
  mesh.scaling = new BABYLON.Vector3(...data.scaling);

  mesh.rotationQuaternion = new BABYLON.Quaternion(
    ...data.rotationQuaternion
  );

  mesh.computeWorldMatrix(true);

  // --- METADATA ---
  asset.meta = {
    ...data, // includes label, instance, note, base_size
  };

  // --- CHILDREN ---
  if (data.children && data.children.length > 0) {
    data.children.forEach(childData => {
      buildAnnotation(scene, childData, gizmoManager, asset);
    });
  }

  return asset;
}


export function loadAnnotations(scene, jsonData, gizmoManager) {

  const parsed = typeof jsonData === "string"
    ? JSON.parse(jsonData)
    : jsonData;

  if (!parsed.annotations) return;

  // clear existing
  annotationAssets.length = 0;
  activeAnnotationAsset = null;

  // build tree
  parsed.annotations.forEach(data => {
    buildAnnotation(scene, data, gizmoManager, null);
  });

  refreshAnnotationOverview(gizmoManager);
  updateShaderBoxes();
}


function selectAnnotationAsset(annotationAsset, gizmoManager) {
  activeAnnotationAsset = annotationAsset;
  console.log(activeAnnotationAsset)
  console.log(annotationAsset)
  gizmoManager.attachToMesh(activeAnnotationAsset.mesh);
  updateBBoxMenuFromSelection();
  updateShaderBoxes();
}




export function updateShaderBoxes() {

  if (!pointMaterial) return;

  const matrices = [];
  const colors = [];

  const bboxes = collectByType(annotationAssets, "bbox");

  for (const asset of bboxes) {
    const bbox = asset.mesh;

    const inv = bbox.getWorldMatrix().clone().invert();
    matrices.push(inv);

    const c = CLASS_COLORS[asset.meta.label];

    colors.push(c[0], c[1], c[2]);   // flat array

  }

  pointMaterial.setMatrices("bboxInv", matrices);
  pointMaterial.setArray3("bboxColor", colors);
  pointMaterial.setInt("bboxCount", matrices.length);

}



function focusCameraSmooth(camera, bbox, scene) {
  
  bbox.computeWorldMatrix(true);

  const info = bbox.getBoundingInfo();
  const center = info.boundingBox.centerWorld;
  const radius = info.boundingSphere.radiusWorld;

  BABYLON.Animation.CreateAndStartAnimation(
    "camTarget",
    camera,
    "target",
    60,
    30,
    camera.target,
    center,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );

  BABYLON.Animation.CreateAndStartAnimation(
    "camRadius",
    camera,
    "radius",
    60,
    30,
    camera.radius,
    radius * 3,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
}
