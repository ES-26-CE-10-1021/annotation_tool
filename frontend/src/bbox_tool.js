import { pointMaterial } from "./point_cloud.js";
import * as GUI from "@babylonjs/gui";





const CLASS_COLORS = {
  0:[0.5,0.5,0.5],
  1:[1,0,0],
  2:[0,1,0],
  3:[0,0,1],
  4:[1,1,0],
  5:[1,0,1],
  6:[0,1,1]
};


function createBBoxMenu(scene) {

  const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

  const panel = new GUI.StackPanel();
  panel.width = "260px";
  panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  panel.paddingTop = "20px";
  panel.paddingLeft = "10px";
  panel.spacing = 10;

  gui.addControl(panel);

  // TITLE
  const title = new GUI.TextBlock();
  title.text = "Bounding Box Annotation";
  title.height = "30px";
  title.color = "white";
  title.fontSize = 20;

  panel.addControl(title);

  // -----------------------------
  // LABEL SELECTOR
  // -----------------------------

  const labelTitle = new GUI.TextBlock();
  labelTitle.text = "Label";
  labelTitle.height = "25px";
  labelTitle.color = "white";

  panel.addControl(labelTitle);

  const labelGroup = new GUI.RadioGroup("labels");

  const labels = [
    {name:"Background", id:0},
    {name:"Tractor", id:1},
    {name:"Harvester", id:2},
    {name:"Trailer", id:3},
    {name:"Car", id:4},
    {name:"Building", id:5},
    {name:"Tree", id:6}
  ];

  labels.forEach(l => {

    labelGroup.addRadio(l.name, (state)=>{

      if(state && activeBBox){

        activeBBox.metadata.label = l.id;
        updateShaderBoxes();

      }

    });

  });

  const selector = new GUI.SelectionPanel("labelPanel");
  selector.height = "280px";
  selector.addGroup(labelGroup);

  panel.addControl(selector);

  // -----------------------------
  // INSTANCE ID
  // -----------------------------

  const instanceLabel = new GUI.TextBlock();
  instanceLabel.text = "Instance ID";
  instanceLabel.height = "25px";
  instanceLabel.color = "white";

  panel.addControl(instanceLabel);

  const instanceInput = new GUI.InputText();
  instanceInput.height = "35px";
  instanceInput.width = "240px";
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

  const noteInput = new GUI.InputText();
  noteInput.height = "40px";
  noteInput.width = "240px";
  noteInput.color = "white";
  noteInput.background = "#333333";

  noteInput.onTextChangedObservable.add(()=>{

    if(activeBBox){

      activeBBox.metadata.note = noteInput.text;

    }

  });

  panel.addControl(noteInput);

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

    }

  });

}
export function createBoundingBox(scene, gizmoManager) {

  const bbox = BABYLON.MeshBuilder.CreateBox(
    "bbox",
    { size: 5 },
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
    note: ""
  };
  selectBBox(bbox, gizmoManager);
  gizmoManager.gizmos.positionGizmo.onDragObservable.add(updateShaderBoxes);
  gizmoManager.gizmos.rotationGizmo.onDragObservable.add(updateShaderBoxes);
  gizmoManager.gizmos.scaleGizmo.onDragObservable.add(updateShaderBoxes);
  createBBoxMenu(scene);
}

function selectBBox(bbox, gizmoManager) {

  activeBBox = bbox;

  gizmoManager.attachToMesh(bbox);

  updateShaderBoxes();
}




function updateShaderBoxes() {

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

