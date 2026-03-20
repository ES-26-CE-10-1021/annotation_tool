import { createScene } from "./scene.js";
import { startStreaming, setupKeyboard } from "./point_cloud.js";
import {createBBoxOverview, createBBoxMenu, createBoundingBox, setupBBoxPicking, deleteBoundingBox, uploadBoundingBoxes, fetchBoundingBoxes, updateShaderBoxes } from "./bbox_tool.js";

export function startGlobalEditor() {
  console.log("entering global editior")
  const canvas = document.getElementById("renderCanvas");

  const engine = new BABYLON.Engine(canvas, true);
  engine.adaptToDeviceRatio = true;

  const { scene, camera } = createScene(engine, canvas);

  const gizmoManager = new BABYLON.GizmoManager(scene);

  setupBBoxPicking(scene, gizmoManager);

  gizmoManager.positionGizmoEnabled = true;
  gizmoManager.rotationGizmoEnabled = true;
  gizmoManager.scaleGizmoEnabled = true;
  gizmoManager.boundingBoxGizmoEnabled = false;

  gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  gizmoManager.clearGizmoOnEmptyPointerEvent = true;

  console.log("starting point stream")
  startStreaming(scene);
  
  fetchBoundingBoxes(scene, gizmoManager);
  
  setupKeyboard(scene);
  createBBoxMenu(scene);
  createBBoxOverview(scene, gizmoManager, camera);

  gizmoManager.gizmos.positionGizmo.onDragObservable.add(updateShaderBoxes);
  gizmoManager.gizmos.rotationGizmo.onDragObservable.add(updateShaderBoxes);
  gizmoManager.gizmos.scaleGizmo.onDragObservable.add(updateShaderBoxes);

  document.getElementById("bboxBtn").onclick = () => {
    createBoundingBox(scene, gizmoManager);
  };

  document.getElementById("rmBboxBtn").onclick = () => {
    deleteBoundingBox(gizmoManager);
  };

  document.getElementById("saveBboxBtn").onclick = () => {
    uploadBoundingBoxes();
  };

  engine.runRenderLoop(() => {
    scene.render();
  });
}
