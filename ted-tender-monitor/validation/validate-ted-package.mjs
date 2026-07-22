import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(fullPath));
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

const taskFiles = (await filesUnder(path.join(root, 'apify-tasks'))).filter((file) => file.endsWith('.json'));
assert.equal(taskFiles.length, 3, 'Expected exactly three TED Task definitions');
for (const file of taskFiles) {
  const task = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(task.publication?.datasetView, 'overview', `${file}: dataset view must be overview`);
  assert.equal(task.input?.sampleMode, true, `${file}: discovery Task must use sampleMode=true`);
  assert.notEqual(task.input?.resetState, true, `${file}: resetState must not be enabled`);
  assert.equal(task.expectedBehavior?.maximumRunSeconds, 300, `${file}: discovery timeout must remain five minutes`);
}

const sample = JSON.parse(await readFile(path.join(root, 'fixtures', 'sample-output.json'), 'utf8'));
assert.equal(sample.filter((record) => record.recordType === 'tender').length, 1);
assert.equal(sample.filter((record) => record.recordType === 'summary').length, 1);

const terminalScenarios = JSON.parse(await readFile(path.join(root, 'fixtures', 'terminal-run-scenarios.json'), 'utf8'));
assert.equal(terminalScenarios.length, 4, 'Expected four terminal-run scenarios');
const store = new Map();
for (const scenario of terminalScenarios) {
  assert.equal(scenario.run.status, 'FAILED');
  const hasDataset = typeof scenario.run.defaultDatasetId === 'string';
  assert.equal(scenario.expected.datasetFetched, hasDataset, `${scenario.scenario}: dataset fetch expectation mismatch`);
  const records = scenario.dataset ?? [];
  assert.equal(scenario.expected.recordsPersisted, records.length, `${scenario.scenario}: persistence count mismatch`);
  const keys = records.map((record, index) => record.recordType === 'tender' && record.publicationNumber
    ? `ted:${record.publicationNumber}`
    : `ted:run:${scenario.run.id}:row:${index}`);
  assert.deepEqual(scenario.expected.deliveryKeys ?? [], keys, `${scenario.scenario}: stable keys mismatch`);
  records.forEach((record, index) => store.set(keys[index], record));
  assert.equal(scenario.expected.terminalFailureReportedAfterIngestion, true);
  if (scenario.replayOf) assert.equal(store.size, scenario.expected.uniqueRecordsAfterReplay, 'Replay created a duplicate row');
}
const nullTitleScenario = terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_WITH_COMMITTED_NULL_TITLE_TENDER');
const nullTitleTender = nullTitleScenario.dataset[0];
assert.equal(nullTitleTender.title, null, 'Null-title tender fixture must preserve null');
assert.equal(nullTitleScenario.expected.displayTitle, `Tender ${nullTitleTender.publicationNumber}`);
assert.equal(nullTitleScenario.expected.tendersExposed, 1, 'Null-title tender must not be rejected or skipped');
assert.equal(terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_EMPTY_DATASET').expected.safeEmptyResult, true);
assert.equal(terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_WITHOUT_DATASET_ID').dataset, null);

const workflowText = await readFile(path.join(root, 'n8n', 'ted-tender-monitor.json'), 'utf8');
const workflow = JSON.parse(workflowText);
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const runNode = nodes.get('Run persistent TED monitoring Task');
const datasetNode = nodes.get('Fetch terminal run dataset');
const prepareNode = nodes.get('Prepare every dataset record');
const destinationNode = nodes.get('Upsert committed TED records');
const outcomeNode = nodes.get('Report terminal outcome after ingestion');
assert.equal(runNode.parameters.operation, 'Run task');
assert.equal(runNode.parameters.waitForFinish, true);
assert.equal(runNode.parameters.useCustomBody, false);
assert.equal(datasetNode.parameters.resource, 'Datasets');
assert.equal(datasetNode.parameters.operation, 'Get items');
assert.equal(datasetNode.alwaysOutputData, true);
assert.match(datasetNode.parameters.datasetId, /defaultDatasetId/);
assert.equal(datasetNode.parameters.offset, 0, 'n8n dataset retrieval must start at offset 0');
assert.equal(datasetNode.parameters.limit, 1000, 'n8n dataset retrieval limit must remain 1000');
assert.equal(datasetNode.retryOnFail, true);
assert.equal(datasetNode.maxTries, 3);
assert.equal(datasetNode.waitBetweenTries, 5000);
assert.match(datasetNode.notes, /intentionally non-paginated/i);
assert.match(datasetNode.notes, /maxNewPerRun must be no greater than 999/i);
assert.match(datasetNode.notes, /exactly one summary control row/i);
assert.match(datasetNode.notes, /account-gated validation/i);
assert.equal(destinationNode.type, 'n8n-nodes-base.dataTable');
assert.equal(destinationNode.parameters.operation, 'upsert');
assert.equal(destinationNode.retryOnFail, true);
assert.equal(destinationNode.maxTries, 3);
assert.equal(destinationNode.waitBetweenTries, 5000);
assert.equal(destinationNode.parameters.filters.conditions[0].keyName, 'deliveryKey');
assert.match(prepareNode.parameters.jsCode, /record\.title \?\? null/);
assert.match(prepareNode.parameters.jsCode, /Tender \$\{record\.publicationNumber\}/);
assert.doesNotMatch(prepareNode.parameters.jsCode, /title.*required/i);
assert.match(outcomeNode.parameters.jsCode, /after \$\{records\.length\} committed dataset record/);
assert.equal(workflow.nodes.some((node) => node.parameters?.operation === 'Run task and get dataset'), false);
assert.notEqual(runNode.retryOnFail, true, 'The Task itself must never be retried');
assert.equal(workflowText.includes('"credentials"'), false, 'n8n workflow must not bind credentials');

const make = JSON.parse(await readFile(path.join(root, 'make', 'module-spec.json'), 'utf8'));
const makeDatasetRouter = make.modules.find((module) => module.routes?.datasetAvailable);
const makeDataset = make.modules.find((module) => module.label === 'HTTP Get Dataset Items');
const makeListRuns = make.modules.find((module) => module.label === 'HTTP List Task Runs');
const makeRunCheckpoint = make.modules.find((module) => module.label === 'Write Run Checkpoint');
const makeModulesByOrder = new Map(make.modules.map((module) => [module.order, module]));
const makeDestinations = make.modules.filter((module) => module.app === 'Data store' && module.module === 'Add/Replace a Record' && module.label !== 'Write Run Checkpoint');
const identifiedTenderDestination = makeModulesByOrder.get(13);
const runScopedDestination = makeModulesByOrder.get(14);
const classificationRouter = makeModulesByOrder.get(12);
const diagnosticRouter = makeModulesByOrder.get(15);
const destinationRetry = make.errorHandlers.destination;
const implementationText = await readFile(path.join(root, 'make', 'implementation.md'), 'utf8');
assert.equal(make.architecture, 'APIFY_SCHEDULE_TO_HTTP_POLLING_RECONCILER');
assert.equal(make.scenarioSettings.processInOrder, true, 'Make must avoid overlapping executions for run checkpoints');
assert.equal(make.modules.some((module) => module.app === 'Apify' || module.module === 'Watch Task Runs' || module.module === 'Get Dataset Items'), false, 'Make must not use the official Apify connector modules');
assert.equal(makeListRuns.configuration.method, 'GET');
assert.match(makeListRuns.configuration.url, /\/actor-tasks\/\{\{TASK_ID\}\}\/runs\?desc=1&limit=1000&offset=0$/);
assert.equal(makeListRuns.configuration.headers.find((header) => header.name === 'Authorization').value, 'Bearer <APIFY_TOKEN_PLACEHOLDER>');
assert.equal(makeListRuns.runWindow.limit, 1000);
assert.match(makeListRuns.runWindow.sort, /reverse the fetched page/i);
assert.match(makeListRuns.runWindow.overflowGuard, /no checkpointed terminal run boundary/i);
assert.equal(make.taskLaunch.requirements.pollRunLimit, 1000);
assert.equal(make.taskLaunch.requirements.overflowStopIfNoCheckpointBoundary, true);
assert.equal(make.taskLaunch.requirements.overflowStopBeforeProcessing, true);
assert.equal(make.taskLaunch.requirements.preflightExistingCheckpointRead, true);
assert.equal(make.taskLaunch.requirements.runOrdering, 'reverse-fetched-desc-page-before-processing');
assert.deepEqual(make.taskLaunch.requirements.preflightModules, [2, 3, 4]);
assert.equal(make.modules.find((module) => module.label === 'Preflight Existing Run Checkpoints').order, 2);
assert.equal(make.modules.find((module) => module.label === 'Preflight Overflow Guard').order, 3);
assert.match(JSON.stringify(make.modules.find((module) => module.label === 'Overflow Guard Router')), /must not reach module 5/);
assert.match(makeDatasetRouter.routes.datasetAvailable, /run status is terminal/i);
assert.doesNotMatch(makeDatasetRouter.routes.datasetAvailable, /SUCCEEDED/);
assert.equal(makeDataset.route, 'datasetAvailable');
assert.equal(make.taskLaunch.requirements.maxNewPerRunAtMost, 999);
assert.equal(make.taskLaunch.requirements.summaryRowsPerRun, 1);
assert.equal(make.taskLaunch.requirements.datasetRetrievalLimit, 1000);
assert.equal(make.taskLaunch.requirements.paginationEnabled, false);
assert.equal(make.taskLaunch.requirements.makePollIntervalCoversRunWindow, true);
assert.equal(makeDataset.configuration.method, 'GET');
assert.match(makeDataset.configuration.url, /\/datasets\/\{\{module 5 defaultDatasetId\}\}\/items\?format=json&clean=1&offset=0&limit=1000$/);
assert.equal(makeDataset.configuration.headers.find((header) => header.name === 'Authorization').value, 'Bearer <APIFY_TOKEN_PLACEHOLDER>');
assert.equal(makeDataset.configuration.limit, 1000);
assert.equal(makeDataset.configuration.paginationEnabled, false);
assert.equal(make.taskLaunch.requirements.maxNewPerRunAtMost + make.taskLaunch.requirements.summaryRowsPerRun, makeDataset.configuration.limit, 'TED 999 tender rows plus one summary must exactly fit retrieval limit 1000');
assert.match(makeDataset.capInvariant, /exactly one summary control row/i);
assert.deepEqual(make.modules.map((module) => module.order), Array.from({ length: 21 }, (_, index) => index + 1), 'Make module orders must be unique and contiguous');
assert.equal(makeDestinations.length, 2, 'Make must define exactly two Data store Add/Replace sinks');
assert.equal(identifiedTenderDestination, makeDestinations[0], 'Module 13 must be the identified-tender sink');
assert.equal(runScopedDestination, makeDestinations[1], 'Module 14 must be the run-scoped sink');
assert.deepEqual(classificationRouter.routes, {
  identifiedTender: 'recordType = tender AND publicationNumber exists',
  runScopedRecord: 'recordType != tender OR publicationNumber missing',
});
assert.equal(identifiedTenderDestination.route, 'identifiedTender');
assert.equal(identifiedTenderDestination.configuration.key, 'ted:{{module 11 publicationNumber}}');
assert.equal(identifiedTenderDestination.idempotencyKey, 'ted:publicationNumber');
assert.equal(runScopedDestination.route, 'runScopedRecord');
assert.equal(runScopedDestination.configuration.key, 'ted:run:{{module 5 id}}:row:{{module 11 bundle order}}');
assert.equal(runScopedDestination.idempotencyKey, 'ted:run:runId:row:bundleOrder');
for (const destination of makeDestinations) {
  assert.equal(destination.configuration.overwriteExistingRecord, true, `Module ${destination.order} must enable overwrite`);
  assert.match(destination.configuration.record.payloadJson, /original dataset record; title:null remains null here/);
  assert.match(destination.nativeIdempotency, /exactly one record/i);
}
assert.match(identifiedTenderDestination.normalizedOutput.title, /string or null, preserved/);
assert.equal(diagnosticRouter.module, 'Router');
assert.equal(diagnosticRouter.route, 'after module 14');
assert.deepEqual(diagnosticRouter.routes, {
  invalidTenderDiagnostic: 'recordType = tender AND publicationNumber missing',
  terminalFailureDiagnostic: 'status != SUCCEEDED',
});
assert.equal(makeModulesByOrder.get(16).route, 'module 15 invalidTenderDiagnostic');
assert.equal(makeModulesByOrder.get(17).route, 'module 15 terminalFailureDiagnostic');
assert.equal(makeModulesByOrder.get(18).route, 'after module 13 when status != SUCCEEDED');
assert.equal(makeModulesByOrder.get(19).route, 'emptyDataset');
assert.equal(makeModulesByOrder.get(20).route, 'missingDataset');
assert.match(make.terminalFailureRoute.identifiedTenderRows, /module 18.*module 13 persisted ted:<publicationNumber>/);
assert.match(make.terminalFailureRoute.runScopedRows, /module 17.*module 14 persisted ted:run:<runId>:row:<bundleOrder>/);
assert.match(make.terminalFailureRoute.emptyDataset, /module 19.*zero-row dataset/);
assert.match(make.terminalFailureRoute.missingDataset, /module 20.*does not request dataset items/);
assert.deepEqual(destinationRetry.modules, [13, 14]);
assert.deepEqual(destinationRetry.idempotencyKeys, {
  module13: 'ted:publicationNumber',
  module14: 'ted:run:runId:row:bundleOrder',
});
assert.match(destinationRetry.resumeAt, /failed Data store module with the same dataset bundle/);
assert.match(destinationRetry.requiredProof, /each Data store commit/);
assert.match(destinationRetry.requiredProof, /module 13 with ted:<publicationNumber>/);
assert.match(destinationRetry.requiredProof, /module 14 with ted:run:<runId>:row:<bundleOrder>/);
for (const router of make.modules.filter((module) => module.module === 'Router')) {
  assert.doesNotMatch(JSON.stringify(router), /ted:(?:<|\{\{|publicationNumber|run:)/, `Router module ${router.order} must not assign a persistence key`);
}
assert.doesNotMatch(implementationText, /\| Router \| Assign `ted:/, 'Implementation guide must not claim a Router assigns a key');
assert.match(implementationText, /Module 13 alone uses `ted:<publicationNumber>`/);
assert.match(implementationText, /Module 14 alone uses `ted:run:<runId>:row:<bundleOrder>`/);
const publicationGate = make.publicationGate.join(' ');
assert.match(publicationGate, /module 13 writes only ted:<publicationNumber>/);
assert.match(publicationGate, /module 14 writes only ted:run:<runId>:row:<bundleOrder>/);
assert.match(publicationGate, /post-commit timeout independently at modules 13 and 14/);
assert.match(publicationGate, /maxNewPerRun is no greater than 999/i);
assert.match(publicationGate, /non-paginated retrieval limit of 1000/i);
assert.match(publicationGate, /HTTP polling/i);
assert.match(publicationGate, /run checkpoint/i);
assert.match(publicationGate, /desc=1&limit=1000&offset=0/i);
assert.match(publicationGate, /overflow-stop/i);
assert.equal(makeRunCheckpoint.idempotencyKey, 'ted:run:runId');
assert.match(makeRunCheckpoint.checkpointInvariant, /after all product row upserts/i);
assert.equal(makeRunCheckpoint.order, 21);
assert.match(make.nonTenderRoute, /persisted under deterministic/);
assert.doesNotMatch(JSON.stringify(makeDatasetRouter.routes), /title exists/i);

for (const relativePath of [
  'README.md',
  'workflow-contract.md',
  path.join('n8n', 'README.md'),
  path.join('make', 'implementation.md'),
  'VALIDATION.md',
]) {
  const content = await readFile(path.join(root, relativePath), 'utf8');
  assert.match(content, /maxNewPerRun\s*<=\s*999/i, `${relativePath}: must document the workflow cap`);
}
const n8nReadme = await readFile(path.join(root, 'n8n', 'README.md'), 'utf8');
assert.match(n8nReadme, /This revised file has \*\*not\*\* been imported exactly/i, 'TED n8n README must not claim exact-file import');
assert.match(n8nReadme, /external account gates/i, 'TED n8n README must retain exact-file import as an external gate');
assert.match(n8nReadme, /manual recovery.*original.*run ID/is, 'n8n README must document exhausted-retry recovery');
assert.match(n8nReadme, /does not provide automatic exactly-once delivery/i, 'n8n README must disclaim automatic exactly-once delivery');
const validationNotes = await readFile(path.join(root, 'VALIDATION.md'), 'utf8');
assert.match(validationNotes, /passed on 2026-07-21/i);
assert.match(validationNotes, /5 files, 45 tests passed/i);

const publicFiles = await filesUnder(root);
for (const file of publicFiles) {
  const content = await readFile(file, 'utf8');
  assert.doesNotMatch(content, /\bapify_api_[A-Za-z0-9_-]{12,}\b/, `${file}: likely token`);
}

console.log('PASS: 3 TED Task definitions and representative output fixture');
console.log('PASS: FAILED committed-row, replay, empty-dataset, missing-dataset, and title:null fixtures');
console.log('PASS: n8n and Make ingest every available terminal dataset before reporting failure');
console.log('PASS: Make modules 13 and 14 enforce disjoint TED routes, stable keys, overwrite, and retry coverage');
console.log('PASS: stable TED keys and null-title payload preservation');
