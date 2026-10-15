# Abrimor

Abrimor is a browser based 3D stamp and mold designer.

## Stamp & Mold Studio

The free browser edition supports:

- Hinged or magnet-coupled stamp layouts.
- Text, filled SVG logos, and repeat patterns (dots, waves, stripes, diamonds).
- Separate male and female stamp bodies with editable dimensions, corner radius, relief, impression depth, fit offset, design scale, rotation, and X/Y placement.
- Live 3D preview with simple, technical, and white inspection views.
- Separate binary STL exports for the male and female parts, plus a hinge pin.
- Local project save, JSON download, and JSON project import.

## Run locally

Serve the repository root with any static web server, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000` in a modern browser. The app loads Three.js, its font, and the boolean geometry module from CDNs, so first use requires an internet connection.

## Engineering note

The model is intended as a starting point for personal stamp design and should be inspected in a slicer and test printed before production. Printer tolerances, material behavior, hinge fit, magnet polarity, and actual stamp pressure vary. The fit offset is an approximate proportional cavity expansion; it is not a validated per-edge CAD offset. The magnet mechanism makes pocket pairs in both halves; use matching magnets and verify polarity before assembly.

This edition is client-side. It does not require an account, charge for exports, upload designs, or include paid tiers. SVG import currently expects filled paths. 3MF export, raster/PNG tracing, curved text, and a curated icon library are not included yet.
