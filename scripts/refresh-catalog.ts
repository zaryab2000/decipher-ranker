import { main } from "./run-pipeline";

// Incremental refresh: no truncate — the pipeline's upserts make it idempotent.
void main(false);
