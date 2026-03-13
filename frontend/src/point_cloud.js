//
// export let pointPositions = [];
// export let pointColors = [];
// export let pointMesh = null;
//
// export async function startStreaming(scene) {
//
//   pointMesh = new BABYLON.Mesh("points", scene);
//
//   var material = new BABYLON.StandardMaterial("mat", scene);
//   material.pointsCloud = true;
//   material.pointSize = 0.1;
//
//   material.emissiveColor = new BABYLON.Color3(1,1,1);
//
//
//   material.useVertexColors = true;
//   material.disableLighting = true;
//
//   pointMesh.material = material;
//
//   let chunk = 0;
//
//   while (true) {
//
//     const res = await fetch(`/points/${chunk}`);
//
//     if (res.status === 204)
//       break;
//
//     const buffer = await res.arrayBuffer();
//     const data = new Float32Array(buffer);
//
//     for (let i = 0; i < data.length; i += 3) {
//
//       pointPositions.push(data[i]);
//       pointPositions.push(data[i+1]);
//       pointPositions.push(data[i+2]);
//
//       // default color = white
//       pointColors.push(0.5,0.5,0.5,1);
//     }
//
//     var vertexData = new BABYLON.VertexData();
//     vertexData.positions = pointPositions;
//     vertexData.colors = pointColors;
//
//
//     vertexData.applyToMesh(pointMesh, true);
//
//     chunk++;
//   }
// }
// import vertexShader from "../shaders/pointCloud.vertex.glsl?raw";
// import fragmentShader from "../shaders/pointCloud.fragment.glsl?raw";
// BABYLON.Effect.ShadersStore["pointCloudVertexShader"] = vertexShader;
// BABYLON.Effect.ShadersStore["pointCloudFragmentShader"] = fragmentShader;
// export let pointPositions = [];
// export let pointNormals = [];
// export let pointMesh = null;
// export let pointMaterial = null;
//
// export async function startStreaming(scene) {
//
//   pointMesh = new BABYLON.Mesh("points", scene);
//
//   // CUSTOM SHADER MATERIAL
//   pointMaterial = new BABYLON.ShaderMaterial(
//     "pointShader",
//     scene,
//     {
//       vertex: "pointCloud",
//       fragment: "pointCloud"
//     },
//     {
//       attributes: ["position", "normal"],
//       uniforms: [
//         "world",
//         "worldViewProjection",
//         "bboxInv",
//         "bboxColor",
//         "bboxCount"
//       ]
//     }
//   );
//   pointMaterial.pointSize = 0.1;
//   pointMaterial.pointsCloud = true;
//   pointMesh.material = pointMaterial;
//   let chunk = 0;
//
//   while (true) {
//
//     const res = await fetch(`/points/${chunk}`);
//
//     if (res.status === 204)
//       break;
//
//     const buffer = await res.arrayBuffer();
//     const data = new Float16Array(buffer);
//
//     for (let i = 0; i < data.length; i += 6) {
//
//       pointPositions.push(
//         data[i],
//         data[i+1],
//         data[i+2]
//       );
//
//       pointNormals.push(
//         data[i+3],
//         data[i+4],
//         data[i+5]
//       );
//
//     }
//
//     const vertexData = new BABYLON.VertexData();
//     vertexData.positions = pointPositions;
//     vertexData.normals = pointNormals;
//     vertexData.applyToMesh(pointMesh, true);
//
//     chunk++;
//   }
// }
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
          "bboxCount"
        ]
      }
    );

    pointMaterial.pointSize = 0.1;
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

    const res = await fetch(`/points/${chunk}`);

    if (res.status === 204)
      break;

    const buffer = await res.arrayBuffer();
    const data = new Float16Array(buffer);

    for (let i = 0; i < data.length; i += 6) {

      currentPositions.push(
        data[i],
        data[i+1],
        data[i+2]
      );

      currentNormals.push(
        data[i+3],
        data[i+4],
        data[i+5]
      );

      currentPointCount++;

      // create new mesh if limit reached
      if (currentPointCount >= MAX_POINTS_PER_MESH) {

        updateMesh();
        createNewMesh(scene);

      }
    }

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
