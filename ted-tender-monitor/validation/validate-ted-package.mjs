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
const makePrepare = make.modules.find((module) => module.label === 'Prepare Delivery Record');
const makeDelivery = make.modules.find((module) => module.label === 'Write Delivery Record');
const makeBarrier = make.modules.find((module) => module.label === 'Aggregate Completed Delivery Writes');
const makeDatasetOutcome = make.modules.find((module) => module.label === 'Dataset Run Outcome');
const makeDatasetCursor = make.modules.find((module) => module.label === 'Write Dataset Run Cursor');
const makeMissingDatasetCursor = make.modules.find((module) => module.label === 'Write Missing-Dataset Run Cursor');
const makeModulesByOrder = new Map(make.modules.map((module) => [module.order, module]));
const makeDestinations = make.modules.filter((module) => module.app === 'Data store' && module.module === 'Add/Replace a Record');
const destinationFailure = make.errorHandlers.destination;
const implementationText = await readFile(path.join(root, 'make', 'implementation.md'), 'utf8');
assert.equal(make.architecture, 'APIFY_SCHEDULE_TO_HTTP_POLLING_RECONCILER');
assert.equal(make.scenarioSettings.processInOrder, true, 'Make must avoid overlapping executions for run cursor safety');
assert.equal(make.modules.some((module) => module.app === 'Apify' || module.module === 'Watch Task Runs' || module.module === 'Get Dataset Items'), false, 'Make must not use the official Apify connector modules');
assert.equal(make.modules.some((module) => module.module === 'Search Records'), false, 'Make must not use Data store Search Records for cursor discovery');
assert.equal(makeListRuns.configuration.method, 'GET');
assert.match(makeListRuns.configuration.url, /\/actor-tasks\/\{\{TASK_ID\}\}\/runs\?desc=1&limit=1000&offset=0&status=SUCCEEDED,FAILED,ABORTED,TIMED-OUT$/);
assert.equal(makeListRuns.configuration.headers.find((header) => header.name === 'Authorization').value, 'Bearer <APIFY_TOKEN_PLACEHOLDER>');
assert.equal(makeListRuns.configuration.status, 'SUCCEEDED,FAILED,ABORTED,TIMED-OUT');
assert.equal(makeListRuns.runWindow.limit, 1000);
assert.match(makeListRuns.runWindow.sort, /reverse/i);
assert.match(makeListRuns.runWindow.overflowGuard, /stored cursor run is not present/i);
assert.equal(make.taskLaunch.requirements.pollRunLimit, 1000);
assert.equal(make.taskLaunch.requirements.overflowStopIfCursorMissingFromFetchedPage, true);
assert.equal(make.taskLaunch.requirements.overflowStopBeforeProcessing, true);
assert.equal(make.taskLaunch.requirements.preflightCursorRead, true);
assert.equal(make.taskLaunch.requirements.cursorPrimingRequired, true);
assert.equal(make.taskLaunch.requirements.noDataStoreSearchForCursor, true);
assert.equal(make.taskLaunch.requirements.maxRunsPerScenarioExecution, 1);
assert.equal(make.taskLaunch.requirements.operationBudgetValidation, true);
assert.equal(make.taskLaunch.requirements.backlogDrainFormula, 'makePollsPerHour * maxRunsPerScenarioExecution > apifyRunsPerHour');
assert.match(make.taskLaunch.requirements.completionBarrier, /module 12 Array Aggregator sourceModule=9/);
assert.match(make.taskLaunch.requirements.completionBarrier, /completedDeliveryWrites equals attemptedDatasetRows/);
assert.match(make.taskLaunch.requirements.deliveryFailureStrategy, /Rollback\/stop-on-error/);
assert.equal(make.taskLaunch.requirements.runOrdering, 'reverse-fetched-desc-page-after-cursor-filter');
assert.deepEqual(make.taskLaunch.requirements.preflightModules, [2, 3, 4]);
assert.equal(make.modules.find((module) => module.label === 'Read Last Processed Run Cursor').order, 2);
assert.equal(make.modules.find((module) => module.label === 'Preflight Cursor Guard').order, 3);
assert.match(JSON.stringify(make.modules.find((module) => module.label === 'Cursor Guard Router')), /must not reach module 5/);
assert.equal(make.modules.find((module) => module.label === 'Iterator - Dataset Items').order, 9);
assert.equal(makeBarrier.configuration.sourceModule, 9);
assert.match(makeBarrier.barrierInvariant, /Make-native completion barrier/);
assert.match(makeBarrier.barrierInvariant, /completedDeliveryWrites equals attemptedDatasetRows/);
assert.match(makeDatasetRouter.routes.datasetAvailable, /defaultDatasetId exists/i);
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
assert.deepEqual(make.modules.map((module) => module.order), Array.from({ length: 16 }, (_, index) => index + 1), 'Make module orders must be unique and contiguous');
assert.equal(makeDestinations.length, 3, 'Make must define one delivery sink and two cursor writes');
assert.equal(makeDelivery.order, 11, 'Module 11 must be the single TED delivery sink');
assert.equal(makeDelivery.configuration.key, '{{module 10 recordKey}}');
assert.equal(makeDelivery.idempotencyKey, 'module 10 recordKey');
assert.match(makeDelivery.destinationKeyProof, /ted:<publicationNumber>.*ted:run:<runId>:row:<bundleOrder>/i);
assert.equal(makeDelivery.configuration.overwriteExistingRecord, true, 'Module 11 must enable overwrite');
assert.match(makePrepare.recordFields.payloadJson, /title:null remains null/i);
assert.match(makeDelivery.nativeIdempotency, /exactly one record/i);
assert.equal(makePrepare.order, 10);
assert.equal(makePrepare.validation, 'identifiedTender = recordType = tender AND publicationNumber exists');
assert.match(makePrepare.recordKey, /ted:\{\{module 9 publicationNumber\}\}/);
assert.match(makePrepare.recordKey, /ted:run:\{\{module 5 id\}\}:row:\{\{module 9 bundle order\}\}/);
assert.match(makePrepare.normalizedOutput.title, /string or null, preserved/);
assert.equal(makeDatasetOutcome.route, 'after module 12 completion barrier');
assert.match(makeDatasetOutcome.purpose, /delivery-write barrier/i);
assert.equal(makeDatasetOutcome.outputs.cursorWriteAllowed, 'completedDeliveryWrites = attemptedDatasetRows AND module11IncompleteExecutions = 0');
assert.match(make.terminalFailureRoute.datasetPath, /module 12 aggregates completed module 11 delivery writes/);
assert.match(make.terminalFailureRoute.emptyDataset, /module 12 emits an empty Array\[\]/);
assert.match(make.terminalFailureRoute.missingDataset, /module 15 records that no dataset request was attempted/);
assert.equal(destinationFailure.idempotencyKey, 'module 10 recordKey');
assert.equal(destinationFailure.handler, 'Rollback');
assert.equal(destinationFailure.stopsScenario, true);
assert.match(destinationFailure.resumeAt, /module 11/);
assert.match(destinationFailure.requiredProof, /module 11/);
assert.match(destinationFailure.requiredProof, /ted:<publicationNumber>/);
assert.match(destinationFailure.requiredProof, /ted:run:<runId>:row:<bundleOrder>/);
assert.match(destinationFailure.requiredProof, /module 12\/module 14 do not run/);
assert.match(destinationFailure.never, /Do not use Make Retry\/Break on module 11/);
for (const router of make.modules.filter((module) => module.module === 'Router')) {
  assert.doesNotMatch(JSON.stringify(router), /ted:(?:<|\{\{|publicationNumber|run:)/, `Router module ${router.order} must not assign a persistence key`);
}
assert.doesNotMatch(implementationText, /\| Router \| Assign `ted:/, 'Implementation guide must not claim a Router assigns a key');
assert.match(implementationText, /Module 10 assigns either `ted:<publicationNumber>` or `ted:run:<runId>:row:<bundleOrder>`/);
assert.match(implementationText, /Module 11 writes every prepared TED delivery record/);
assert.match(implementationText, /module 12 aggregates completed module 11 writes/i);
assert.match(implementationText, /Data-store error:.*Rollback.*module 11/is);
assert.match(implementationText, /completedDeliveryWrites equals attemptedDatasetRows/i);
const publicationGate = make.publicationGate.join(' ');
assert.match(publicationGate, /module 10 to prepare every dataset row/);
assert.match(publicationGate, /module 11 as the only delivery Data store sink/);
assert.match(publicationGate, /module 12 as the Array Aggregator completion barrier with sourceModule=9/);
assert.match(publicationGate, /Rollback\/stop-on-error rather than Retry\/Break/);
assert.match(publicationGate, /maxNewPerRun is no greater than 999/i);
assert.match(publicationGate, /non-paginated retrieval limit of 1000/i);
assert.match(publicationGate, /HTTP polling/i);
assert.match(publicationGate, /run-cursor/i);
assert.match(publicationGate, /desc=1&limit=1000&offset=0/i);
assert.match(publicationGate, /cursor-gap stop/i);
assert.equal(makeDatasetCursor.idempotencyKey, 'ted:cursor:taskId');
assert.match(makeDatasetCursor.checkpointInvariant, /completedDeliveryWrites equals attemptedDatasetRows/i);
assert.match(makeDatasetCursor.checkpointInvariant, /zero module 11 incomplete executions/i);
assert.equal(makeDatasetCursor.order, 14);
assert.equal(makeMissingDatasetCursor.idempotencyKey, 'ted:cursor:taskId');
assert.equal(makeMissingDatasetCursor.order, 16);
assert.match(make.nonTenderRoute, /deterministic run-row keys/);
assert.doesNotMatch(JSON.stringify(makePrepare), /title exists/i);

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
assert.match(validationNotes, /module 11 delivery sink/);
const workflowContract = await readFile(path.join(root, 'workflow-contract.md'), 'utf8');
assert.match(workflowContract, /Module 11 stops on the failed prepared delivery record/);
assert.match(workflowContract, /module 10 recordKey/);
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
console.log('PASS: Make module 11 enforces TED stable keys through module 10 recordKey, overwrite, and Rollback stop-on-error coverage');
console.log('PASS: stable TED keys and null-title payload preservation');
