
export function createScene(engine, canvas) {

  const scene = new BABYLON.Scene(engine);

  scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
  scene.fogDensity = 0.001;

  scene.clearColor = new BABYLON.Color4(0.8, 0.8, 0.9, 1.0);

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    30,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.upVector = new BABYLON.Vector3(0, 0, 1);
  camera.attachControl(canvas, true);

  const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );


  return scene;
}
