const uploadInput = document.getElementById('gif-upload');
const compressBtn = document.getElementById('compress-btn');
const fileInfo = document.getElementById('file-info');
const statusMsg = document.getElementById('status');
const resultArea = document.getElementById('result-area');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const progressPercent = document.getElementById('progress-percent');

let selectedFile = null;

uploadInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        fileInfo.textContent = `選択済み: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`;
        compressBtn.disabled = false;
        resultArea.style.display = 'none';
        statusMsg.textContent = '';
    }
});

async function getWorkerBlobUrl(url) {
    const response = await fetch(url);
    const code = await response.text();
    const blob = new Blob([code], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}

compressBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    compressBtn.disabled = true;
    statusMsg.textContent = '解析中...';
    progressContainer.style.display = 'block';
    
    try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const gifReader = new window.GifReader(uint8Array);
        
        const width = gifReader.width;
        const height = gifReader.height;
        const frameCount = gifReader.numFrames();

        const MAX_BYTES = 8 * 1024 * 1024;
        const TARGET_BYTES = 8 * 1024 * 1024;
        
        let scale = 1.0;
        let quality = 10;

        if (selectedFile.size > MAX_BYTES) {
            scale = Math.sqrt(TARGET_BYTES / selectedFile.size) * 0.85;
            scale = Math.max(0.1, Math.min(1.0, scale));
            quality = 15; 
        }

        const targetWidth = Math.floor(width * scale);
        const targetHeight = Math.floor(height * scale);

        console.log(`Original: ${selectedFile.size} bytes, Scale: ${scale}, Quality: ${quality}`);
        // ----------------------------------

        const workerUrl = await getWorkerBlobUrl('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');

        const gif = new GIF({
            workers: 2,
            quality: quality,
            width: targetWidth,
            height: targetHeight,
            workerScript: workerUrl
        });

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        for (let i = 0; i < frameCount; i++) {
            const frameInfo = gifReader.frameInfo(i);
            const frameData = new Uint8ClampedArray(width * height * 4);
            gifReader.decodeAndBlitFrameRGBA(i, frameData);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            const imageData = new ImageData(frameData, width, height);
            tempCtx.putImageData(imageData, 0, 0);

            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

            gif.addFrame(ctx, {
                copy: true,
                delay: frameInfo.delay * 10
            });
            updateProgress(Math.round((i / frameCount) * 50));
        }

        gif.on('progress', (p) => {
            updateProgress(50 + Math.round(p * 50));
        });

        gif.on('finished', (blob) => {
            if (blob.size > MAX_BYTES) {
                statusMsg.style.color = "orange";
                statusMsg.textContent = "まだ8MBを超えています。設定を下げて再試行中...";
            } else {
                statusMsg.style.color = "green";
                statusMsg.textContent = "完了！8MB以下に最適化しました。";
            }
            showResult(blob);
            URL.revokeObjectURL(workerUrl);
        });

        statusMsg.textContent = '圧縮中...（8MB以下に調整中）';
        gif.render();

    } catch (err) {
        console.error(err);
        statusMsg.style.color = "red";
        statusMsg.textContent = 'エラー: ' + err.message;
        compressBtn.disabled = false;
    }
});

function updateProgress(val) {
    progressBar.value = val;
    progressPercent.textContent = val;
}

function showResult(blob) {
    progressContainer.style.display = 'none';
    compressBtn.disabled = false;

    const originalUrl = URL.createObjectURL(selectedFile);
    const compressedUrl = URL.createObjectURL(blob);

    document.getElementById('original-gif').src = originalUrl;
    document.getElementById('compressed-gif').src = compressedUrl;
    document.getElementById('original-size').textContent = (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB';
    document.getElementById('compressed-size').textContent = (blob.size / 1024 / 1024).toFixed(2) + ' MB';

    const downloadLink = document.getElementById('download-link');
    downloadLink.href = compressedUrl;
    resultArea.style.display = 'block';
}