/*
  Site-owner configuration.

  submitMode:
    "download" - the review button downloads a JSON submission.
    "endpoint" - POSTs JSON to submissionEndpoint. Falls back to download on failure.

  Your endpoint should accept application/json and return a 2xx response.
*/
window.ARM_GRAPH_CONFIG = {
  siteName: "Bingo Arm",
  submitMode: "download",
  submissionEndpoint: "",
  globalGraphUrl: "global-graph.json"
};
