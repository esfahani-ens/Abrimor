# Abrimor

Abrimor is a browser based 3D stamp and mold designer.

## Stamp & Mold Studio

The free, accountless browser edition supports:

- A hinge mechanism with alternating barrel sections around a shared pin axis, or a magnet mechanism with configurable pocket diameter, depth, and pair count.
- An editable hinge pin hole, set to 1.75 mm by default, with a clearance-sized pin included in the preview.
- Text, filled SVG logos, and repeating dot, wave, stripe, or diamond impressions.
- Separate male and female stamp bodies. The male impression is raised on its plate; the mirrored female impression is recessed into its own plate.
- Adjustable plate width, height, thickness and corner radius; relief height, impression depth, fit clearance, edge margin, design scale, rotation, mirroring, and X/Y placement.
- A 3D preview with simple, technical grid, and white inspection views. Dimension markers follow orbit and zoom.
- Separate binary STL downloads for the male or female plate, or a single combined STL containing both plates. The hinge pin has no separate download.
- Local project save, JSON download/import, and no sign-in or paid export flow.

## Run locally

Serve the repository root with any static web server, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000` in a modern browser. Three.js, its required add-ons, and the CSG/BVH modules are bundled under `vendor/`; their versions and license notices are listed in `vendor/THIRD_PARTY_LICENSES.md`. The typeface JSON and UI web fonts still load from CDNs, so text-font changes and the custom UI typeface need an internet connection.

## Model and input limits

The female cavity uses proportional design scaling as a fit allowance. It is not a true per-edge CAD offset. Hinge and magnet dimensions are a design preview, not manufacturing-qualified hardware; inspect clearances, wall thickness, magnet polarity, and test prints before production.

SVG files are simplified before mesh generation. For responsive preview, uploads are limited to 250 KB, 150 path elements, 36,000 path commands, and 72 filled regions. Each boundary is sampled at up to 144 points. Convert strokes to filled paths and simplify complex artwork in a vector editor. Raster/PNG tracing, curved text, a curated icon library, and 3MF export are not included yet.

This browser edition has not been validated in a slicer. Check each downloaded model before printing.