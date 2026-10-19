// Access the globally loaded libraries from the HTML head tags
const pdfjsLib = window['pdfjs-dist/build/pdf'];
const { PDFDocument } = window['PDFLib'];

console.log("pdfjsLib and PDFDocument loaded:", pdfjsLib, PDFDocument);

// Point the worker to the exact CDN file
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.6.347/build/pdf.worker.min.js";

console.log("pdfjsLib.GlobalWorkerOptions.workerSrc set to:", pdfjsLib.GlobalWorkerOptions.workerSrc);

document.getElementById('convert-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('pdf-file');
  const files = Array.from(fileInput.files || []);
  if (!files.length) return alert('Please select at least one PDF first.');

  const downloadLinks = document.getElementById('download-links');
  const progressBar = document.getElementById('progress-bar');
  downloadLinks.innerHTML = '';
  progressBar.style.width = '0%';

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    console.log("Selected file:", file.name, "Size:", file.size, "Type:", file.type);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      const newPdf = await PDFDocument.create();

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const progress = ((fileIndex + (i / pdfDoc.numPages)) / files.length) * 100;
        progressBar.style.width = `${progress}%`;

        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 3.0 });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let j = 0; j < data.length; j += 4) {
          const r = data[j];
          const g = data[j + 1];
          const b = data[j + 2];

          const maxChannel = Math.max(r, g, b);
          const minChannel = Math.min(r, g, b);
          const colorVariance = maxChannel - minChannel;

          if (colorVariance > 254) {
            data[j] = r;
            data[j + 1] = g;
            data[j + 2] = b;
          } else {
            const avg = 0.05 * r + 0.85 * g + 0.10 * b;
            const binaryColor = avg < 215 ? 0 : 255;

            data[j] = binaryColor;
            data[j + 1] = binaryColor;
            data[j + 2] = binaryColor;
          }
        }
        ctx.putImageData(imgData, 0, 0);

        const pngDataUrl = canvas.toDataURL('image/png');
        const pngImage = await newPdf.embedPng(pngDataUrl);
        const newPage = newPdf.addPage([viewport.width / 2, viewport.height / 2]);
        newPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: newPage.getWidth(),
          height: newPage.getHeight(),
        });
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const outputName = file.name.replace(/\.pdf$/i, '') + '-grayscale.pdf';

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = outputName;
      downloadLink.style.display = 'block';
      downloadLink.style.marginTop = '8px';
      downloadLink.textContent = `Download Grayscale PDF (${file.name})`;
      downloadLinks.appendChild(downloadLink);
      console.log('Created download link for', outputName);
    } catch (error) {
      console.error(`Error during PDF processing for ${file.name}:`, error);
      const errorLink = document.createElement('div');
      errorLink.textContent = `Failed to convert ${file.name}`;
      errorLink.style.color = 'red';
      downloadLinks.appendChild(errorLink);
    }
  }

  progressBar.style.width = '100%';
});
