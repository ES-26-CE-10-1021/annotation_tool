import vertexShader from "../shaders/pointCloud.vertex.glsl?raw";
import fragmentShader from "../shaders/pointCloud.fragment.glsl?raw";

BABYLON.Effect.ShadersStore["pointCloudVertexShader"] = vertexShader;
BABYLON.Effect.ShadersStore["pointCloudFragmentShader"] = fragmentShader;

const MAX_POINTS_PER_MESH = 10_000_000;

export let pointMeshes = [];
export let pointMaterial = null;

let currentPositions = [];
let currentNormals = [];
let currentColors = [];
let segData = [];
let instData = [];
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
        attributes: ["position", "normal", "color", "custom"],
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
  currentColors = [];
  currentPointCount = 0;
  segData = [];
  instData = [];

  pointMeshes.push(currentMesh);
}

export async function startStreaming(scene) {

  createNewMesh(scene);

  let chunk = 0;

  while (true) {

    const res = await fetch(`/api/points/${chunk}`);

    if (res.status === 204)
      break;


    const layout = JSON.parse(res.headers.get("X-Point-Layout"));
    const fields = layout.fields;
    const stride = fields.length;

    // build offsets once
    const offsets = Object.fromEntries(
      fields.map((f, i) => [f, i])
    );


    const buffer = await res.arrayBuffer();
    const data = new Float16Array(buffer);

    for (let i = 0; i < data.length; i += stride) {
      const x = data[i + offsets.x];
      const y = data[i + offsets.y];
      const z = data[i + offsets.z];
      currentPositions.push(x,y,z);

      currentNormals.push(
        data[i + offsets.nx],
        data[i + offsets.ny],
        data[i + offsets.nz]
      );

      cloudMin.x = Math.min(cloudMin.x, x);
      cloudMin.y = Math.min(cloudMin.y, y);
      cloudMin.z = Math.min(cloudMin.z, z);

      cloudMax.x = Math.max(cloudMax.x, x);
      cloudMax.y = Math.max(cloudMax.y, y);
      cloudMax.z = Math.max(cloudMax.z, z);

      if (offsets.r !== undefined) {
        const r = data[i + offsets.r];
        const g = data[i + offsets.g];
        const b = data[i + offsets.b];
        currentColors.push(r, g, b)
        // store if needed
      }

      currentPointCount++;

      // create new mesh if limit reached
      if (currentPointCount >= MAX_POINTS_PER_MESH) {

        updateMesh(scene);
        createNewMesh(scene);

      }
    }
    pointMaterial.setVector3("cloudMin", cloudMin);
    pointMaterial.setVector3("cloudMax", cloudMax);

    updateMesh(scene);
    
    chunk++;
  }
}

function updateMesh(scene) {

  const vertexData = new BABYLON.VertexData();
  
  const count = currentPositions.length / 3;

  vertexData.positions = currentPositions;
  vertexData.normals = currentNormals;


  if (currentColors.length === count * 3) {
    vertexData.colors = currentColors;
  } else {
    vertexData.colors = new Float32Array(count * 3).fill(1.0); // neutral fallback
  }

  const custom = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    custom[i * 3 + 0] = segData[i] ?? 0;
    custom[i * 3 + 1] = instData[i] ?? 0;
    custom[i * 3 + 2] = 0; // spare channel
  }

  currentMesh.setVerticesBuffer(
    new BABYLON.VertexBuffer(
      scene.getEngine(),
      custom,
      "custom",   // must match shader attribute name
      false,
      false,
      3           // vec3
    )
  );
  
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

      case "5":
        pointMaterial.setInt("coloringMode", 4);
        break

      case "6":
        pointMaterial.setInt("coloringMode", 5);
        break
      case "7":
        pointMaterial.setInt("coloringMode", 6);
        break
      case "8":
        pointMaterial.setInt("coloringMode", 7);
        break
    }

  });

}
