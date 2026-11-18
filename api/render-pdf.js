module.exports = async function handler(request, response) {
  const { default: renderPdfHandler } = await import("../worker/api/render-pdf.js");
  return renderPdfHandler(request, response);
};
