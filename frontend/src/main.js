//
// import { createScene } from "./scene.js";
// import { startStreaming } from "./point_cloud.js";
// import { createBoundingBox, setupBBoxPicking } from "./bbox_tool.js";
//
//
// const canvas = document.getElementById("renderCanvas");
//
// const engine = new BABYLON.Engine(canvas, true);
//
// const scene = createScene(engine, canvas);
// const gizmoManager = new BABYLON.GizmoManager(scene);
// setupBBoxPicking(scene, gizmoManager);
//
//
// gizmoManager.positionGizmoEnabled = true;
// gizmoManager.rotationGizmoEnabled = true;
// gizmoManager.scaleGizmoEnabled = true;
// gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
// gizmoManager.clearGizmoOnEmptyPointerEvent = false;
// startStreaming(scene);
//
//
// document.getElementById("bboxBtn").onclick = () => {
//   createBoundingBox(scene, gizmoManager);
// };
//
//
// engine.runRenderLoop(() => {
//   scene.render();
// });
import { createScene } from "./scene.js";
import { startStreaming, pointMeshes } from "./point_cloud.js";
import { createBoundingBox, setupBBoxPicking } from "./bbox_tool.js";

const canvas = document.getElementById("renderCanvas");

const engine = new BABYLON.Engine(canvas, true);

const scene = createScene(engine, canvas);

const gizmoManager = new BABYLON.GizmoManager(scene);

setupBBoxPicking(scene, gizmoManager);

gizmoManager.positionGizmoEnabled = true;
gizmoManager.rotationGizmoEnabled = true;
gizmoManager.scaleGizmoEnabled = true;

gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
gizmoManager.clearGizmoOnEmptyPointerEvent = false;

startStreaming(scene);

document.getElementById("bboxBtn").onclick = () => {
  createBoundingBox(scene, gizmoManager);
};

engine.runRenderLoop(() => {

  if (window.updateBBoxShader)
    window.updateBBoxShader();

  scene.render();

});
