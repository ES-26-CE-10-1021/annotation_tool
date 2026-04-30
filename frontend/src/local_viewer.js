import * as GUI from "@babylonjs/gui";
import { pointMaterial } from "./point_cloud.js";
import {gizmoManager } from "./global_editor.js";
import { updateShaderBoxes, loadAnnotations } from "./bbox_tool.js";

let scrubberMenuPanel = null;
let scrubberMenuContainer = null;
let scrubberUI = null;

let currentViewIndex = 0;
let currentVisibleIndex = null;
let sceneRef = null;
let indexLabel = null;
let maxSequenceIndex = 0;

let isPlaying = false;
let suppressSlider = false;
let requestToken = 0;

// --------------------------------------------------
// Point cloud cache
// --------------------------------------------------

export const localMeshCache = new Map();

const CACHE_WINDOW = 30;
const MAX_CONCURRENT = 4;

const localAnnotationCache = new Map();     // index -> state
const annotationPending = new Map();        // index -> Promise
const MAX_ANNOTATION_CACHE = 60;
const MIN_INLIERS = 50;

const MAX_CONCURRENT_POINT = 4
const MAX_CONCURRENT_ANNOTATION = 2

let activeRequests = 0;
const fetchQueue = [];
const pendingSet = new Set();
let queueDirty = false;

// --------------------------------------------------
// Annotation cache (single frame + optional memory cache)
// --------------------------------------------------

let lastAnnotationIndex = -1;
let lastAnnotationState = null;

let currentLocalAnnotations = {
  assets: [],
  active: null
};


// --------------------------------------------------
// UI
// --------------------------------------------------

export function createScrubberMenu(scene, datasetMeta) {
  if (scrubberUI) return;

  sceneRef = scene;
  maxSequenceIndex = datasetMeta.max_index;

  scrubberUI = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

  scrubberMenuContainer = new GUI.Rectangle();
  scrubberMenuContainer.width = "100%";
  scrubberMenuContainer.height = "80px";
  scrubberMenuContainer.thickness = 0;
  scrubberMenuContainer.background = "#222222cc";
  scrubberMenuContainer.horizontalAlignment =
    GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  scrubberMenuContainer.verticalAlignment =
    GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

  scrubberUI.addControl(scrubberMenuContainer);

  scrubberMenuPanel = new GUI.StackPanel();
  scrubberMenuPanel.isVertical = false;
  scrubberMenuPanel.width = "100%";
  scrubberMenuPanel.height = "100%";
  scrubberMenuPanel.paddingLeft = "10px";
  scrubberMenuPanel.paddingRight = "10px";
  scrubberMenuPanel.spacing = 10;

  scrubberMenuContainer.addControl(scrubberMenuPanel);

  const playBtn = GUI.Button.CreateSimpleButton("play", "▶");
  styleButton(playBtn);

  const pauseBtn = GUI.Button.CreateSimpleButton("pause", "▐▐");
  styleButton(pauseBtn);

  const slider = new GUI.Slider("sequenceSlider");
  slider.minimum = 0;
  slider.maximum = datasetMeta.max_index;
  slider.value = 0;
  slider.height = "40px";
  slider.width = "80%";
  slider.color = "white";
  slider.background = "#555555";

  const sliderContainer = new GUI.Rectangle();
  sliderContainer.width = "80%";
  sliderContainer.height = "100%";
  sliderContainer.thickness = 0;

  slider.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  slider.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

  sliderContainer.addControl(slider);

  indexLabel = new GUI.TextBlock();
  indexLabel.text = "0";
  indexLabel.width = "80px";
  indexLabel.height = "40px";
  indexLabel.color = "white";

  slider.onValueChangedObservable.add(async (value) => {
    if (suppressSlider) return;

    const token = ++requestToken;
    const index = Math.floor(value);

    currentViewIndex = index;
    indexLabel.text = String(index);

    await showFrame(index, token);
  });

  playBtn.onPointerClickObservable.add(() => startPlayback(slider));
  pauseBtn.onPointerClickObservable.add(() => stopPlayback());

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

export function setScrubberUIVisible(visible) {
  if (scrubberUI) {
    scrubberUI.rootContainer.isVisible = visible;
  }
}

// --------------------------------------------------
// Frame switching
// --------------------------------------------------

// async function showFrame(index, token = requestToken) {
//   enqueueFetch(index, 100);
//
//   while (!localMeshCache.has(index)) {
//     await sleep(10);
//   }
//
//   if (token !== requestToken) return;
//
//   setVisible(index);
//
//   const localAnnotations = await fetchLocalAnnotations(sceneRef, index);
//
//   if (token !== requestToken) return;
//
//   updateShaderBoxes(localAnnotations.assets);
//
//   prefetchNeighbors(index);
//   trimQueue(index);
// }

async function showFrame(index, token = requestToken) {
  enqueueFetch(index, 100);
  enqueueAnnotationFetch(index);

  while (!localMeshCache.has(index)) {
    await sleep(5);
  }

  while (!localAnnotationCache.has(index)) {
    await sleep(5);
  }

  if (token !== requestToken) return;

  setVisible(index);
  setAnnotationMeshesVisible(index);

  const ann = localAnnotationCache.get(index);
  updateShaderBoxes(ann.assets);

  prefetchNeighbors(index);
  prefetchAnnotationNeighbors(index);

  trimQueue(index);
  pruneAnnotationCache(index);
}

async function startPlayback(slider) {
  if (isPlaying) return;

  isPlaying = true;

  while (isPlaying) {
    const next = currentViewIndex + 1;

    if (next > slider.maximum) {
      isPlaying = false;
      break;
    }

    const token = ++requestToken;

    await showFrame(next, token);

    suppressSlider = true;
    slider.value = next;
    suppressSlider = false;

    currentViewIndex = next;
    indexLabel.text = String(next);
  }
}

function stopPlayback() {
  isPlaying = false;
}

// --------------------------------------------------
// Point cloud loading
// --------------------------------------------------

export async function loadLocalPointCloud(scene, index, isPrefetch = false) {
  sceneRef = scene;

  if (localMeshCache.has(index)) {
    if (!isPrefetch) {
      setVisible(index);
    }
    pruneCache(index);
    return;
  }

  const res = await fetch(`/api/local_points/${index}`);

  if (!res.ok) return;

  const buffer = await res.arrayBuffer();
  const data = new Float16Array(buffer);

  const pointCount = data.length / 3;

  const positions = new Float32Array(pointCount * 3);
  const normals = new Float32Array(pointCount * 3);

  for (let i = 0; i < data.length; i += 3) {
    positions[i] = data[i];
    positions[i + 1] = data[i + 1];
    positions[i + 2] = data[i + 2];

    normals[i] = 0;
    normals[i + 1] = 1;
    normals[i + 2] = 0;
  }

  const mesh = new BABYLON.Mesh(`local_${index}`, scene);

  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh, true);

  mesh.material = pointMaterial;
  mesh.setEnabled(false);

  localMeshCache.set(index, mesh);

  pruneCache(index);
}

function enqueueFetch(index, priority = 0) {
  if (index < 0 || index > maxSequenceIndex) return;
  if (localMeshCache.has(index)) return;
  if (pendingSet.has(index)) return;

  fetchQueue.push({ index, priority });
  pendingSet.add(index);
  queueDirty = true;

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
        processQueue();
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

function trimQueue(center) {
  for (let i = fetchQueue.length - 1; i >= 0; i--) {
    if (Math.abs(fetchQueue[i].index - center) > CACHE_WINDOW * 2) {
      pendingSet.delete(fetchQueue[i].index);
      fetchQueue.splice(i, 1);
    }
  }
}

function enqueueAnnotationFetch(index) {
  if (index < 0 || index > maxSequenceIndex) return;
  if (localAnnotationCache.has(index)) return;
  if (annotationPending.has(index)) return;

  const p = fetchLocalAnnotations(sceneRef, index)
    .finally(() => annotationPending.delete(index));

  annotationPending.set(index, p);
}


function prefetchAnnotationNeighbors(center) {
  const end = Math.min(center + CACHE_WINDOW, maxSequenceIndex);

  for (let i = center; i <= end; i++) {
    enqueueAnnotationFetch(i);
  }
}

function prefetchNeighbors(center) {
  const end = Math.min(center + CACHE_WINDOW, maxSequenceIndex);

  for (let i = center + 1; i <= end; i++) {
    enqueueFetch(i, -(i - center));
  }

  const start = Math.max(0, center - 5);

  for (let i = center - 1; i >= start; i--) {
    enqueueFetch(i, -(center - i + 20));
  }
}


async function fetchLocalAnnotations(scene, index) {
  const res = await fetch(`/api/local_bboxes/${index}`);
  if (!res.ok) return null;

  const json = await res.json();

  const adapted = convertLocalToGlobalFormat(json);

  const state = {
    assets: [],
    active: null
  };

  loadAnnotations(scene, adapted, gizmoManager, state, true);

  localAnnotationCache.set(index, state);

  return state;
}


// async function fetchLocalAnnotations(scene, index) {
//   disposeAnnotationState(currentLocalAnnotations);
//
//   const res = await fetch(`/api/local_bboxes/${index}`);
//   const json = await res.json();
//
//   const adapted = convertLocalToGlobalFormat(json);
//
//   loadAnnotations(scene, adapted, null, currentLocalAnnotations, true);
//
//   // updateShaderBoxes(currentLocalAnnotations.assets);
//
//   return currentLocalAnnotations;
// }

// function convertLocalToGlobalFormat(localJson) {
//   return {
//     annotations: localJson.annotations.map(convertNode)
//   };
// }

function convertLocalToGlobalFormat(localJson) {
  return {
    annotations: localJson.annotations
      .filter(a => shouldKeepAnnotation(a))
      .map(convertNode)
  };
}

function shouldKeepAnnotation(node) {
  if (node.is_visible === false) return false;
  if ((node.inliers ?? 0) < MIN_INLIERS) return false;
  return true;
}


// function convertNode(node) {
//   return {
//     type: "bbox",
//     position: node.translation,
//     rotationQuaternion: node.rotation,
//     scaling: node.dimensions,
//     base_size: 1,
//     label: node.label ?? 0,
//     instance: 0,
//     note: "",
//     children: Array.isArray(node.children)
//       ? node.children.map(convertNode)
//       : []
//   };
// }

function convertNode(node) {
  return {
    type: "bbox",
    position: node.translation,
    rotationQuaternion: node.rotation,
    scaling: node.dimensions,
    base_size: 1,
    label: node.label ?? 0,
    instance: 0,
    note: "",
    children: Array.isArray(node.children)
      ? node.children
          .filter(c => shouldKeepAnnotation(c))
          .map(convertNode)
      : []
  };
}

function pruneAnnotationCache(center) {
  for (const [i, state] of localAnnotationCache) {
    if (Math.abs(i - center) > CACHE_WINDOW) {
      disposeAnnotationState(state);
      localAnnotationCache.delete(i);
    }
  }
}


function setAnnotationMeshesVisible(index) {
  for (const [frameIndex, state] of localAnnotationCache) {
    const visible = frameIndex === index;
    setAnnotationTreeVisible(state.assets, visible);
  }
}

function setAnnotationTreeVisible(assets, visible) {
  for (const asset of assets) {
    if (asset.mesh) {
      asset.mesh.setEnabled(visible);
    }

    if (asset.children?.length > 0) {
      setAnnotationTreeVisible(asset.children, visible);
    }
  }
}

function disposeAnnotationTree(asset) {
  for (const child of asset.children) {
    disposeAnnotationTree(child);
  }

  asset.mesh?.dispose();
}

function disposeAnnotationState(state) {
  for (const asset of state.assets) {
    disposeAnnotationTree(asset);
  }

  state.assets.length = 0;
  state.active = null;
}

export function clearLocalAnnotationMode() {
  // dispose cached annotation states
  for (const [, state] of localAnnotationCache) {
    disposeAnnotationState(state);
  }

  localAnnotationCache.clear();
  annotationPending.clear();

  // reset current refs
  currentLocalAnnotations = {
    assets: [],
    active: null
  };

  lastAnnotationIndex = -1;
  lastAnnotationState = null;

  // remove local shader boxes
  updateShaderBoxes([]);

  // hide local pointclouds if desired
  for (const [, mesh] of localMeshCache) {
    mesh.setEnabled(false);
  }
}


// --------------------------------------------------
// Utility
// --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
