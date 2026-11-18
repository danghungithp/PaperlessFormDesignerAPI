import { proxyTemplateRequest } from "../src/template-proxy.js";

export default proxyTemplateRequest;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "300kb",
    },
  },
};
