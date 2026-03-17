import { createScene } from "./scene.js";
import { startStreaming, pointMeshes, setupKeyboard } from "./point_cloud.js";
import { createBoundingBox, setupBBoxPicking, deleteBoundingBox, saveBoundingBoxes, uploadBoundingBoxes, fetchBoundingBoxes } from "./bbox_tool.js";
import { loadConfig, CONFIG } from "./config.js";


loadConfig();
const canvas = document.getElementById("renderCanvas");

const engine = new BABYLON.Engine(canvas, true);

const scene = createScene(engine, canvas);

const gizmoManager = new BABYLON.GizmoManager(scene);


setupBBoxPicking(scene, gizmoManager);

gizmoManager.positionGizmoEnabled = true;
gizmoManager.rotationGizmoEnabled = true;
gizmoManager.scaleGizmoEnabled = true;
gizmoManager.boundingBoxGizmoEnabled = false;

gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
gizmoManager.clearGizmoOnEmptyPointerEvent = true;

startStreaming(scene);
setupKeyboard(scene);
fetchBoundingBoxes(scene, gizmoManager)


document.getElementById("bboxBtn").onclick = () => {
  createBoundingBox(scene, gizmoManager);
};

document.getElementById("rmBboxBtn").onclick = () => {
  deleteBoundingBox(gizmoManager);
}


document.getElementById("saveBboxBtn").onclick = () => {
  uploadBoundingBoxes();
}



engine.runRenderLoop(() => {

  if (window.updateBBoxShader)
    window.updateBBoxShader();

  scene.render();

});
