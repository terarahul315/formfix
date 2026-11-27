"use strict";

let loadedImage = null;
let originalFile = null;
let outputUrl = null;
let currentMode = "photo";

const $ = (id) => document.getElementById(id);

const imageInput = $("imageInput");
const uploadArea = $("uploadArea");
const uploadHeading = $("uploadHeading");
const fileInfo = $("fileInfo");
const fileName = $("fileName");
const removeImageBtn = $("removeImage");

const targetKB = $("targetKB");
const outputFormat = $("outputFormat");
const formatField = $("formatField");
const slateFields = $("slateFields");
const imageWidth = $("imageWidth");
const imageHeight = $("imageHeight");

const processBtn = $("processBtn");
const statusMessage = $("statusMessage");
const resultPanel = $("resultPanel");
const resultPreview = $("resultPreview");
const resultSize = $("resultSize");
const resultDimensions = $("resultDimensions");
const downloadBtn = $("downloadBtn");
const themeToggle = $("themeToggle");

/* THEME */
try {
  if (localStorage.getItem("formfix-theme") === "dark") document.body.classList.add("dark");
} catch {}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  try { localStorage.setItem("formfix-theme", document.body.classList.contains("dark") ? "dark" : "light"); } catch {}
});

/* MODE SWITCH */
function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));

  slateFields.hidden = mode !== "photo";
  formatField.hidden = mode === "pdf";

  if (mode === "photo") {
    targetKB.value = 50; imageWidth.value = ""; imageHeight.value = "";
    uploadHeading.textContent = "Upload Your Photo";
  } else if (mode === "signature") {
    targetKB.value = 20; imageWidth.value = ""; imageHeight.value = "";
    uploadHeading.textContent = "Upload Your Signature";
  } else if (mode === "sheet") {
    targetKB.value = 450; imageWidth.value = 1800; imageHeight.value = 1200;
    uploadHeading.textContent = "Upload Photo for 4×6 Sheet (6 Copies)";
  } else {
    targetKB.value = 200; imageWidth.value = 1240; imageHeight.value = 1754;
    uploadHeading.textContent = "Upload Document Image (for PDF)";
  }

  resultPanel.hidden = true;
  showStatus(mode.toUpperCase() + " mode selected.");
}

document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});

document.querySelectorAll(".kb-chip").forEach(btn => {
  btn.addEventListener("click", () => {
    targetKB.value = btn.dataset.kb;
    if (loadedImage) processImage();
  });
});

function activatePreset(mode, w, h, kb, fmt, focusSlate = false) {
  switchMode(mode);
  if (w !== "") imageWidth.value = w;
  if (h !== "") imageHeight.value = h;
  targetKB.value = kb;
  if (fmt && mode !== "pdf") outputFormat.value = fmt;
  $("tools").scrollIntoView({ behavior: "smooth" });
  if (focusSlate && $("photoName")) $("photoName").focus();
  else if (loadedImage) processImage();
}

/* UPLOAD + DRAG & DROP */
function handleFile(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showStatus("Please select a JPG, PNG or WebP image.", true);
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showStatus("Maximum upload size is 20 MB.", true);
    return;
  }

  const reader = new FileReader();
  showStatus("Loading image...");
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;
      originalFile = file;
      fileName.textContent = file.name + " (" + formatBytes(file.size) + ")";
      fileInfo.hidden = false;
      resultPanel.hidden = true;
      showStatus("Image loaded! Tap Process Image.");
    };
    img.onerror = () => { showStatus("Could not open this image.", true); clearImage(); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

imageInput.addEventListener("change", () => handleFile(imageInput.files[0]));

["dragenter", "dragover"].forEach(ev => uploadArea.addEventListener(ev, e => {
  e.preventDefault(); uploadArea.style.borderColor = "#008b63";
}));
["dragleave", "drop"].forEach(ev => uploadArea.addEventListener(ev, e => {
  e.preventDefault(); uploadArea.style.borderColor = "";
}));
uploadArea.addEventListener("drop", e => handleFile(e.dataTransfer?.files?.[0]));

removeImageBtn.addEventListener("click", clearImage);

function clearImage() {
  loadedImage = null; originalFile = null; imageInput.value = "";
  fileInfo.hidden = true; resultPanel.hidden = true;
  if (outputUrl) { URL.revokeObjectURL(outputUrl); outputUrl = null; }
  resultPreview.removeAttribute("src");
  downloadBtn.removeAttribute("href");
  showStatus("Image removed.");
}

function showStatus(msg, isError = false) {
  statusMessage.textContent = msg;
  statusMessage.style.color = isError ? "#d33b3b" : "";
}

function formatBytes(bytes) {
  return bytes < 1024 ? bytes + " Bytes" : (bytes / 1024).toFixed(2) + " KB";
}

/* CANVAS + SHEET + SLATE */
function createCanvas(scale = 1) {
  const origW = loadedImage.naturalWidth, origH = loadedImage.naturalHeight;
  let w = Number(imageWidth.value), h = Number(imageHeight.value);

  if (imageWidth.value && (!Number.isInteger(w) || w < 1 || w > 5000)) throw new Error("Width must be 1–5000 px.");
  if (imageHeight.value && (!Number.isInteger(h) || h < 1 || h > 5000)) throw new Error("Height must be 1–5000 px.");

  if (!w && !h) { w = origW; h = origH; }
  else if (w && !h) { h = Math.round(origH * w / origW); }
  else if (!w && h) { w = Math.round(origW * h / origH); }

  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  if (currentMode === "sheet") {
    const pad = Math.round(w * 0.025), gap = Math.round(w * 0.018);
    const cw = Math.floor((w - pad * 2 - gap * 2) / 3);
    const ch = Math.floor((h - pad * 2 - gap) / 2);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = pad + c * (cw + gap), y = pad + r * (ch + gap);
        ctx.drawImage(loadedImage, x, y, cw, ch);
        ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2; ctx.strokeRect(x, y, cw, ch);
      }
    }
  } else {
    const ratio = Math.min(w / origW, h / origH);
    const dw = origW * ratio, dh = origH * ratio;
    ctx.drawImage(loadedImage, (w - dw) / 2, (h - dh) / 2, dw, dh);

    if (currentMode === "photo") {
      const name = $("photoName")?.value.trim().toUpperCase() || "";
      const dop = $("photoDate")?.value.trim().toUpperCase() || "";
      if (name || dop) {
        const sh = name && dop ? Math.round(h * 0.16) : Math.round(h * 0.10);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, h - sh, w, sh);
        ctx.fillStyle = "#000000"; ctx.textAlign = "center";
        const fs = Math.max(11, Math.round(w * 0.06));
        ctx.font = `bold ${fs}px Arial, sans-serif`;
        if (name && dop) { ctx.fillText(name, w / 2, h - sh + fs + 4); ctx.fillText(dop, w / 2, h - 6); }
        else { ctx.fillText(name || dop, w / 2, h - 6); }
      }
    }
  }
  return canvas;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("Conversion failed.")), mime, quality));
}

function buildPdfFromJpeg(jpegBytes, imgW, imgH) {
  const pw = 595.28, ph = 841.89;
  const sc = Math.min((pw - 40) / imgW, (ph - 40) / imgH);
  const dw = (imgW * sc).toFixed(2), dh = (imgH * sc).toFixed(2);
  const x = ((pw - dw) / 2).toFixed(2), y = ((ph - dh) / 2).toFixed(2);
  const enc = new TextEncoder(), parts = [], off = [];
  let len = 0;
  const pStr = s => { const b = enc.encode(s); parts.push(b); len += b.length; };
  pStr("%PDF-1.4\n");
  off.push(len); pStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  off.push(len); pStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  off.push(len); pStr(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  off.push(len); pStr(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  parts.push(jpegBytes); len += jpegBytes.length; pStr("\nendstream\nendobj\n");
  const st = `q\n${dw} 0 0 ${dh} ${x} ${y} cm\n/Im0 Do\nQ\n`;
  off.push(len); pStr(`5 0 obj\n<< /Length ${st.length} >>\nstream\n${st}endstream\nendobj\n`);
  const xref = len;
  pStr("xref\n0 6\n0000000000 65535 f \n");
  off.forEach(o => pStr(String(o).padStart(10, "0") + " 00000 n \n"));
  pStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

/* PROCESS */
processBtn.addEventListener("click", processImage);

async function processImage() {
  if (!loadedImage) { showStatus("Please upload an image first.", true); return; }
  const maxKB = Number(targetKB.value);
  if (!Number.isFinite(maxKB) || maxKB < 1 || maxKB > 5000) { showStatus("Enter target size between 1 and 5000 KB.", true); return; }

  const mime = currentMode === "pdf" ? "image/jpeg" : outputFormat.value;
  processBtn.disabled = true; processBtn.textContent = "Processing...";
  showStatus("Processing...");

  try {
    const maxBytes = maxKB * 1024;
    let bestBlob = null, bestCanvas = null;
    const qualities = [0.94, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15];

    for (let scale = 1; scale >= 0.25; scale *= 0.85) {
      const canvas = createCanvas(scale);
      for (const q of qualities) {
        const blob = await canvasToBlob(canvas, mime, mime === "image/png" ? undefined : q);
        if (!bestBlob || blob.size < bestBlob.size) { bestBlob = blob; bestCanvas = canvas; }
        if (blob.size <= maxBytes) { bestBlob = blob; bestCanvas = canvas; break; }
        if (mime === "image/png") break;
      }
      if (bestBlob && bestBlob.size <= maxBytes) break;
    }

    let finalBlob = bestBlob;
    if (currentMode === "pdf") {
      const jpgBytes = new Uint8Array(await bestBlob.arrayBuffer());
      finalBlob = buildPdfFromJpeg(jpgBytes, bestCanvas.width, bestCanvas.height);
    }

    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(finalBlob);
    resultPreview.src = currentMode === "pdf" ? URL.createObjectURL(bestBlob) : outputUrl;
    resultSize.textContent = formatBytes(finalBlob.size);
    resultDimensions.textContent = bestCanvas.width + " × " + bestCanvas.height + " px";

    const ext = currentMode === "pdf" ? "pdf" : ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[bestBlob.type] || "jpg");
    downloadBtn.href = outputUrl;
    downloadBtn.download = `formfix-${currentMode}.${ext}`;
    downloadBtn.textContent = `Download ${ext.toUpperCase()}`;
    resultPanel.hidden = false;

    showStatus(finalBlob.size <= maxBytes ? "Done! Ready to download." : "Done! Closest size reached: " + formatBytes(finalBlob.size));
  } catch (err) {
    showStatus(err.message || "Something went wrong.", true);
  } finally {
    processBtn.disabled = false; processBtn.textContent = "Process Image";
  }
}

/* HELP DESK */
function sendHelp(type) {
  const n = $("helpName")?.value.trim() || "User";
  const q = $("helpQuery")?.value.trim() || "";
  if (!q) { showStatus("Please write your question in Help Desk first.", true); return; }
  const txt = `FormFix Help Desk\nName: ${n}\nQuery: ${q}`;
  if (type === "wa") window.open("https://wa.me/918934023097?text=" + encodeURIComponent(txt), "_blank", "noopener,noreferrer");
  else window.location.href = "mailto:rm6129306@gmail.com?subject=" + encodeURIComponent("FormFix Support") + "&body=" + encodeURIComponent(txt);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

showStatus("Upload an image to get started.");
