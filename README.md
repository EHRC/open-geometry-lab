# Open Geometry Lab

A compact, browser-based dynamic geometry workspace inspired by classic construction tools such as Cabri Geometry. Create linked Euclidean constructions, drag free points, and watch dependent objects update in real time.

**Live app:** https://ehrc.github.io/open-geometry-lab/

## What it can do

- Construct free points, segments, infinite lines, circles, and polygons
- Create a linked square from any side with two clicks
- Add midpoints, perpendicular lines, and intersection points
- Find a segment midpoint with one click, or choose any two points
- Drag free points while preserving construction dependencies
- Hold Alt while dragging a linked point to lock rotation to 15°, 30°, 45°, or 90° increments
- Inspect lengths, radii, areas, and point coordinates
- Hide and restore individual construction objects
- Toggle the grid, half-unit snapping, and labels
- Snap new or dragged geometry to nearby visible points
- Undo and redo up to 50 changes
- Save automatically in the browser
- Import and export construction files as JSON
- Export the drawing as SVG
- Work on desktop, tablet, or mobile without an account

## Run locally

```bash
npm install
npm run dev
```

Run the test suite and production build:

```bash
npm test
npm run build
```

## Design

The app stores a small declarative construction document. Every entity references its parent points or curves by ID. React owns history, persistence, and interface state; [JSXGraph](https://jsxgraph.org/) resolves and renders the linked geometry.

No backend is required. Construction data stays in the browser unless the user exports a file.

## Scope

This is a deliberately focused alternative, not a complete Cabri clone. It currently targets common compass-and-straightedge workflows. Angles, transformations, loci, macros, and collaborative documents are natural future additions.

## Development note

The initial implementation was created with OpenAI Codex assistance and reviewed through automated model tests, a production build, and browser interaction checks.

## License

[MIT](LICENSE)
