export function openPDFOverlay(url, moduleName) {
  const pdfOverlay = document.getElementById("pdf-overlay")
  const pdfOverlayFrame = document.getElementById("pdf-overlay-frame")
  const pdfOverlayTitle = document.getElementById("pdf-overlay-title")

  pdfOverlayFrame.src = url + "#toolbar=0"
  pdfOverlayTitle.textContent = moduleName || "Policy Document"
  pdfOverlay.classList.remove("hidden")
  document.body.style.overflow = "hidden"
}

export function closePDFOverlay() {
  const pdfOverlay = document.getElementById("pdf-overlay")
  const pdfOverlayFrame = document.getElementById("pdf-overlay-frame")

  pdfOverlay.classList.add("hidden")
  pdfOverlayFrame.src = ""
  document.body.style.overflow = ""
}

