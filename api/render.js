module.exports = async function handler(request, response) {
  const { default: renderHandler } = await import("../worker/api/render.js");
  return renderHandler(request, response);
};
