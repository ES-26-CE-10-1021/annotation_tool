import vertexShader from "../shaders/pointCloud.vertex.glsl?raw";
import fragmentShader from "../shaders/pointCloud.fragment.glsl?raw";

BABYLON.Effect.ShadersStore["pointCloudVertexShader"] = vertexShader;
BABYLON.Effect.ShadersStore["pointCloudFragmentShader"] = fragmentShader;

const MAX_POINTS_PER_MESH = 10_000_000;

export let pointMeshes = [];
export let pointMaterial = null;

let currentPositions = [];
let currentNormals = [];
let currentPointCount = 0;
let currentMesh = null;
let showNormals = true; 
let pointSize = 1;
let cloudMin = new BABYLON.Vector3(Infinity, Infinity, Infinity);
let cloudMax = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
function createNewMesh(scene) {

  currentMesh = new BABYLON.Mesh("points_" + pointMeshes.length, scene);
  console.log("creating new meash to contain all the points")
  if (!pointMaterial) {
    pointMaterial = new BABYLON.ShaderMaterial(
      "pointShader",
      scene,
      {
        vertex: "pointCloud",
        fragment: "pointCloud"
      },
      {
        attributes: ["position", "normal"],
        uniforms: [
          "world",
          "worldViewProjection",
          "bboxInv",
          "bboxColor",
          "bboxCount",
          "pointSize",
          "showNormals",
          "coloringMode",
          "cloudMin",
          "cloudMax",
        ]
      }
    );

    pointMaterial.setFloat("pointSize", pointSize);
    pointMaterial.setVector3("cloudMin", cloudMin);
    pointMaterial.setVector3("cloudMax", cloudMax);
    pointMaterial.pointsCloud = true;
  }

  currentMesh.material = pointMaterial;

  currentPositions = [];
  currentNormals = [];
  currentPointCount = 0;

  pointMeshes.push(currentMesh);
}

export async function startStreaming(scene) {

  createNewMesh(scene);

  let chunk = 0;

  while (true) {

    const res = await fetch(`/api/points/${chunk}`);

    if (res.status === 204)
      break;

    const buffer = await res.arrayBuffer();
    const data = new Float16Array(buffer);

    for (let i = 0; i < data.length; i += 6) {
      const x = data[i];
      const y = data[i+1];
      const z = data[i+2];
      currentPositions.push(x, y, z);

      currentNormals.push(
        data[i+3],
        data[i+4],
        data[i+5]
      );

      cloudMin.x = Math.min(cloudMin.x, x);
      cloudMin.y = Math.min(cloudMin.y, y);
      cloudMin.z = Math.min(cloudMin.z, z);

      cloudMax.x = Math.max(cloudMax.x, x);
      cloudMax.y = Math.max(cloudMax.y, y);
      cloudMax.z = Math.max(cloudMax.z, z);

      currentPointCount++;

      // create new mesh if limit reached
      if (currentPointCount >= MAX_POINTS_PER_MESH) {

        updateMesh();
        createNewMesh(scene);

      }
    }
    pointMaterial.setVector3("cloudMin", cloudMin);
    pointMaterial.setVector3("cloudMax", cloudMax);

    updateMesh();
    
    chunk++;
  }
}

function updateMesh() {

  const vertexData = new BABYLON.VertexData();

  vertexData.positions = currentPositions;
  vertexData.normals = currentNormals;

  vertexData.applyToMesh(currentMesh, true);
}




export function setupKeyboard(scene) {

  scene.onKeyboardObservable.add((kbInfo) => {

    if (kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN)
      return;

    switch (kbInfo.event.key) {

      case "+":
      case "=":
        pointSize += 0.2;
        pointMaterial.setFloat("pointSize", pointSize);
        console.log("pointSize:", pointSize);
        break;

      case "-":
        pointSize = Math.max(0.1, pointSize - 0.2);
        pointMaterial.setFloat("pointSize", pointSize);
        console.log("pointSize:", pointSize);
        break;

      case "n":
      case "N":
        showNormals = !showNormals;
        pointMaterial.setInt("showNormals", showNormals ? 1 : 0);
        console.log("showNormals:", showNormals);
        break;

      case "1":
        pointMaterial.setInt("coloringMode", 0);
        break;

      case "2":
        pointMaterial.setInt("coloringMode", 1);
        break;

      case "3":
        pointMaterial.setInt("coloringMode", 2);
        break;

      case "4":
        pointMaterial.setInt("coloringMode", 3);
        break;
    }

  });

}
