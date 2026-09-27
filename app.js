const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");
const fileList = document.getElementById("fileList");
const convertBtn = document.getElementById("convertBtn");
const clearBtn = document.getElementById("clearBtn");
const bitrateSelect = document.getElementById("bitrate");
const statusEl = document.getElementById("status");

let files = [];

selectBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  });
});

dropzone.addEventListener("drop", (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files) {
    addFiles(dt.files);
  }
});

clearBtn.addEventListener("click", () => {
  files = [];
  renderFileList();
  updateButtons();
  statusEl.textContent = "";
});

convertBtn.addEventListener("click", async () => {
  if (files.length === 0) return;

  const bitrate = Number(bitrateSelect.value);
  convertBtn.disabled = true;
  clearBtn.disabled = true;

  for (let i = 0; i < files.length; i++) {
    const item = files[i];

    if (item.status === "success") {
      continue;
    }

    item.status = "converting";
    renderFileList();

    try {
      const mp3Blob = await convertFlacToMp3(item.file, bitrate);

      item.status = "success";
      item.blob = mp3Blob;

      const mp3Name = item.file.name.replace(/\.flac$/i, "") + ".mp3";
      item.mp3Name = mp3Name;

      renderFileList();
    } catch (err) {
      console.error(err);
      item.status = "error";
      item.errorMsg = "转换失败";
      renderFileList();
    }
  }

  statusEl.textContent = "转换完成，可逐个下载 MP3 文件。";
  convertBtn.disabled = false;
  clearBtn.disabled = false;
});

function addFiles(newFiles) {
  for (const file of newFiles) {
    if (!/\.flac$/i.test(file.name)) {
      continue;
    }

    files.push({
      file,
      status: "waiting",
      blob: null,
      mp3Name: null,
      errorMsg: null
    });
  }

  renderFileList();
  updateButtons();
}

function updateButtons() {
  const hasFiles = files.length > 0;
  convertBtn.disabled = !hasFiles;
  clearBtn.disabled = !hasFiles;
}

function renderFileList() {
  fileList.innerHTML = "";

  files.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "file-item";

    if (item.status === "success") row.classList.add("success");
    if (item.status === "error") row.classList.add("error");

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.file.name;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const state = document.createElement("div");
    state.className = "state";

    if (item.status === "waiting") {
      state.textContent = "等待转换";
    } else if (item.status === "converting") {
      state.textContent = "转换中…";
    } else if (item.status === "success") {
      state.textContent = "已完成";
    } else if (item.status === "error") {
      state.textContent = item.errorMsg || "转换失败";
    }

    right.appendChild(state);

    if (item.status === "success" && item.blob) {
      const downloadBtn = document.createElement("button");
      downloadBtn.className = "btn";
      downloadBtn.textContent = "下载 MP3";

      downloadBtn.addEventListener("click", () => {
        downloadBlob(item.blob, item.mp3Name);
      });

      right.appendChild(downloadBtn);
    }

    row.appendChild(name);
    row.appendChild(right);
    fileList.appendChild(row);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function convertFlacToMp3(file, bitrateKbps) {
  const arrayBuffer = await file.arrayBuffer();

  // 使用浏览器 AudioContext 解码音频
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();

  let audioBuffer;

  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    throw new Error("无法解码该 FLAC 文件");
  }

  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;

  // lamejs 通常处理单声道或立体声
  const channelCount = channels >= 2 ? 2 : 1;

  const left = audioBuffer.getChannelData(0);
  const right = channelCount === 2 ? audioBuffer.getChannelData(1) : left;

  const leftInt16 = floatTo16BitPCM(left);
  const rightInt16 = floatTo16
