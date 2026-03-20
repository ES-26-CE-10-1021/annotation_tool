import { createScene } from "./scene.js";
import { startStreaming, pointMeshes, setupKeyboard } from "./point_cloud.js";
import {createBBoxOverview, createBBoxMenu, createBoundingBox, setupBBoxPicking, deleteBoundingBox, saveBoundingBoxes, uploadBoundingBoxes, fetchBoundingBoxes, updateShaderBoxes } from "./bbox_tool.js";
import { loadConfig, CONFIG } from "./config.js";

import { startGlobalEditor } from "./global_editor.js";


import { createDatasetSelector } from "./dataset_selection.js";


await loadConfig();



createDatasetSelector(() => {
  startGlobalEditor();
});


// const canvas = document.getElementById("renderCanvas");
//
// const engine = new BABYLON.Engine(canvas, true);
//
// engine.adaptToDeviceRatio = true;
// const {scene, camera} = createScene(engine, canvas);
//
// const gizmoManager = new BABYLON.GizmoManager(scene);
//
//
//
// setupBBoxPicking(scene, gizmoManager);
//
//
// gizmoManager.positionGizmoEnabled = true;
// gizmoManager.rotationGizmoEnabled = true;
// gizmoManager.scaleGizmoEnabled = true;
// gizmoManager.boundingBoxGizmoEnabled = false;
//
// gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
// gizmoManager.clearGizmoOnEmptyPointerEvent = true;
//
// startStreaming(scene);
// setupKeyboard(scene);
// createBBoxMenu(scene);
// fetchBoundingBoxes(scene, gizmoManager);
// createBBoxOverview(scene, gizmoManager, camera)
//
// gizmoManager.gizmos.positionGizmo.onDragObservable.add(updateShaderBoxes);
// gizmoManager.gizmos.rotationGizmo.onDragObservable.add(updateShaderBoxes);
// gizmoManager.gizmos.scaleGizmo.onDragObservable.add(updateShaderBoxes);
// document.getElementById("bboxBtn").onclick = () => {
//   createBoundingBox(scene, gizmoManager);
// };
//
// document.getElementById("rmBboxBtn").onclick = () => {
//   deleteBoundingBox(gizmoManager);
// }
//
//
// document.getElementById("saveBboxBtn").onclick = () => {
//   uploadBoundingBoxes();
// }
//
//
//
// engine.runRenderLoop(() => {
//
//   if (window.updateBBoxShader)
//     window.updateBBoxShader();
//
//   scene.render();
//
// });
