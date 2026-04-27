import { loadConfig, CONFIG } from "./config.js";
import { startGlobalEditor } from "./global_editor.js";
import { createDatasetSelector } from "./dataset_selection.js";

console.log("body:", document.body);
await loadConfig();

function getInitialStateFromURL() {
  const params = new URLSearchParams(window.location.search);

  const dataset = params.get("dataset");
  const sequence = params.get("sequence");
  const lidar = params.get("lidar");
  const mode = params.get("mode");

  if (!dataset || !sequence || !lidar) return null;

  return { dataset, sequence, lidar, mode };
}


const app = document.createElement("div");
app.style.display = "flex";
app.style.flexDirection = "column";
app.style.height = "100vh";
document.body.appendChild(app);

const topbar = document.createElement("div");



topbar.style = `
  height: 60px;
  background: #020617;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  justify-content: space-between;
  border-bottom: 1px solid #1e293b;
`;

const title = document.createElement("div");
title.innerText = "annotation";

const homeBtn = document.createElement("button");
homeBtn.innerText = "Home";
homeBtn.style = `
  padding: 6px 12px;
  cursor: pointer;
`;

topbar.appendChild(title);
topbar.appendChild(homeBtn);
app.appendChild(topbar);

const content = document.createElement("div");
// content.style.flex = "1";
// content.style.position = "relative";
content.style.paddingTop = "20px";
content.style.display = "flex";
content.style.justifyContent = "center";   // horizontal center
content.style.alignItems = "center";       // vertical center
app.appendChild(content);

const initial = getInitialStateFromURL();

if (initial) {
  // restore directly into editor
  // await fetch("/api/select", {
  //   method: "POST",
  //   headers: {"Content-Type": "application/json"},
  //   body: JSON.stringify(initial)
  // });
  //
  const res = await fetch("/api/select", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(initial)
  });

  const data = await res.json();

  // store globally
  window.datasetMeta = data;

  startGlobalEditor(content,data);

} else {
  createDatasetSelector(content, () => {
    startGlobalEditor(content, data);
  });
}

