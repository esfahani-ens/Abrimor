# Abrimor

Abrimor is an online 3D stamp creator for the Abriform.

## Stamp Studio

The browser based MVP lives in `index.html`, `styles.css`, and `app.js`. It provides a live 3D preview, editable impression text, adjustable stamp dimensions, body color choices, orbit controls, and binary STL export.

### Run locally

Serve the repository root with any static web server and open its URL in a modern browser. For example:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`. The app loads Three.js modules and its display font from jsDelivr at runtime, so an internet connection is required.

### Current scope

This first browser edition creates a flat stamp body with raised, mirrored lettering. It exports the geometry as STL; it does not upload designs or send them to a printer. Check the exported model in your slicer before printing.
