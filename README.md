{
  "definitionVersion": 1,
  "actorId": "uplifted_novice_vbl/bluesky-keyword-mention-alerts",
  "taskName": "track-bluesky-security-keywords",
  "publication": {
    "slug": "track-bluesky-security-keywords",
    "seoTitle": "Track Bluesky Security Keywords",
    "seoDescription": "Preview Bluesky posts about cybersecurity, data breaches, and vulnerabilities as JSON. Set onlyNew=true on a saved Task for alerts.",
    "displayedInputFields": [
      "keywords",
      "langs",
      "onlyNew",
      "maxPostsPerRun"
    ],
    "datasetView": "overview"
  },
  "input": {
    "keywords": [
      "cybersecurity",
      "data breach",
      "vulnerability"
    ],
    "handles": [],
    "hashtags": [],
    "excludeTerms": [],
    "langs": [
      "en"
    ],
    "onlyNew": false,
    "maxPostsPerRun": 10,
    "sort": "latest",
    "resetState": false
  },
  "discoveryValidation": {
    "timeoutSeconds": 300,
    "expectedMinimumDatasetItems": 1,
    "reason": "Active security terms with a bounded ten-record preview."
  },
  "monitoringChange": {
    "onlyNew": true,
    "persistentTaskRequired": true,
    "note": "Copy the Task, adapt the security terms, set onlyNew to true, and schedule that same Task."
  }
}
