# Abrimor

Abrimor is a browser based 3D stamp and mold designer.

## Stamp & Mold Studio

The free, accountless browser edition supports:

- A hinge mechanism with interleaved barrel sections around a shared pin axis, or a magnet mechanism with configurable pocket diameter, depth, and pair count.
- Text, filled SVG logos, and repeating dot, wave, stripe, or diamond impressions.
- Separate male and female stamp bodies. The male impression is joined to the plate as raised geometry; the female impression is cut into its plate.
- Adjustable plate width, height, thickness and corner radius; relief height, impression depth, fit clearance, edge margin, design scale, rotation, mirroring, and X/Y placement.
- A 3D preview with simple, technical grid, and white inspection views. Dimension markers are projected from the model and follow orbit and zoom.
- Separate binary STL downloads for the male and female parts, and a hinge pin.
- Local project save, JSON download/import, and no sign-in or paid export flow.

## Run locally

Serve the repository root with any static web server, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000` in a modern browser. Three.js, its fonts, and the boolean geometry module load from CDNs, so first use requires an internet connection.

## Model and input limits

The female cavity uses proportional design scaling as a fit allowance. It is not a true per-edge CAD offset. Hinge and magnet dimensions are a design preview, not manufacturing-qualified hardware; inspect clearances, wall thickness, magnet polarity, and test prints before production.

SVG files are simplified before mesh generation. For a responsive browser preview, uploads are limited to 350 KB, 80 path elements, and 40 filled regions. Convert strokes to filled paths and simplify complex artwork in a vector editor. Raster/PNG tracing, curved text, a curated icon library, and 3MF export are not included yet.

This browser edition is an early implementation and has not been validated in a slicer. Check each downloaded model before printing.
