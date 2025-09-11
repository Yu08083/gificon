document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('gif-upload');
    const compressBtn = document.getElementById('compress-btn');
    const statusDiv = document.getElementById('status');
    const resultArea = document.getElementById('result-area');
    const originalGif = document.getElementById('original-gif');
    const compressedGif = document.getElementById('compressed-gif');
    const originalSizeSpan = document.getElementById('original-size');
    const compressedSizeSpan = document.getElementById('compressed-size');
    const downloadLink = document.getElementById('download-link');
    const fileInfoDiv = document.getElementById('file-info');
    const fileLabelText = document.querySelector('.file-label-text');

    let uploadedFile = null;

    fileInput.addEventListener('change', (event) => {
        uploadedFile = event.target.files[0];
        if (uploadedFile) {
            compressBtn.disabled = false;
            fileLabelText.textContent = 'ファイルが選択されました';
            fileInfoDiv.textContent = `${uploadedFile.name} (${formatBytes(uploadedFile.size)})`;
            statusDiv.textContent = '「圧縮を開始」ボタンをクリックしてください。';
            resultArea.style.display = 'none';

            // 元のGIFをプレビュー
            const reader = new FileReader();
            reader.onload = (e) => {
                originalGif.src = e.target.result;
                originalSizeSpan.textContent = formatBytes(uploadedFile.size);
            };
            reader.readAsDataURL(uploadedFile);
        } else {
            // ファイル選択をキャンセルした場合
            compressBtn.disabled = true;
            fileLabelText.textContent = 'GIFファイルを選択';
            fileInfoDiv.textContent = '';
            statusDiv.textContent = '';
        }
    });

    compressBtn.addEventListener('click', async () => {
        if (!uploadedFile) {
            statusDiv.textContent = 'ファイルを選択してください。';
            return;
        }

        statusDiv.textContent = '圧縮中...しばらくお待ちください。';
        compressBtn.disabled = true;

        try {
            const data = await uploadedFile.arrayBuffer();
            const decompressor = new jsgif.GifDecompressor(data);
            const frames = decompressor.getFrames();
            
            // 圧縮ロジック
            const targetSizeMB = 8;
            const targetSizeBytes = targetSizeMB * 1024 * 1024;
            let quality = 15; // 初期品質を少し下げて、より早く圧縮を試行
            let compressedBlob = null;
            let size = Infinity;

            // 試行錯誤で品質を調整
            while (size > targetSizeBytes && quality < 30) {
                const newGif = new jsgif.GifWriter();
                
                for (let i = 0; i < frames.length; i++) {
                    newGif.addFrame(frames[i].data, frames[i].width, frames[i].height, {
                        quality: quality,
                        delay: frames[i].delay,
                        dispose: frames[i].dispose,
                        palettes: frames[i].palettes
                    });
                }
                
                compressedBlob = new Blob([newGif.getGif()], { type: 'image/gif' });
                size = compressedBlob.size;
                quality += 1; // 1ずつ品質を下げて再試行
            }
            
            const compressedUrl = URL.createObjectURL(compressedBlob);
            
            compressedGif.src = compressedUrl;
            compressedSizeSpan.textContent = formatBytes(size);
            
            downloadLink.href = compressedUrl;
            downloadLink.style.display = 'inline-block';

            statusDiv.textContent = '圧縮が完了しました！';
            resultArea.style.display = 'block';

        } catch (error) {
            statusDiv.textContent = `エラーが発生しました: ${error.message}`;
            console.error(error);
        } finally {
            compressBtn.disabled = false;
        }
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }
});