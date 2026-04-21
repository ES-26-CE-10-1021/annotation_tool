import * as GUI from "@babylonjs/gui";
import { createScene } from "./scene.js";
import { startStreaming, setupKeyboard } from "./point_cloud.js";
import {createAnnotationOverview, createAnnotationMenu, setupAnnotationPicking, updateShaderBoxes, uploadAnnotations, fetchAnnotations} from "./bbox_tool.js";

let engine;

function createTopMenu(scene){
  const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
  const rect = new GUI.Rectangle();
  rect.width = "100%";
  rect.height = "5%";
  rect.background = "#333333";
  rect.color = "#333333"; 
  rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  rect.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(rect);


  const panel = new GUI.StackPanel();
  panel.isVertical = false;
  panel.height = "100%";
  panel.width = "100%";
  panel.paddingLeft = "10px";
  panel.spacing = 10;

  rect.addControl(panel);
  const saveBtn = GUI.Button.CreateSimpleButton("save", "save 💾");
  
  saveBtn.width = "75px";
  saveBtn.height = "90%";
  saveBtn.color = "white";
  saveBtn.thickness = 0;
  saveBtn.background = "#555555";
  saveBtn.cornerRadius = 5;

  
  saveBtn.onPointerClickObservable.add(() => {
    console.log("attempting to save bounding boxes")
    uploadAnnotations();
  });

  panel.addControl(saveBtn);


}


export function startGlobalEditor(container) {
  console.log("entering global editior")
  container.style.paddingTop = "0px";
  container.innerHTML = "";

  const root = document.createElement("div");
  root.style = `
    position: relative;
    width: 100%;
    height: 100%;
  `;

  const canvas = document.createElement("canvas");
  canvas.id = "renderCanvas";
  canvas.style = `
    width: 100%;
    height: 100%;
    display: block;
  `;
  
  root.appendChild(canvas);
  container.appendChild(root);

  if (engine) {
    engine.dispose();
  }
  
  engine = new BABYLON.Engine(canvas, true, {
    adaptToDeviceRatio: true
  });

  const { scene, camera } = createScene(engine, canvas);

  const gizmoManager = new BABYLON.GizmoManager(scene);

  setupAnnotationPicking(scene, gizmoManager);

  gizmoManager.positionGizmoEnabled = true;
  gizmoManager.rotationGizmoEnabled = true;
  gizmoManager.scaleGizmoEnabled = true;
  gizmoManager.boundingBoxGizmoEnabled = false;

  gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  gizmoManager.clearGizmoOnEmptyPointerEvent = true;

  console.log("starting point stream")
  startStreaming(scene);
  
  fetchAnnotations(scene, gizmoManager);
  
  setupKeyboard(scene);
  createAnnotationMenu(scene, gizmoManager);
  createAnnotationOverview(scene, gizmoManager, camera);

  createTopMenu(scene);

  gizmoManager.gizmos.positionGizmo.onDragObservable.add(updateShaderBoxes);
  gizmoManager.gizmos.rotationGizmo.onDragObservable.add(updateShaderBoxes);
  gizmoManager.gizmos.scaleGizmo.onDragObservable.add(updateShaderBoxes);

  engine.runRenderLoop(() => {
    scene.render();
  });
}
