
    const videoInput = document.getElementById('videoInput');
    const video = document.getElementById('video');
    const stage = document.getElementById('stage');
    const dropLayer = document.getElementById('dropLayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const currentTimeText = document.getElementById('currentTime');
    const cropBox = document.getElementById('cropBox');
    const generateBtn = document.getElementById('generateBtn');
    const statusText = document.getElementById('status');
    const progressBar = document.getElementById('progress');
    const gifPreview = document.getElementById('gifPreview');
    const downloadBtn = document.getElementById('downloadBtn');
    const resultSection = document.getElementById('resultSection');
    const canvas = document.getElementById('workCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let videoURL = null;
    let dragState = null;

    function setStatus(message, progress = null) {
      statusText.textContent = message;
      if (progress !== null) progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    }

    function waitForSeek(target) {
      return new Promise(resolve => {
        const done = () => {
          video.removeEventListener('seeked', done);
          resolve();
        };
        video.addEventListener('seeked', done, { once: true });
        video.currentTime = target;
      });
    }

    function getVideoRectInsideStage() {
      const stageRect = stage.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      return {
        left: videoRect.left - stageRect.left,
        top: videoRect.top - stageRect.top,
        width: videoRect.width,
        height: videoRect.height
      };
    }

    function applyCrop(leftPct, topPct, widthPct, heightPct) {
      const rect = getVideoRectInsideStage();
      cropBox.style.left = `${rect.left + rect.width * leftPct}%`;
      cropBox.style.top = `${rect.top + rect.height * topPct}%`;
      cropBox.style.width = `${rect.width * widthPct}px`;
      cropBox.style.height = `${rect.height * heightPct}px`;
    }

    function setCropPreset(type) {
      if (!video.src) return;
      const rect = getVideoRectInsideStage();
      cropBox.classList.remove('hidden');

      if (type === 'full') {
        cropBox.style.left = `${rect.left}px`;
        cropBox.style.top = `${rect.top}px`;
        cropBox.style.width = `${rect.width}px`;
        cropBox.style.height = `${rect.height}px`;
        return;
      }

      if (type === 'square') {
        const size = Math.min(rect.width, rect.height) * 0.85;
        cropBox.style.left = `${rect.left + (rect.width - size) / 2}px`;
        cropBox.style.top = `${rect.top + (rect.height - size) / 2}px`;
        cropBox.style.width = `${size}px`;
        cropBox.style.height = `${size}px`;
        return;
      }

      const targetRatio = 16 / 9;
      let width = rect.width * 0.9;
      let height = width / targetRatio;
      if (height > rect.height * 0.9) {
        height = rect.height * 0.9;
        width = height * targetRatio;
      }
      cropBox.style.left = `${rect.left + (rect.width - width) / 2}px`;
      cropBox.style.top = `${rect.top + (rect.height - height) / 2}px`;
      cropBox.style.width = `${width}px`;
      cropBox.style.height = `${height}px`;
    }

    function getCropInVideoPixels() {
      const stageRect = stage.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      const cropRect = cropBox.getBoundingClientRect();

      const x = Math.max(0, cropRect.left - videoRect.left);
      const y = Math.max(0, cropRect.top - videoRect.top);
      const w = Math.min(cropRect.width, videoRect.width - x);
      const h = Math.min(cropRect.height, videoRect.height - y);

      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;

      return {
        sx: Math.round(x * scaleX),
        sy: Math.round(y * scaleY),
        sw: Math.round(w * scaleX),
        sh: Math.round(h * scaleY)
      };
    }

    function clampCropBox() {
      const videoRect = getVideoRectInsideStage();
      const left = parseFloat(cropBox.style.left) || 0;
      const top = parseFloat(cropBox.style.top) || 0;
      const width = parseFloat(cropBox.style.width) || 50;
      const height = parseFloat(cropBox.style.height) || 50;

      const minSize = 40;
      const newWidth = Math.max(minSize, Math.min(width, videoRect.width));
      const newHeight = Math.max(minSize, Math.min(height, videoRect.height));
      const newLeft = Math.max(videoRect.left, Math.min(left, videoRect.left + videoRect.width - newWidth));
      const newTop = Math.max(videoRect.top, Math.min(top, videoRect.top + videoRect.height - newHeight));

      cropBox.style.left = `${newLeft}px`;
      cropBox.style.top = `${newTop}px`;
      cropBox.style.width = `${newWidth}px`;
      cropBox.style.height = `${newHeight}px`;
    }

    function loadVideoFile(file) {
      if (!file) return;

      if (!file.type.startsWith('video/')) {
        setStatus('Please drop or choose a valid video file.', 0);
        return;
      }

      if (videoURL) URL.revokeObjectURL(videoURL);
      videoURL = URL.createObjectURL(file);
      video.src = videoURL;
      resultSection.classList.add('hidden');
      playPauseBtn.textContent = '▶ Play';
      currentTimeText.textContent = '0.00s';

      const sizeGB = file.size / 1024 / 1024 / 1024;
      const name = file.name.toLowerCase();
      const likelyPlayable = ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv'].some(ext => name.endsWith(ext));
      const warning = sizeGB >= 4 ? ` Large file detected: ${sizeGB.toFixed(2)} GB. Keep GIF duration short.` : '';
      const formatNote = likelyPlayable ? '' : ' If preview does not load, your browser cannot decode this format.';
      setStatus(`Video selected: ${file.name}.${warning}${formatNote}`, 0);
    }

    videoInput.addEventListener('change', event => {
      loadVideoFile(event.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      stage.addEventListener(eventName, event => {
        event.preventDefault();
        if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files')) {
          stage.classList.add('drag-over');
        }
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      stage.addEventListener(eventName, event => {
        event.preventDefault();
        if (eventName === 'drop') {
          loadVideoFile(event.dataTransfer.files[0]);
        }
        stage.classList.remove('drag-over');
      });
    });

    function updatePlayButton() {
      playPauseBtn.textContent = video.paused ? '▶ Play' : '⏸ Pause';
    }

    playPauseBtn.addEventListener('click', async () => {
      if (!video.src) {
        setStatus('Please upload a video first.', 0);
        return;
      }

      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
      updatePlayButton();
    });

    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? '🔇' : '🔊';
    });

    video.addEventListener('play', updatePlayButton);
    video.addEventListener('pause', updatePlayButton);
    video.addEventListener('ended', updatePlayButton);
    video.addEventListener('timeupdate', () => {
      currentTimeText.textContent = `${video.currentTime.toFixed(2)}s`;
    });

    video.addEventListener('loadedmetadata', () => {
      document.getElementById('endTime').value = Math.min(6, video.duration).toFixed(1);
      setTimeout(() => setCropPreset('full'), 50);
      setStatus(`Loaded: ${video.videoWidth}x${video.videoHeight}, duration ${video.duration.toFixed(1)}s. GIF will use automatic smooth timing.`, 0);
    });

    document.getElementById('fullCropBtn').addEventListener('click', () => setCropPreset('full'));
    document.getElementById('squareCropBtn').addEventListener('click', () => setCropPreset('square'));
    document.getElementById('centerCropBtn').addEventListener('click', () => setCropPreset('center'));

    cropBox.addEventListener('pointerdown', event => {
      event.preventDefault();
      const handle = event.target.dataset.handle || 'move';
      cropBox.setPointerCapture(event.pointerId);
      dragState = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        left: parseFloat(cropBox.style.left),
        top: parseFloat(cropBox.style.top),
        width: parseFloat(cropBox.style.width),
        height: parseFloat(cropBox.style.height)
      };
    });

    cropBox.addEventListener('pointermove', event => {
      if (!dragState) return;
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      let { left, top, width, height } = dragState;

      if (dragState.handle === 'move') {
        left += dx;
        top += dy;
      } else {
        if (dragState.handle.includes('r')) width += dx;
        if (dragState.handle.includes('b')) height += dy;
        if (dragState.handle.includes('l')) { left += dx; width -= dx; }
        if (dragState.handle.includes('t')) { top += dy; height -= dy; }
      }

      cropBox.style.left = `${left}px`;
      cropBox.style.top = `${top}px`;
      cropBox.style.width = `${width}px`;
      cropBox.style.height = `${height}px`;
      clampCropBox();
    });

    cropBox.addEventListener('pointerup', () => { dragState = null; });
    window.addEventListener('resize', () => { if (video.src) setCropPreset('full'); });

    generateBtn.addEventListener('click', async () => {
      if (!video.src) {
        setStatus('Please upload a video first.', 0);
        return;
      }

      const start = Number(document.getElementById('startTime').value);
      const end = Number(document.getElementById('endTime').value);
      const fps = 18;
      const quality = Number(document.getElementById('quality').value);
      const widthSetting = document.getElementById('outputWidth').value;

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        setStatus('End time must be greater than start time.', 0);
        return;
      }

      const requestedDuration = end - start;
      if (requestedDuration > 12) {
        const ok = confirm('This is a long GIF export. For 4GB+ videos, 2–8 seconds is safer. Continue anyway?');
        if (!ok) return;
      }

      const safeEnd = Math.min(end, video.duration);
      const duration = safeEnd - start;
      const frameCount = Math.max(1, Math.ceil(duration * fps));
      if (frameCount > 360) {
        const ok = confirm(`This will capture ${frameCount} frames and may freeze your browser. Continue?`);
        if (!ok) return;
      }
      const crop = getCropInVideoPixels();

      if (crop.sw <= 0 || crop.sh <= 0) {
        setStatus('Invalid crop area. Please adjust the crop box.', 0);
        return;
      }

      const outputWidth = widthSetting === 'original' ? crop.sw : Math.min(Number(widthSetting), crop.sw);
      const outputHeight = Math.round(outputWidth * crop.sh / crop.sw);
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      generateBtn.disabled = true;
      resultSection.classList.add('hidden');
      setStatus('Generating GIF...', 0);

      const gif = new GIF({
        workers: 4,
        quality,
        width: outputWidth,
        height: outputHeight,
        workerScript: GIF_WORKER_URL,
        transparent: null
      });

      try {
        video.pause();

        for (let i = 0; i < frameCount; i++) {
          const t = start + i / fps;
          await waitForSeek(Math.min(t, safeEnd));
          ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outputWidth, outputHeight);
          gif.addFrame(ctx, { copy: true, delay: 1000 / fps });
          setStatus(`Capturing frame ${i + 1} of ${frameCount}...`, ((i + 1) / frameCount) * 70);
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        gif.on('progress', value => {
          setStatus(`Encoding GIF... ${Math.round(value * 100)}%`, 70 + value * 30);
        });

        gif.on('finished', blob => {
          const gifURL = URL.createObjectURL(blob);
          gifPreview.src = gifURL;
          downloadBtn.href = gifURL;
          resultSection.classList.remove('hidden');
          setStatus(`Done! GIF size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`, 100);
          generateBtn.disabled = false;
        });

        gif.render();
      } catch (error) {
        console.error(error);
        setStatus(`GIF generate failed: ${error.message || error}. Try shorter duration or smaller output width.`, 0);
        generateBtn.disabled = false;
      }
    });

    document.getElementById('setStartCurrent').addEventListener('click', () => {
  document.getElementById('startTime').value =
    video.currentTime.toFixed(1);
});

document.getElementById('setEndCurrent').addEventListener('click', () => {
  document.getElementById('endTime').value =
    video.currentTime.toFixed(1);
});

document.getElementById('setEndFull').addEventListener('click', () => {
  if (!Number.isFinite(video.duration)) {
    setStatus('Please upload a video first.', 0);
    return;
  }

  document.getElementById('endTime').value = video.duration.toFixed(1);
  setStatus(`End Time set to full video length: ${video.duration.toFixed(1)}s.`, null);
});

