// script.js - starter.png hem preview (sağ) hem ASCII (sol) olarak kesin gösterim
const video = document.getElementById("video");
const image = document.getElementById("image");
const frameCanvas = document.getElementById("frameCanvas");
const frameCtx = frameCanvas.getContext("2d");

const renderCanvas = document.getElementById("renderCanvas");
const rctx = renderCanvas.getContext("2d");

const dropZone = document.getElementById("dropZone");
const toggleColorBtn = document.getElementById("toggleColorBtn");
const widthSlider = document.getElementById("widthSlider");
const widthValue = document.getElementById("widthValue");
const captureFrameBtn = document.getElementById("captureFrameBtn");
const downloadAsciiVideoBtn = document.getElementById("downloadAsciiVideoBtn");

/* Orijinal karakter seti (koyu -> yoğun karakter) */
const asciiChars = "@%#*+=-:. ";
let colorEnabled = true;
let asciiWidth = parseInt(widthSlider.value) || 120;
let currentImage = null;
let currentAsciiText = "";
let renderLoopId = null;

widthValue.textContent = asciiWidth;

// küçük kalite hassasiyeti
rctx.imageSmoothingEnabled = false;
frameCtx.imageSmoothingEnabled = false;

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* ===== Drag & Drop ===== */
["dragenter","dragover","dragleave","drop"].forEach(ev => {
  document.addEventListener(ev, e => e.preventDefault());
});
dropZone.addEventListener("dragover", ()=> dropZone.classList.add("dragover"));
dropZone.addEventListener("dragleave", ()=> dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e)=>{
  dropZone.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if(!files || files.length===0) return;
  const file = files[0];
  const url = URL.createObjectURL(file);

  stopVideo();
  currentImage = null;

  if(file.type.startsWith("video/")) setupVideo(url);
  else if(file.type.startsWith("image/")) setupImage(url);
  else alert("Only video or image files are supported.");
});

/* ===== UI events ===== */
toggleColorBtn.onclick = () => {
  colorEnabled = !colorEnabled;
  toggleColorBtn.textContent = colorEnabled ? "Toggle Color ASCII" : "Toggle Mono ASCII";
  if(video.src && !video.paused) drawVideoFrameOnce();
  else if(currentImage) drawImageASCII(currentImage);
};

widthSlider.oninput = () => {
  asciiWidth = clamp(parseInt(widthSlider.value), 50, 150);
  widthValue.textContent = asciiWidth;
  if(video.src && !video.paused) drawVideoFrameOnce();
  else if(currentImage) drawImageASCII(currentImage);
};

captureFrameBtn.onclick = () => {
  const text = currentAsciiText || "";
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ascii_frame.txt";
  a.click();
};

/* ===== Video/Image Handling ===== */
function stopVideo(){
  try { video.pause(); video.removeAttribute("src"); video.load(); } catch(e){}
  if(renderLoopId) { cancelAnimationFrame(renderLoopId); renderLoopId=null; }
}

function setupVideo(url){
  image.style.display = "none";
  video.style.display = "block";
  video.src = url;
  video.crossOrigin = "anonymous";
  video.addEventListener("loadedmetadata", ()=>{
    video.play().catch(()=>{});
    startVideoRenderLoop();
  }, { once:true });
}

function startVideoRenderLoop(){
  if(renderLoopId) cancelAnimationFrame(renderLoopId);
  function step(){
    if(!video.paused && !video.ended) drawVideoFrame();
    renderLoopId = requestAnimationFrame(step);
  }
  renderLoopId = requestAnimationFrame(step);
}

function drawVideoFrameOnce(){ if(video.readyState>=2) drawVideoFrame(); }

function drawVideoFrame(){
  const vw = video.videoWidth, vh = video.videoHeight;
  if(!vw || !vh) return;
  drawFromSource(video, vw, vh);
}

function setupImage(url){
  image.style.display = "block";
  image.src = url;

  const nat = new Image();
  nat.onload = () => {
    currentImage = nat;
    renderCanvas.style.display = "block";
    drawImageASCII(currentImage);
  };
  nat.onerror = (e) => console.error("Image load error:", e);
  nat.src = url;
}

function drawImageASCII(img){
  if(!img || !img.width || !img.height) return;
  drawFromSource(img, img.width, img.height);
}

function drawFromSource(source, srcW, srcH){
  const rows = Math.max(1, Math.round((srcH/srcW)*asciiWidth*0.55));
  const fontSize = Math.max(6, Math.round(12*(asciiWidth/120)));
  const charWidth = Math.floor(fontSize*0.6);
  const charHeight = Math.floor(fontSize);

  frameCanvas.width = asciiWidth;
  frameCanvas.height = rows;
  frameCtx.clearRect(0,0,frameCanvas.width,frameCanvas.height);
  try {
    frameCtx.drawImage(source, 0, 0, frameCanvas.width, frameCanvas.height);
  } catch(err) { console.error("drawImage failed:", err); return; }

  const frame = frameCtx.getImageData(0,0,frameCanvas.width,frameCanvas.height);

  renderCanvas.width = asciiWidth * charWidth;
  renderCanvas.height = rows * charHeight;
  renderCanvas.style.display = "block";
  renderCanvas.style.width = "100%";
  renderCanvas.style.height = "auto";
  renderCanvas.style.visibility = "visible";

  rctx.clearRect(0,0,renderCanvas.width,renderCanvas.height);
  rctx.fillStyle = "#000";
  rctx.fillRect(0,0,renderCanvas.width,renderCanvas.height);
  rctx.font = `${fontSize}px monospace`;
  rctx.textBaseline = "top";

  let textLines = [];
  for(let y=0; y<frame.height; y++){
    let line = "";
    for(let x=0; x<frame.width; x++){
      const idx = (y*frame.width + x) * 4;
      const r = frame.data[idx], g = frame.data[idx+1], b = frame.data[idx+2];
      const brightness = (0.299*r + 0.587*g + 0.114*b) / 255;
      const charIndex = Math.floor((1 - brightness) * (asciiChars.length - 1));
      const ch = asciiChars[charIndex];
      line += ch;

      if(colorEnabled) rctx.fillStyle = `rgb(${r},${g},${b})`;
      else { const gray = Math.round(brightness*200)+30; rctx.fillStyle = `rgb(0,${gray},0)`; }

      rctx.fillText(ch, x * charWidth, y * charHeight);
    }
    textLines.push(line);
  }

  currentAsciiText = textLines.join("\n");
  console.log("ASCII drawn (" + frame.width + "x" + frame.height + ")");
}

/* ===== ASCII Video Download (Sayfadaki sesi çal, indirme sırasında sessiz) ===== */
downloadAsciiVideoBtn.onclick = async () => {
  if (!video.src) { alert("Load a video first."); return; }
  const src = video.currentSrc || video.src;
  if (!src) { alert("No video source."); return; }

  downloadAsciiVideoBtn.disabled = true;
  const oldText = downloadAsciiVideoBtn.textContent;
  downloadAsciiVideoBtn.textContent = "Processing...";

  try {
    const useWidth = asciiWidth;
    const useColor = colorEnabled;

    // Arka plan sessiz ve görünmez video
    const bgVideo = document.createElement("video");
    bgVideo.src = src;
    bgVideo.muted = true; // sitedeki oynatma sesi etkilenmez
    bgVideo.crossOrigin = "anonymous";
    bgVideo.preload = "auto";
    await new Promise((res, rej) => {
      bgVideo.addEventListener("loadedmetadata", res, { once:true });
      bgVideo.addEventListener("error", () => rej(new Error("Video load error")), { once:true });
    });

    const vw = bgVideo.videoWidth;
    const vh = bgVideo.videoHeight;
    const rows = Math.max(1, Math.round((vh / vw) * useWidth * 0.55));
    const fontSize = Math.max(6, Math.round(12 * (useWidth / 120)));
    const charWidth = Math.floor(fontSize * 0.6);
    const charHeight = Math.floor(fontSize);

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = useWidth;
    sampleCanvas.height = rows;
    const sctx = sampleCanvas.getContext("2d");

    const outCanvas = document.createElement("canvas");
    outCanvas.width = useWidth * charWidth;
    outCanvas.height = rows * charHeight;
    const outCtx = outCanvas.getContext("2d");

    const fps = 30;
    const stream = outCanvas.captureStream(fps);

    // Audio track ekle (indirilen videoda sesi olsun)
    if (bgVideo.captureStream) {
      const audioTracks = bgVideo.captureStream().getAudioTracks();
      if (audioTracks.length) stream.addTrack(audioTracks[0]);
    }

    const chunks = [];
    let recorder;
    try { recorder = new MediaRecorder(stream,{mimeType:"video/webm; codecs=vp8"}); } 
    catch(e){ recorder = new MediaRecorder(stream); }

    recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
    recorder.start();

    bgVideo.currentTime = 0;
    await bgVideo.play().catch(()=>{});

    const intervalMs = Math.round(1000/fps);
    const timer = setInterval(() => {
      if(bgVideo.ended){ clearInterval(timer); recorder.stop(); }
      else {
        sctx.drawImage(bgVideo,0,0,sampleCanvas.width,sampleCanvas.height);
        const frame = sctx.getImageData(0,0,sampleCanvas.width,sampleCanvas.height);

        outCtx.fillStyle="#000";
        outCtx.fillRect(0,0,outCanvas.width,outCanvas.height);
        outCtx.font = `${fontSize}px monospace`;
        outCtx.textBaseline="top";

        for(let y=0;y<frame.height;y++){
          for(let x=0;x<frame.width;x++){
            const idx = (y*frame.width + x) * 4;
            const r = frame.data[idx], g = frame.data[idx+1], b = frame.data[idx+2];
            const brightness = (0.299*r + 0.587*g + 0.114*b)/255;
            const charIndex = Math.floor((1 - brightness)*(asciiChars.length-1));
            const ch = asciiChars[charIndex];
            if(useColor) outCtx.fillStyle=`rgb(${r},${g},${b})`;
            else { const gray = Math.round(brightness*200)+30; outCtx.fillStyle=`rgb(0,${gray},0)`; }
            outCtx.fillText(ch,x*charWidth,y*charHeight);
          }
        }
      }
    }, intervalMs);

    await new Promise(res => { recorder.onstop = res; });
    const blob = new Blob(chunks,{type:"video/webm"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ascii_video.webm";
    a.click();

    try{ bgVideo.pause(); bgVideo.removeAttribute("src"); bgVideo.load(); } catch(e){}
  } catch(err){
    console.error(err);
    alert("Recording failed: "+(err && err.message ? err.message:"unknown"));
  } finally {
    downloadAsciiVideoBtn.disabled = false;
    downloadAsciiVideoBtn.textContent = oldText;
  }
};

/* ===== AUTO LOAD STARTER IMAGE ON START ===== */
window.addEventListener("load", ()=>{
  stopVideo();
  video.style.display = "none";

  const starterUrl = "starter.png";
  const starter = new Image();
  starter.onload = () => {
    image.style.display = "block";
    image.src = starterUrl;
    currentImage = starter;
    drawImageASCII(currentImage);
    console.log("starter.png yüklendi ve ASCII çizildi.");
  };
  starter.onerror = (e) => console.error("starter.png yüklenemedi:", e);
  starter.src = starterUrl;
});
