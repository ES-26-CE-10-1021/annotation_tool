import { pointMaterial } from "./point_cloud.js";
import * as GUI from "@babylonjs/gui";
import { CONFIG } from "./config.js";

let labelGroup;
let instanceInput;
let instanceLabel;
let noteInput;
let bboxOverviewPanel; 
let cameraRef = null;
let sceneRef = null; 

let labelIdToName;


const CLASS_COLORS = {
  0:[0.5,0.5,0.5],
  1:[1,0,0],
  2:[0,1,0],
  3:[0,0,1],
  4:[1,1,0],
  5:[1,0,1],
  6:[0,1,1]
};


export async function fetchBoundingBoxes(scene, gizmoManager) {
  const res = await fetch("/api/bboxes");
  const data = await res.json();

  loadBoundingBoxes(scene, data, gizmoManager);
}

export async function uploadBoundingBoxes() {

  const json = saveBoundingBoxes();
  console.log(json)
  await fetch("/api/bboxes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: json
  });
}


function groupBBoxesByLabel() {

  const groups = new Map();

  bboxes.forEach(bbox => {
    const label = bbox.metadata.label;

    if (!groups.has(label)) {
      groups.set(label, []);
    }

    groups.get(label).push(bbox);
  });

  return groups;
}

export function createBBoxOverview(scene, gizmoManager, camera) {
  const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
  const panel = new GUI.StackPanel(); 
  panel.width = "150px";
  panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
  panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  gui.addControl(panel);

  cameraRef = camera; 
  sceneRef = scene;

  // store panel so we can update it later
  bboxOverviewPanel = panel;

  labelIdToName = Object.fromEntries(
    Object.entries(CONFIG.frontend.label_dict).map(([k, v]) => [v, k])
  );
  refreshBBoxOverview(gizmoManager);


}



function refreshBBoxOverview(gizmoManager) {

  if (!bboxOverviewPanel) return;

  bboxOverviewPanel.clearControls();

  const groups = groupBBoxesByLabel();

  groups.forEach((boxes, labelId) => {

    // 🔹 Group title
    const header = new GUI.TextBlock();
    header.text = labelIdToName[labelId] || `Label ${labelId}`;
    header.height = "30px";
    header.color = "white";
    header.fontSize = 16;
    header.paddingTop = "10px";
    header.blur; 

    bboxOverviewPanel.addControl(header);

    // 🔹 Buttons inside group
    boxes.forEach((bbox, index) => {

      const btn = GUI.Button.CreateSimpleButton(
        "bbox_" + index,
        `#${bbox.metadata.instance ?? index}`
      );

      btn.height = "30px";
      btn.color = "white";
      btn.background = (bbox === activeBBox) ? "#00aa00" : "#444444";

      btn.onPointerClickObservable.add(() => {
        selectBBox(bbox, gizmoManager);
        focusCameraSmooth(cameraRef, bbox, sceneRef);
      });

      bboxOverviewPanel.addControl(btn);
    });

  });
}

export function createBBoxMenu(scene) {

  const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

  const panel = new GUI.StackPanel();
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

      if(state && activeBBox){

        activeBBox.metadata.label = l.id;
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

    if(activeBBox){

      activeBBox.metadata.instance = parseInt(instanceInput.text);

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
    if(activeBBox){
      activeBBox.metadata.note = noteInput.text;
    }
  });
  panel.addControl(noteInput);
}


// function updateBBoxMenuFromSelection() {
//
//   if (!activeBBox) return;
//
//   // Label
//   if (labelGroup){
//     labelGroup.selectors.forEach(selector => {
//       selector.isChecked = (
//         selector._labelId === activeBBox.metadata.label
//       );
//     });
//   }
//
//   // Instance
//   if (instanceInput){
//     instanceInput.text = String(activeBBox.metadata.instance ?? "");
//   }
//
//   // Note
//   if (noteInput){
//     noteInput.text = activeBBox.metadata.note ?? "";
//   }
// }

function updateBBoxMenuFromSelection() {

  if (!activeBBox || !labelGroup) return;

  const label = activeBBox.metadata.label;

  const target = labelGroup.selectors.find(
    s => s._labelId === label
  );

  if (target) {
    target.isChecked = true; 
  }

  // Instance
  if (instanceInput){
    instanceInput.text = String(activeBBox.metadata.instance ?? "");
  }

  // Note
  if (noteInput){
    noteInput.text = activeBBox.metadata.note ?? "";
  }
}


const bboxes = [];
let activeBBox = null;

export function setupBBoxPicking(scene, gizmoManager) {

  scene.onPointerObservable.add((pointerInfo) => {

    if(pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN)
      return;

    const pick = scene.pick(scene.pointerX, scene.pointerY);

    if(!pick.hit)
      return;

    if(pick.pickedMesh && pick.pickedMesh.name === "bbox") {

      selectBBox(pick.pickedMesh, gizmoManager);
      refreshBBoxOverview(gizmoManager);
    }

  });

}


export function createBoundingBox(scene, gizmoManager) {
  const default_size = 5
  const bbox = BABYLON.MeshBuilder.CreateBox(
    "bbox",
    { size: default_size },
    scene
  );

  const mat = new BABYLON.StandardMaterial("bboxMat", scene);
  mat.wireframe = true;
  mat.emissiveColor = new BABYLON.Color3(1,0,0);

  bbox.material = mat;

  bboxes.push(bbox);
  bbox.metadata = {
    label: 1,
    instance: 0,
    note: "",
    size:default_size
  };
  selectBBox(bbox, gizmoManager);
  // gizmoManager.gizmos.positionGizmo.onDragObservable.add(updateShaderBoxes);
  // gizmoManager.gizmos.rotationGizmo.onDragObservable.add(updateShaderBoxes);
  // gizmoManager.gizmos.scaleGizmo.onDragObservable.add(updateShaderBoxes);
  refreshBBoxOverview(gizmoManager);
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
  refreshBBoxOverview(gizmoManager);
}

export function saveBoundingBoxes() {

  const data = bboxes.map(bbox => {

    const q = bbox.rotationQuaternion 
      ? bbox.rotationQuaternion 
      : BABYLON.Quaternion.FromEulerVector(bbox.rotation);

    return {
      position: bbox.position.asArray(),
      rotationQuaternion: [q.x, q.y, q.z, q.w],
      scaling: bbox.scaling.asArray(),
      base_size: bbox.size ?? 5,
      label: bbox.metadata.label,
      instance: bbox.metadata.instance,
      note: bbox.metadata.note
    };
  });

  return JSON.stringify({ bboxes: data }, null, 2);
}



export function loadBoundingBoxes(scene, jsonData, gizmoManager) {

  const parsed = typeof jsonData === "string"
    ? JSON.parse(jsonData)
    : jsonData;

  const mat = new BABYLON.StandardMaterial("bboxMat", scene);
  mat.wireframe = true;
  mat.emissiveColor = new BABYLON.Color3(1,0,0);

  for (const item of parsed.bboxes) {
    const size = item.base_size ?? 1;

    const bbox = BABYLON.MeshBuilder.CreateBox(
      "bbox",
      { size: size },
      scene
    );
      
    bbox.material = mat;

    bbox.position = new BABYLON.Vector3(...item.position);
    bbox.scaling = new BABYLON.Vector3(...item.scaling);

    bbox.rotationQuaternion = new BABYLON.Quaternion(
      ...item.rotationQuaternion
    );
    bbox.computeWorldMatrix(true);
    // IMPORTANT: clear Euler rotation
    // bbox.rotation = BABYLON.Vector3.Zero();

    bbox.metadata = {
      size: size,
      label: item.label,
      instance: item.instance,
      note: item.note
    };
    selectBBox(bbox, gizmoManager);
    bboxes.push(bbox);
  }
  refreshBBoxOverview(gizmoManager);
  updateShaderBoxes();
}



function selectBBox(bbox, gizmoManager) {
  activeBBox = bbox;
  gizmoManager.attachToMesh(bbox);
  updateBBoxMenuFromSelection();
  updateShaderBoxes();
}




export function updateShaderBoxes() {

  if (!pointMaterial) return;

  const matrices = [];
  const colors = [];

  for (const bbox of bboxes) {

    const inv = bbox.getWorldMatrix().clone().invert();
    matrices.push(inv);

    const c = CLASS_COLORS[bbox.metadata.label];

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
