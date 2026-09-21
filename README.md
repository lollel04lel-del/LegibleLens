# LegibleLens

Class project: select text in images, recognize it with OCR, edit/copy the result, and look up word meanings and readings.

## Development direction

1. Build and test the OCR web application in VS Code.
2. Add manga text-block detection, Japanese manga OCR, selectable overlays, and Yomitan-style dictionary lookup.
3. Package an Opera GX / Chromium extension with Manifest V3 and browser-specific capture permissions.
4. Package an Android application with Capacitor, the Android SDK, and Gradle. Test on an emulator or Android device and produce an APK.
5. Publish source to the selected GitHub repository. Release signing and distribution are separate steps.

The web UI and core logic are shared. Browser capture and Android device integration require platform-specific code. The first browser prototype supports English and Japanese OCR, touch region selection, editable text, copying, and text download. GitHub Actions now packages the shared prototype as both an Opera GX extension and an Android debug APK. Dictionary lookup, manga-trained OCR, Japanese-to-Mongolian translation, and full extension capture remain to be implemented.

The target behavior is defined in [the Yomitan-style manga OCR research](docs/yomitan-ocr-research.md). Yomitan itself is a popup dictionary rather than an OCR engine, so LegibleLens must create a selectable OCR text layer first. Android Chrome does not support Yomitan; the web app and APK therefore need their own dictionary popup.

## MCP connection

This workspace uses the official `@modelcontextprotocol/server-filesystem` package, pinned in `tools/mcp/package.json` and `pnpm-lock.yaml`.

- VS Code configuration: `.vscode/mcp.json` (local machine paths).
- Codex configuration: registered as `legiblelens-files` in the user's MCP settings.
- Transport: local stdio; the client starts the server when needed. No network listener or startup task is required.
- Access: this project directory is supplied as the allowed root. MCP clients that advertise Roots can replace the allowed roots; keep those limited to this project.
- Capabilities: file reading, writing, editing, listing, and searching. This is a shared-file connection, not remote control of VS Code windows, unsaved buffers, debugging, or terminals.
- Build/test commands currently run in the local terminal, not through this filesystem MCP server.

Run `node tools/mcp/verify.mjs` to verify MCP initialization, discovery, writing, editing, reading, and rejection of access outside the configured project root.

After adding the server, restart/reload the Codex MCP connection for its tools to appear in a new session. In VS Code, use **MCP: List Servers** and choose **legiblelens-files** to inspect/start it. VS Code may request workspace/server trust.

The server is configured and independently tested; registration alone does not prove that either editor has loaded it into its active agent session.

## Repository and generated builds

The source is published at [github.com/lollel04lel-del/LegibleLens](https://github.com/lollel04lel-del/LegibleLens). Open the latest successful [Build LegibleLens artifacts run](https://github.com/lollel04lel-del/LegibleLens/actions/workflows/build.yml) and download:

- `legiblelens-debug-apk`, then unzip it and install `app-debug.apk` on an Android test phone. Android may ask you to allow installation from the browser or file manager used to open it.
- `legiblelens-opera-extension`, then unzip it, open `opera://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder.

These are test builds. The APK is debug-signed and should not be submitted to an app store. Opera store publication and a release-signed Android build are later release steps.

## Browser testing

Install dependencies with pnpm install (Node 18+). The prepare script downloads the English and Japanese OCR models. Start with node server.mjs. Open http://localhost:4173 on the PC or http://192.168.0.250:4173 on a phone connected to the same router. The PC must remain running; its IP address can change.

Click Try a sample image, then Recognize text. The sample should return Make every image readable. and Welcome to LegibleLens. For your own files, choose a JPG, PNG, or WEBP up to 20 MB. OCR runs in the browser; image files are not uploaded. The preview server exposes only the app and OCR assets, not the repository or MCP configuration.

Verification: real English OCR succeeded in the desktop browser over the LAN URL. Physical Android testing is still pending. Local HTTP clipboard restrictions are handled with selection/copy fallback. For Japanese, start with clear horizontal printed text; manga accuracy is not guaranteed.

## Build targets

- `pnpm test` builds the shared web app and Opera GX extension, then checks the artifacts.
- `pnpm start` serves the browser version on port 4173.
- `pnpm android:sync` copies the latest shared build into the Capacitor Android project.
- `pnpm android:build` produces a debug APK when Java and the Android SDK are installed.
- `dist/extension` is the unpacked Manifest V3 extension directory for Opera GX developer mode.

The GitHub Actions workflow in `.github/workflows/build.yml` builds an extension ZIP and Android debug APK on every push to `main`, pull request, or manual run. A public release APK requires a signing key.

The complete implementation order is in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md). The OCR model and Japanese-to-Mongolian evaluation remain the main project; the web app, extension, and APK are shared clients.

The core work begins in `training/` and `services/ocr-api/`. All clients will consume the normalized OCR block contract in `services/ocr-api/contracts/ocr-block.schema.json`, keeping Japanese OCR output separate from its Mongolian translation.
