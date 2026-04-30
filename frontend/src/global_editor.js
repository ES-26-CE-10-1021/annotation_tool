import * as GUI from "@babylonjs/gui";
import { createScene } from "./scene.js";
import { startStreaming, setupKeyboard, pointMeshes } from "./point_cloud.js";
import {createAnnotationOverview, createAnnotationMenu, setupAnnotationPicking, updateShaderBoxes, uploadAnnotations, fetchAnnotations, setAnnotationUIVisible, setAnnotationMeshesVisible, globalAnnotations} from "./bbox_tool.js";

import { createScrubberMenu, setScrubberUIVisible, localMeshCache, clearLocalAnnotationMode} from "./local_viewer.js";


// ---- Engine + Scene ----
let engine;
let scene;
let camera;
export let gizmoManager;
let datasetMeta;


// ---- Mode state ----
let currentMode = "global";


// ---- Guards ----
let streamingActive = false;

// --------------------------------------------------
// Cleanup functions
// --------------------------------------------------

function clearGlobalMeshes() {
  console.log("Clearing global meshes");

  for (const mesh of pointMeshes) {
    mesh.dispose();
  }
  pointMeshes.length = 0;

  streamingActive = false;
}

function clearLocalMeshes() {
  console.log("Clearing local meshes");

  for (const mesh of localMeshCache.values()) {
    mesh.dispose();
  }
  localMeshCache.clear();
}

// --------------------------------------------------
// Local mode placeholder (you will expand this)
// --------------------------------------------------

function initLocalViewer(scene) {
  console.log("Initializing local viewer");
  createScrubberMenu(scene, datasetMeta);

  // TODO: replace with real local frame loading
  // This is just a placeholder so switching works
}

// --------------------------------------------------
// Mode switching
// --------------------------------------------------

function switchMode(mode) {
  if (mode === currentMode) return;

  console.log("Switching mode:", mode);

  if (mode === "global") {
    clearLocalMeshes();
    clearLocalAnnotationMode();
    setAnnotationUIVisible(true);
    setAnnotationMeshesVisible(true);
    setScrubberUIVisible(false);
    updateShaderBoxes(globalAnnotations.assets);
    if (!streamingActive) {
      startStreaming(scene);
      streamingActive = true;
    }
  }

  if (mode === "local") {
    setAnnotationUIVisible(false);
    setAnnotationMeshesVisible(false);
    setScrubberUIVisible(true);
    clearGlobalMeshes();
    initLocalViewer(scene);
  }

  // update URL
  const params = new URLSearchParams(window.location.search);
  params.set("mode", mode);
  window.history.replaceState({}, "", `?${params}`);

  currentMode = mode;
}


const refreshBoxes = () => {
  updateShaderBoxes(globalAnnotations.assets);
};


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

  const globalViewerBtn = GUI.Button.CreateSimpleButton("globalViewer", "global view")
  globalViewerBtn.width = "175px";
  globalViewerBtn.height = "90%";
  globalViewerBtn.color = "white";
  globalViewerBtn.thickness = 0;
  globalViewerBtn.background = "#555555";
  globalViewerBtn.cornerRadius = 5;
  globalViewerBtn.onPointerClickObservable.add(() => {
    switchMode("global");
  });
  panel.addControl(globalViewerBtn);

  const sequenceViewerBtn = GUI.Button.CreateSimpleButton("seqenceViewer", "sequential view")
  sequenceViewerBtn.width = "175px";
  sequenceViewerBtn.height = "90%";
  sequenceViewerBtn.color = "white";
  sequenceViewerBtn.thickness = 0;
  sequenceViewerBtn.background = "#555555";
  sequenceViewerBtn.cornerRadius = 5;
  sequenceViewerBtn.onPointerClickObservable.add(() => {
    switchMode("local");
  });
  panel.addControl(sequenceViewerBtn);

}


export function startGlobalEditor(container, meta) {
  console.log("entering global editior")
  container.style.paddingTop = "0px";
  container.innerHTML = "";
  datasetMeta = meta;

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

  const sceneData = createScene(engine, canvas);
  scene = sceneData.scene;
  camera = sceneData.camera;
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

  gizmoManager.gizmos.positionGizmo.onDragObservable.add(refreshBoxes);
  gizmoManager.gizmos.rotationGizmo.onDragObservable.add(refreshBoxes);
  gizmoManager.gizmos.scaleGizmo.onDragObservable.add(refreshBoxes);

  engine.runRenderLoop(() => {
    scene.render();
  });
}

