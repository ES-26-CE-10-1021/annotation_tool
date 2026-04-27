

import * as GUI from "@babylonjs/gui";
import { pointMaterial } from "./point_cloud.js";

let scrubberMenuPanel = null;
let scrubberMenuContainer = null;
let currentViewIndex = 0;

let scrubberUI = null;



const localMeshCache = new Map(); // index -> mesh
const CACHE_WINDOW = 30;

const MAX_CONCURRENT = 4;
let activeRequests = 0;

const fetchQueue = [];
const pendingSet = new Set();

let currentVisibleIndex = null;
let sceneRef = null;

let playbackInterval = null;
let isPlaying = false;
let suppressSlider = false;

let requestToken = 0;

let queueDirty = false;

let currentLocalMesh = null;

let indexLabel = null;

export function createScrubberMenu(scene, datasetMeta) {
  if (scrubberUI) return;
  scrubberUI = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
  sceneRef = scene;
  // ---- Container (controls size + position) ----
  scrubberMenuContainer = new GUI.Rectangle();
  const container = scrubberMenuContainer;
  container.width = "100%";
  container.height = "80px";
  container.thickness = 0;
  container.background = "#222222cc";

  container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

  scrubberUI.addControl(container);

  // ---- Panel (layout inside container) ----
  scrubberMenuPanel = new GUI.StackPanel();
  scrubberMenuPanel.isVertical = false;
  scrubberMenuPanel.height = "100%";
  scrubberMenuPanel.width = "100%";
  scrubberMenuPanel.paddingLeft = "10px";
  scrubberMenuPanel.paddingRight = "10px";
  scrubberMenuPanel.spacing = 10;

  container.addControl(scrubberMenuPanel);

  // ---- Play button ----
  const playBtn = GUI.Button.CreateSimpleButton("playButton", "▶");
  styleButton(playBtn);

  // ---- Pause button ----
  const pauseBtn = GUI.Button.CreateSimpleButton("pauseButton", "▐▐");
  styleButton(pauseBtn);

  // ---- Slider ----
  const slider = new GUI.Slider("sequenceSlider");
  slider.minimum = 0;
  slider.maximum = datasetMeta.max_index; // you’ll update this dynamically
  slider.value = 0;
  slider.height = "40px";
  slider.width = "80%";
  slider.color = "white";
  slider.background = "#555555";
  
  // ---- Slider container (takes remaining space) ----
  const sliderContainer = new GUI.Rectangle();
  sliderContainer.width = "80%";
  sliderContainer.height = "100%";
  sliderContainer.thickness = 0;

  // center slider inside container
  slider.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  slider.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

  sliderContainer.addControl(slider);

  indexLabel = new GUI.TextBlock();
  indexLabel.text = "0";
  indexLabel.width = "80px";
  indexLabel.height = "40px";
  indexLabel.color = "white";
  // indexLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
  // indexLabel.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;


  slider.onValueChangedObservable.add(async (value) => {
    if (suppressSlider) return;

    const token = ++requestToken;

    currentViewIndex = Math.floor(value);
    indexLabel.text = String(currentViewIndex);

    enqueueFetch(currentViewIndex, 100);

    while (!localMeshCache.has(currentViewIndex)) {
      await new Promise(r => setTimeout(r, 10));
    }

    if (token !== requestToken) return; // stale

    setVisible(currentViewIndex);
  });

  // ---- Button behavior ----
  playBtn.onPointerClickObservable.add(() => {
    console.log("Play");
    startPlayback(slider);
  });

  pauseBtn.onPointerClickObservable.add(() => {
    console.log("Pause");
    stopPlayback();
  });




  // ---- Add controls ----
  scrubberMenuPanel.addControl(playBtn);
  scrubberMenuPanel.addControl(pauseBtn);
  scrubberMenuPanel.addControl(sliderContainer);
  scrubberMenuPanel.addControl(indexLabel);
}

function styleButton(btn) {
  btn.width = "70px";
  btn.height = "80%";        
  btn.color = "white";       
  btn.thickness = 0;         
  btn.background = "#555555";
  btn.cornerRadius = 5;
}



async function startPlayback(slider) {
  if (isPlaying) return;

  isPlaying = true;

  while (isPlaying) {
    let next = currentViewIndex + 1;

    if (next > slider.maximum) {
      isPlaying = false;
      break;
    }

    enqueueFetch(next, 100);
    //
    // while (!localMeshCache.has(next)) {
    //   await new Promise(r => setTimeout(r, 10));
    // }
    const start = performance.now();

    while (!localMeshCache.has(next)) {
      await new Promise(r => setTimeout(r, 16));

      if (performance.now() - start > 3000) {
        console.warn("Timeout waiting for frame", next);
        break;
      }
    }



    setVisible(next);
    prefetchNeighbors(next);
    suppressSlider = true;
    slider.value = next;
    suppressSlider = false;
    currentViewIndex = next;
    indexLabel.text = String(next);
    trimQueue(next);
  }
}

function stopPlayback() {
  isPlaying = false;
}

export function setScrubberUIVisible(visible) {
  if (scrubberUI) {
    scrubberUI.rootContainer.isVisible = visible;
  }
}


export async function loadLocalPointCloud(scene, index, isPrefetch = false) {

  sceneRef = scene;

  // already cached
  if (localMeshCache.has(index)) {
    if (!isPrefetch){
      setVisible(index);
      prefetchNeighbors(index);
    }
    pruneCache(index);
    return;
  }

  console.log("Fetching local point cloud:", index);

  const res = await fetch(`/api/local_points/${index}`);
  if (!res.ok) {
    console.error("Failed to fetch local point cloud");
    return;
  }

  const buffer = await res.arrayBuffer();
  const data = new Float16Array(buffer);

  const pointCount = data.length / 3;

  // ---- Typed arrays (efficient) ----
  const positions = new Float32Array(pointCount * 3);
  const normals   = new Float32Array(pointCount * 3); // dummy normals

  for (let i = 0; i < data.length; i += 3) {
    positions[i]     = data[i];
    positions[i + 1] = data[i + 1];
    positions[i + 2] = data[i + 2];

    // dummy normal (0,0,0)
    normals[i]     = 0;
    normals[i + 1] = 1;
    normals[i + 2] = 0;
  }

  // // ---- Remove previous mesh ----
  // if (currentLocalMesh) {
  //   currentLocalMesh.dispose();
  //   currentLocalMesh = null;
  // }

  // ---- Create mesh ----
  const mesh = new BABYLON.Mesh(`local_${index}`, scene);

  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh, true);

  
  mesh.material = pointMaterial;
  mesh.setEnabled(false); // start hidden

  localMeshCache.set(index, mesh);

  pruneCache(index);
  if (!isPrefetch){
    setVisible(index);
    prefetchNeighbors(index)
  }
}



function enqueueFetch(index, priority = 0) {
  if (localMeshCache.has(index)) return;
  if (pendingSet.has(index)) return;

  fetchQueue.push({ index, priority });
  pendingSet.add(index);
  queueDirty = true;
  // sort by priority (higher first)
  // fetchQueue.sort((a, b) => b.priority - a.priority);

  processQueue();
}



async function processQueue() {
  if (queueDirty) {
    fetchQueue.sort((a, b) => b.priority - a.priority);
    queueDirty = false;
  }

  while (activeRequests < MAX_CONCURRENT && fetchQueue.length > 0) {
    const { index } = fetchQueue.shift();

    activeRequests++;

    (async () => {
      try {
        await loadLocalPointCloud(sceneRef, index, true);
      } finally {
        activeRequests--;
        pendingSet.delete(index);
        processQueue(); // keep draining
      }
    })();
  }
}


function setVisible(index) {
  for (const [i, mesh] of localMeshCache) {
    mesh.setEnabled(i === index);
  }
  currentVisibleIndex = index;
}

// function pruneCache(center) {
//   for (const [i, mesh] of localMeshCache) {
//     if (Math.abs(i - center) > CACHE_WINDOW) {
//       mesh.dispose();
//       localMeshCache.delete(i);
//     }
//   }
// }


function trimQueue(center) {
  for (let i = fetchQueue.length - 1; i >= 0; i--) {
    if (Math.abs(fetchQueue[i].index - center) > CACHE_WINDOW * 2) {
      pendingSet.delete(fetchQueue[i].index);
      fetchQueue.splice(i, 1);
    }
  }
}

function pruneCache(center) {
  for (const [i, mesh] of localMeshCache) {
    if (
      Math.abs(i - center) > CACHE_WINDOW &&
      i !== currentViewIndex &&
      i !== currentViewIndex + 1
    ) {
      mesh.dispose();
      localMeshCache.delete(i);
    }
  }
}


// function prefetchNeighbors(center) {
//   for (let i = center - CACHE_WINDOW; i <= center + CACHE_WINDOW; i++) {
//     if (i < 0) continue;
//
//     const distance = Math.abs(i - center);
//
//     enqueueFetch(i, -distance); // closer = higher priority
//   }
// }

function prefetchNeighbors(center) {
  // forward (important)
  for (let i = center + 1; i <= center + CACHE_WINDOW; i++) {
    enqueueFetch(i, -(i - center));
  }

  // limited backward
  for (let i = center - 1; i >= center - 5; i--) {
    if (i < 0) break;
    enqueueFetch(i, -(center - i + 20));
  }
}
