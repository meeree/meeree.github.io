# Arm Wrestling Chain

A static, hostable website for a directed arm-wrestling result graph.

- Arrows point **winner → loser**.
- `global-graph.json` is the public graph seen by everyone.
- Each visitor's additions are stored in that browser's `localStorage`.
- Visitors can export their additions as a JSON submission.
- The site owner can merge submission files in the browser and download a replacement `global-graph.json`.
- Rare cycles are allowed and highlighted with dashed red arrows.

## Run locally

Because browsers usually block `fetch()` from `file://`, serve the folder over HTTP:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly still works, but it uses the embedded demo graph rather than loading `global-graph.json`.

## Host it

This is a static site. Upload the entire folder to GitHub Pages, Netlify, Cloudflare Pages, an S3 static site, or any ordinary web server.

No build step is required.

## Replace the demo graph

Edit `global-graph.json`:

```json
{
  "schemaVersion": 1,
  "graphVersion": "2026-08-01",
  "updatedAt": "2026-08-01T12:00:00.000Z",
  "people": [
    { "id": "james-hazelden", "name": "James Hazelden" },
    { "id": "person-b", "name": "Person B" }
  ],
  "matches": [
    {
      "id": "m-james-person-b",
      "winnerId": "james-hazelden",
      "loserId": "person-b",
      "date": "2026-07-31",
      "context": "Practice",
      "note": "Right arm"
    }
  ]
}
```

IDs must be unique. A match's `winnerId` and `loserId` must refer to existing people.

## Merge community submissions

1. Visitors click **Export my changes** or **Send for global review**.
2. Collect the resulting JSON files.
3. Open **Site-owner merge tools** at the bottom of the website.
4. Select all submission files.
5. Click **Merge and download global graph**.
6. Replace the hosted `global-graph.json` with the downloaded file.

The merge tool matches people case-insensitively by name and removes duplicate winner→loser connections.

## Optional submission endpoint

The static version downloads a JSON file. To submit directly to a server, edit `config.js`:

```js
window.ARM_GRAPH_CONFIG = {
  siteName: "Arm Wrestling Chain",
  submitMode: "endpoint",
  submissionEndpoint: "https://example.com/api/arm-wrestling-submissions",
  globalGraphUrl: "global-graph.json"
};
```

The browser sends:

```http
POST /api/arm-wrestling-submissions
Content-Type: application/json
```

The request body has this shape:

```json
{
  "schemaVersion": 1,
  "type": "arm-wrestling-graph-submission",
  "baseGraphVersion": "2026-08-01",
  "exportedAt": "2026-08-01T12:00:00.000Z",
  "people": [],
  "matches": []
}
```

Your endpoint should validate and store submissions for moderation. It should **not** automatically modify the public graph without review, since names and match claims are user-supplied.

## Main files

- `index.html` — interface
- `styles.css` — responsive styling
- `app.js` — graph, local storage, cycle detection, export, and merge logic
- `config.js` — site and submission settings
- `global-graph.json` — curated public data

## Dependency notes

The page pins Cytoscape.js and the Cytoscape Dagre layout extension to exact CDN versions. For a fully offline deployment, download those two scripts and change the `<script src>` paths in `index.html` to local files.
