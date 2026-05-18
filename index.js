// Root entry point for Hostinger Node.js hosting.
// Starts the Next.js app located in the web/ subdirectory.
const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");

const WEB_DIR = path.join(__dirname, "web");

// Change working directory to web/ so Next.js finds its files
process.chdir(WEB_DIR);

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const next = require(path.join(WEB_DIR, "node_modules", "next"));
const app = next({ dev, hostname, port, dir: WEB_DIR });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  }).listen(port, hostname, () => {
    console.log(`> CMS Market Intelligence ready on port ${port}`);
  });
});
