import { loadConfig, CONFIG } from "./config.js";

import { startGlobalEditor } from "./global_editor.js";


import { createDatasetSelector } from "./dataset_selection.js";

console.log("body:", document.body);
await loadConfig();

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

createDatasetSelector(content, () => {
  startGlobalEditor(content);
});
