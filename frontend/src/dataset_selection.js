import { startGlobalEditor } from "./global_editor";

let selected = {
  dataset: null,
  sequence: null,
  lidar: null
};


let isLoading = false;
let breadcrumbEl;
let overlay;

async function showDatasets(container, onDone) {

  updateBreadcrumb();
  container.innerHTML = "";
  const res = await fetch("/api/datasets");
  const datasets = await res.json();
  console.log("datasets:", datasets);
  datasets.forEach(name => {

    const btn = createButton(name);

    btn.onclick = () => {
      selected.dataset = name;
      container.innerHTML = "";
      showSequences(container, onDone);
    };

    container.appendChild(btn);
  });
}




async function showSequences(container, onDone) {

  updateBreadcrumb();
  container.innerHTML = "";

  addBack(container, () => {
    console.log("back from show sequences");
    selected.sequence = null;
    selected.lidar = null;
    selected.dataset = null;
    updateBreadcrumb();
    showDatasets(container, onDone);
  });

  const res = await fetch(`/api/sequences/${selected.dataset}`);
  const sequences = await res.json();

  sequences.forEach(name => {
    const btn = createButton(name);

    btn.onclick = () => {
      selected.sequence = name;
      updateBreadcrumb();
      container.innerHTML = "";
      showLidars(container, onDone);
    };

    container.appendChild(btn);
  });
}


async function showLidars(container, onDone) {
  
  updateBreadcrumb();
  container.innerHTML = "";


  addBack(container, () => {
    console.log("back from show lidars")
    selected.sequence = null;
    selected.lidar = null;
    updateBreadcrumb();
    showSequences(container, onDone);
  });

  const res = await fetch(
    `/api/lidars/${selected.dataset}/${selected.sequence}`
  );

  const lidars = await res.json();

  lidars.forEach(name => {

    const btn = createButton(name);

    btn.onclick = async () => {

      if (isLoading) return;
      
      isLoading = true; 
      selected.lidar = name;
      updateBreadcrumb();

      showLoadingOverlay();
      await fetch("/api/select", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(selected)
      });

      const params = new URLSearchParams({
        mode: "global",
        dataset: selected.dataset,
        sequence: selected.sequence,
        lidar: selected.lidar
      });

      window.history.replaceState({}, "", `?${params}`);
      
      container.remove();
      console.log("lidar selected");
      hideLoadingOverlay();
      onDone();
    };

    container.appendChild(btn);
  });
}

function addBack(container, fn) {
  const btn = createButton("← Back");
  btn.onclick = fn;
  container.appendChild(btn);
}

function createButton(text) {

  const btn = document.createElement("button");

  let inner_text_short = ""; 
  const max_length = 25;

  
  if (max_length <= text.length){
    console.log("shortening text")
    inner_text_short += text.slice(0, max_length);
    inner_text_short += "...";
  }
  else{
    inner_text_short = text
  }

  console.log(inner_text_short)

  btn.innerText = inner_text_short;
  btn.title = text;
  btn.style.margin = "5px";
  btn.style.padding = "5px 10px";
  btn.style.fontSize = "16px";
  btn.style.cursor = "pointer";

  return btn;
}


function showLoadingOverlay() {
  const overlay = document.createElement("div");

  overlay.id = "loadingOverlay";
  overlay.style = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    z-index: 1000;
  `;

  overlay.innerText = "Loading dataset...";
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  document.getElementById("loadingOverlay")?.remove();
}


function shorten(str, max = 15) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function updateBreadcrumb() {
  console.log("updating breadcrumb")
  if (!breadcrumbEl) return;
  console.log("new breadcrumb state", selected.dataset, selected.sequence, selected.lidar)

  const parts = [
    selected.dataset,
    selected.sequence,
    selected.lidar
  ].filter(Boolean)
   .map(p => shorten(p));

  breadcrumbEl.innerText =
    parts.length > 0 ? parts.join(" / ") : "Select a dataset";
}


export function createDatasetSelector(content, onDone) {

  console.log("createDatasetSelector called");
  // overlay = document.createElement("div");
  //
  // overlay.style = `
  //   position: fixed;
  //   inset: 0;
  //   background: #0f172a;
  //   display: flex;
  //   flex-direction: column;
  //   align-items: center;
  //   justify-content: center;
  //   z-index: 999;
  // `;
  //

  content.innerHTML = "";

  const card = document.createElement("div");

  card.style = `
    background: #1e293b;
    padding: 40px;
    border-radius: 12px;
    min-width: 400px;
    max-width: 600px;
    color: white;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  const title = document.createElement("h1");
  title.innerText = "3D Annotation Tool";
  title.style.marginBottom = "10px";

  const subtitle = document.createElement("div");
  subtitle.innerText = "Select dataset to begin";
  subtitle.style.opacity = "0.7";
  subtitle.style.marginBottom = "20px";

  card.appendChild(title);
  card.appendChild(subtitle);

  const breadcrumb = document.createElement("div");
  breadcrumb.style.marginBottom = "20px";
  breadcrumb.style.fontSize = "14px";
  breadcrumb.style.opacity = "0.6";
  breadcrumbEl = breadcrumb;


  card.appendChild(breadcrumb);
  
  // card.appendChild(content);
  
  content.appendChild(card);
  const contentArea = document.createElement("div");

  contentArea.style.display = "flex";
  contentArea.style.flexDirection = "column";
  contentArea.style.alignItems = "center";
  contentArea.style.width = "100%";
  contentArea.style.marginTop = "20px"; 
  card.appendChild(contentArea);

  showDatasets(contentArea, onDone);

  // document.body.appendChild(content);

}
