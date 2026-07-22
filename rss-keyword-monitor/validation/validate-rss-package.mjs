import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const taskDir = join(root, 'apify-tasks');
const taskFiles = (await readdir(taskDir)).filter((name) => name.endsWith('.json')).sort();
const allowedInputFields = new Set([
  'feeds', 'keywords', 'regexPatterns', 'excludeTerms', 'matchFields', 'onlyNew',
  'maxItemsPerRun', 'dedupWindow', 'includeContent', 'webhookUrl', 'resetState',
]);
const requiredOutputFields = [
  'feedUrl', 'feedTitle', 'feedType', 'itemKey', 'guid', 'title', 'link', 'author',
  'publishedAt', 'firstSeenAt', 'categories', 'description', 'content', 'matchedTerms', 'isNew',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function executeN8nCode(code, runNodeName, run, input = [], prepared = []) {
  const context = {
    $input: { all: () => input.map((json) => ({ json })) },
    $: (name) => {
      if (name === runNodeName) return { first: () => ({ json: run }) };
      if (name === 'Prepare dataset records') return { all: () => prepared };
      throw new Error(`Unexpected n8n node reference: ${name}`);
    },
  };
  return vm.runInNewContext(`(() => {${code}\n})()`, context);
}

const isValidDatasetRecord = (record) => typeof record?.feedUrl === 'string' && record.feedUrl.length > 0
  && typeof record?.itemKey === 'string' && record.itemKey.length > 0;
const deliveryKeyFor = (record, run, index) => isValidDatasetRecord(record)
  ? `rss:${encodeURIComponent(record.feedUrl)}:${encodeURIComponent(record.itemKey)}`
  : `rss:diagnostic:${encodeURIComponent(String(run.id ?? 'unknown-run'))}:row:${index}`;

for (const file of taskFiles) {
  const definition = JSON.parse(await readFile(join(taskDir, file), 'utf8'));
  const { input, publication } = definition;
  assert(typeof definition.taskName === 'string' && definition.taskName, `${file}: taskName missing`);
  assert(publication && typeof publication.slug === 'string', `${file}: publication metadata missing`);
  assert(publication.datasetView === 'overview', `${file}: dataset view must be overview`);
  assert(input && typeof input === 'object', `${file}: input missing`);
  assert(Array.isArray(input.feeds) && input.feeds.length >= 1 && input.feeds.length <= 10, `${file}: feeds must be bounded`);
  for (const feed of input.feeds) {
    const url = new URL(feed);
    assert(['http:', 'https:'].includes(url.protocol), `${file}: feed must be HTTP(S)`);
    assert(!url.username && !url.password, `${file}: feed URL contains credentials`);
  }
  for (const field of Object.keys(input)) assert(allowedInputFields.has(field), `${file}: unknown input field ${field}`);
  assert(input.onlyNew === false, `${file}: discovery Task must use onlyNew=false`);
  assert(input.resetState === false, `${file}: resetState must be false`);
  assert(input.webhookUrl === '', `${file}: webhookUrl must be blank`);
  assert(Number.isInteger(input.maxItemsPerRun) && input.maxItemsPerRun <= 10, `${file}: output must be capped at 10`);
}
assert(taskFiles.length === 3, `expected 3 public Task definitions, found ${taskFiles.length}`);

const fixture = JSON.parse(await readFile(join(root, 'fixtures', 'rss-items.json'), 'utf8'));
assert(Array.isArray(fixture) && fixture.length > 0, 'fixture must contain records');
for (const [index, item] of fixture.entries()) {
  for (const field of requiredOutputFields) assert(Object.hasOwn(item, field), `fixture[${index}] missing ${field}`);
  assert(item.isNew === true, `fixture[${index}] must represent a new item`);
  assert(Array.isArray(item.categories) && Array.isArray(item.matchedTerms), `fixture[${index}] arrays invalid`);
}

const workflowPath = join(root, 'workflows', 'n8n', 'rss-task-only-new.json');
const workflowText = await readFile(workflowPath, 'utf8');
const workflow = JSON.parse(workflowText);
const nodesByName = new Map(workflow.nodes.map((node) => [node.name, node]));
const apifyNode = nodesByName.get('Run persistent RSS monitoring Task');
const datasetNode = nodesByName.get('Fetch terminal run dataset');
const destinationNode = nodesByName.get('Upsert committed RSS items');
assert(apifyNode, 'n8n workflow must contain the Task run node');
assert(apifyNode.parameters.resource === 'Actor tasks', 'n8n workflow must use Actor tasks');
assert(apifyNode.parameters.operation === 'Run task', 'n8n workflow must retain terminal run metadata');
assert(apifyNode.parameters.waitForFinish === true, 'n8n workflow must wait for every terminal status');
assert(apifyNode.parameters.useCustomBody === false, 'n8n workflow must preserve saved Task input');
assert(!workflowText.includes('"credentials"'), 'n8n workflow must not export credentials');
assert(JSON.stringify(apifyNode.parameters.actorTaskId) === JSON.stringify({ __rl: true, value: 'PASTEYOURTASKID', mode: 'id' }), 'n8n Task resource locator is invalid');
assert(apifyNode.parameters.authentication === 'apifyApi', 'n8n default authentication must be API key');
for (const field of ['timeout', 'memory', 'build']) {
  assert(!Object.hasOwn(apifyNode.parameters, field), `n8n workflow overrides saved Task ${field}`);
}
assert(datasetNode?.parameters.resource === 'Datasets' && datasetNode?.parameters.operation === 'Get items', 'n8n must fetch by dataset ID separately');
assert(datasetNode.alwaysOutputData === true && datasetNode.parameters.datasetId.includes('defaultDatasetId'), 'n8n empty dataset path is not preserved');
assert(datasetNode.parameters.offset === 0, 'n8n dataset retrieval must start at offset 0');
assert(datasetNode.parameters.limit === 200, 'n8n dataset retrieval limit must remain 200');
assert(datasetNode.retryOnFail === true && datasetNode.maxTries === 3 && datasetNode.waitBetweenTries === 5000, 'n8n dataset retrieval must retry in place 3 times with a 5000 ms wait');
assert(/intentionally non-paginated/i.test(datasetNode.notes), 'n8n must document disabled pagination');
assert(/maxItemsPerRun must be no greater than 200/i.test(datasetNode.notes), 'n8n must document the saved Task cap');
assert(/account-gated validation/i.test(datasetNode.notes), 'n8n must document the cap account gate');
assert(destinationNode?.type === 'n8n-nodes-base.dataTable' && destinationNode.parameters.operation === 'upsert', 'n8n must use Data Table upsert');
assert(destinationNode.retryOnFail === true && destinationNode.maxTries === 3 && destinationNode.waitBetweenTries === 5000, 'n8n Data Table upsert must retry in place 3 times with a 5000 ms wait');
assert(destinationNode.parameters.filters.conditions[0].keyName === 'deliveryKey', 'n8n upsert must match deliveryKey');
const prepareCode = nodesByName.get('Prepare dataset records').parameters.jsCode;
assert(prepareCode.includes('encodeURIComponent(record.feedUrl)'), 'n8n RSS identity must include encoded feedUrl');
assert(prepareCode.includes('encodeURIComponent(record.itemKey)'), 'n8n RSS identity must include encoded itemKey');
assert(prepareCode.includes('rss:diagnostic:${encodeURIComponent(String(run.id'), 'n8n RSS diagnostics must use original run ID');
assert(prepareCode.includes('map((item, rowIndex)'), 'n8n RSS diagnostics must retain the original dataset index');
assert(prepareCode.includes('rowIdentity = `row:${rowIndex}`'), 'n8n RSS diagnostics must use deterministic row identity');
assert(prepareCode.includes('payloadJson: JSON.stringify(diagnostic)'), 'n8n RSS diagnostic payload must be sanitized');
assert(!/throw new Error/.test(prepareCode), 'Malformed rows must not abort valid-row ingestion');
const outcomeCode = nodesByName.get('Report terminal outcome after ingestion').parameters.jsCode;
assert(/committed dataset record\(s\) were idempotently persisted/.test(outcomeCode), 'n8n failure must be reported after persistence');
assert(/diagnosticRecordsPersisted/.test(outcomeCode), 'n8n outcome must report diagnostic persistence');
assert(!workflow.nodes.some((node) => node.parameters?.operation === 'Run task and get dataset'), 'success-gated combined operation is forbidden');
assert(apifyNode.retryOnFail !== true, 'The Task itself must never be retried');
assert(!Object.hasOwn(workflow.settings ?? {}, 'timezone'), 'generic n8n template must inherit the instance timezone');

const make = JSON.parse(await readFile(join(root, 'workflows', 'make', 'module-mapping.json'), 'utf8'));
const makeDataset = make.modules.find((module) => module.label === 'HTTP Get Dataset Items');
const makeListRuns = make.modules.find((module) => module.label === 'HTTP List Task Runs');
const makePrepare = make.modules.find((module) => module.label === 'Prepare Delivery Record');
const makeDelivery = make.modules.find((module) => module.label === 'Write Delivery Record');
const makeBarrier = make.modules.find((module) => module.label === 'Aggregate Completed Delivery Writes');
const makeDatasetOutcome = make.modules.find((module) => module.label === 'Dataset Run Outcome');
const makeDatasetCursor = make.modules.find((module) => module.label === 'Write Dataset Run Cursor');
const makeMissingDatasetCursor = make.modules.find((module) => module.label === 'Write Missing-Dataset Run Cursor');
assert(make.architecture === 'APIFY_SCHEDULE_TO_HTTP_POLLING_RECONCILER', 'Make must use the HTTP polling reconciler architecture');
assert(make.scenarioSettings.processInOrder === true, 'Make must avoid overlapping executions for run cursor safety');
assert(make.modules.every((module) => module.app !== 'Apify' && module.module !== 'Watch Task Runs' && module.module !== 'Get Dataset Items'), 'Make must not use the official Apify connector modules');
assert(make.modules.every((module) => module.module !== 'Search Records'), 'Make must not use Data store Search Records for cursor discovery');
assert(makeListRuns.configuration.method === 'GET', 'Make list-runs module must use HTTP GET');
assert(/\/actor-tasks\/\{\{TASK_ID\}\}\/runs\?desc=1&limit=1000&offset=0$/.test(makeListRuns.configuration.url), 'Make must list the max 1000-run page');
assert(makeListRuns.configuration.headers.find((header) => header.name === 'Authorization').value === 'Bearer <APIFY_TOKEN_PLACEHOLDER>', 'Make list-runs Authorization header must be scrubbed');
assert(makeListRuns.runWindow.limit === 1000, 'Make run poll limit must remain 1000');
assert(/reverse/i.test(makeListRuns.runWindow.sort), 'Make must reverse the fetched desc page before processing');
assert(/stored cursor run is not present/i.test(makeListRuns.runWindow.overflowGuard), 'Make must stop loudly on an overflowing page with a missing cursor boundary');
assert(make.taskLaunch.requirements.pollRunLimit === 1000, 'Make run poll limit must remain 1000');
assert(make.taskLaunch.requirements.overflowStopIfCursorMissingFromFetchedPage === true, 'Make must require a cursor-gap stop');
assert(make.taskLaunch.requirements.overflowStopBeforeProcessing === true, 'Make must stop before product processing on overflow');
assert(make.taskLaunch.requirements.preflightCursorRead === true, 'Make must read the exact cursor before processing');
assert(make.taskLaunch.requirements.cursorPrimingRequired === true, 'Make must require first-run cursor priming');
assert(make.taskLaunch.requirements.noDataStoreSearchForCursor === true, 'Make must forbid Search Records for cursor discovery');
assert(make.taskLaunch.requirements.maxRunsPerScenarioExecution === 1, 'Make must process at most one Task run per execution');
assert(make.taskLaunch.requirements.operationBudgetValidation === true, 'Make must require operation budget validation');
assert(make.taskLaunch.requirements.backlogDrainFormula === 'makePollsPerHour * maxRunsPerScenarioExecution > apifyRunsPerHour', 'Make must document backlog drain math');
assert(/module 12 Array Aggregator sourceModule=11/.test(make.taskLaunch.requirements.completionBarrier), 'Make must document the module 12 completion barrier');
assert(/completedDeliveryWrites equals attemptedDatasetRows/.test(make.taskLaunch.requirements.completionBarrier), 'Make must document the cursor count guard');
assert(/Rollback\/stop-on-error/.test(make.taskLaunch.requirements.deliveryFailureStrategy), 'Make module 11 failures must stop the scenario');
assert(make.taskLaunch.requirements.runOrdering === 'reverse-fetched-desc-page-after-cursor-filter', 'Make must define run ordering');
assert(JSON.stringify(make.taskLaunch.requirements.preflightModules) === JSON.stringify([2, 3, 4]), 'Make must define preflight modules 2-4');
assert(make.modules.find((module) => module.label === 'Read Last Processed Run Cursor').order === 2, 'Make must read the exact cursor in module 2');
assert(make.modules.find((module) => module.label === 'Preflight Cursor Guard').order === 3, 'Make must compute overflow in module 3');
assert(/must not reach module 5/.test(JSON.stringify(make.modules.find((module) => module.label === 'Cursor Guard Router'))), 'Make overflow route must stop before processing');
assert(make.modules.find((module) => module.label === 'Iterator - Dataset Items').order === 9, 'Make must split dataset items before aggregation');
assert(makePrepare.order === 10, 'Make must prepare delivery records in module 10');
assert(/rss:\{\{encodeURL\(module 9 feedUrl\)\}\}:\{\{encodeURL\(module 9 itemKey\)\}\}/.test(makePrepare.recordKey), 'Make RSS prepared key must include encoded feedUrl and itemKey');
assert(makeDelivery.order === 11, 'Make must write prepared delivery records in module 11');
assert(makeDelivery.configuration.key === '{{module 10 recordKey}}', 'Make RSS Data store sink must use prepared recordKey');
assert(makeDelivery.idempotencyKey === 'module 10 recordKey', 'Make RSS destination idempotency must use prepared recordKey');
assert(make.errorHandlers.destination.idempotencyKey === 'module 10 recordKey', 'Make RSS retry must preserve the prepared recordKey');
assert(makeBarrier.order === 12, 'Make barrier must be module 12');
assert(makeBarrier.configuration.sourceModule === 11, 'Make Array Aggregator must consume completed delivery writes');
assert(/Make-native completion barrier/.test(makeBarrier.barrierInvariant), 'Make barrier must document Make-native completion');
assert(/completedDeliveryWrites equals attemptedDatasetRows/.test(makeBarrier.barrierInvariant), 'Make barrier must document the count guard');
assert(make.taskLaunch.requirements.maxItemsPerRunAtMost === 200, 'Make saved Task cap must remain 200');
assert(make.taskLaunch.requirements.datasetRetrievalLimit === 200, 'Make retrieval contract must remain 200');
assert(make.taskLaunch.requirements.paginationEnabled === false, 'Make pagination must remain disabled');
assert(make.taskLaunch.requirements.makePollIntervalCoversRunWindow === true, 'Make poll interval must cover the run window');
assert(makeDataset.configuration.method === 'GET', 'Make dataset module must use HTTP GET');
assert(/\/datasets\/\{\{module 5 defaultDatasetId\}\}\/items\?format=json&clean=1&offset=0&limit=200$/.test(makeDataset.configuration.url), 'Make dataset module must fetch fixed non-paginated dataset items');
assert(makeDataset.configuration.headers.find((header) => header.name === 'Authorization').value === 'Bearer <APIFY_TOKEN_PLACEHOLDER>', 'Make dataset Authorization header must be scrubbed');
assert(makeDataset.configuration.limit === 200 && makeDataset.configuration.paginationEnabled === false, 'Make HTTP Get Dataset Items must use fixed non-paginated limit 200');
assert(makeDatasetOutcome.route === 'after module 12 completion barrier', 'Make RSS terminal report must follow the completion barrier');
assert(/delivery-write barrier/i.test(makeDatasetOutcome.purpose), 'Make RSS terminal report must prove the delivery-write barrier first');
assert(makeDatasetOutcome.outputs.cursorWriteAllowed === 'completedDeliveryWrites = attemptedDatasetRows AND module11IncompleteExecutions = 0', 'Make RSS outcome must guard cursor writes by completed/attempted counts');
assert(makeDatasetCursor.idempotencyKey === 'rss:cursor:taskId', 'Make dataset cursor must use Task cursor idempotency');
assert(/completedDeliveryWrites equals attemptedDatasetRows/i.test(makeDatasetCursor.checkpointInvariant), 'Make dataset cursor must be written after the count guard');
assert(/zero module 11 incomplete executions/i.test(makeDatasetCursor.checkpointInvariant), 'Make dataset cursor must reject incomplete module 11 bundles');
assert(makeDatasetCursor.order === 14, 'Make dataset cursor must be module 14');
assert(makeMissingDatasetCursor.idempotencyKey === 'rss:cursor:taskId', 'Make missing-dataset cursor must use Task cursor idempotency');
assert(makeMissingDatasetCursor.order === 16, 'Make missing-dataset cursor must be module 16');
assert(/maxItemsPerRun is no greater than 200/i.test(make.publicationGate.join(' ')), 'Make account gate must verify the saved Task cap');
assert(/HTTP polling/i.test(make.publicationGate.join(' ')), 'Make account gate must verify HTTP polling');
assert(/run-cursor/i.test(make.publicationGate.join(' ')), 'Make account gate must verify run cursoring');
assert(/desc=1&limit=1000&offset=0/i.test(make.publicationGate.join(' ')), 'Make account gate must verify the max poll page');
assert(/cursor-gap stop/i.test(make.publicationGate.join(' ')), 'Make account gate must verify cursor-gap stop behavior');
assert(/module 12 as the Array Aggregator completion barrier with sourceModule=11/i.test(make.publicationGate.join(' ')), 'Make account gate must verify the completion barrier');
assert(/Rollback\/stop-on-error rather than Retry\/Break/i.test(make.publicationGate.join(' ')), 'Make account gate must reject Retry/Break on module 11');
assert(make.errorHandlers.destination.handler === 'Rollback', 'Make module 11 must use Rollback');
assert(make.errorHandlers.destination.stopsScenario === true, 'Make module 11 Rollback must stop the scenario');
assert(/module 12\/module 14 do not run/.test(make.errorHandlers.destination.requiredProof), 'Make module 11 failure proof must verify no cursor path');

for (const relativePath of [
  'README.md',
  join('workflows', 'WORKFLOW-CONTRACT.md'),
  join('workflows', 'n8n', 'README.md'),
  join('workflows', 'make', 'IMPLEMENTATION.md'),
  join('validation', 'VALIDATION.md'),
]) {
  const content = await readFile(join(root, relativePath), 'utf8');
  assert(/maxItemsPerRun\s*<=\s*200/i.test(content), `${relativePath}: must document the workflow cap`);
}
const makeImplementation = await readFile(join(root, 'workflows', 'make', 'IMPLEMENTATION.md'), 'utf8');
assert(/module 11 writes every prepared RSS delivery record/i.test(makeImplementation), 'Make implementation must document module 11 as the RSS sink');
assert(/module 12 aggregates completed module 11 writes/i.test(makeImplementation), 'Make implementation must document the completion barrier');
assert(/Data-store error:.*Rollback.*module 11/is.test(makeImplementation), 'Make implementation stop-on-error docs must point at module 11');
assert(/completedDeliveryWrites equals attemptedDatasetRows/i.test(makeImplementation), 'Make implementation must document the cursor count guard');
assert(/Run-cursor error: retry module 14 or module 16/i.test(makeImplementation), 'Make implementation cursor retry docs must point at modules 14/16');
const rssN8nReadme = await readFile(join(root, 'workflows', 'n8n', 'README.md'), 'utf8');
assert(/account-gated validation/i.test(rssN8nReadme), 'n8n README must retain the saved-Task cap account gate');
assert(/manual recovery.*original.*run ID/is.test(rssN8nReadme), 'n8n README must document exhausted-retry recovery');
assert(/does not provide automatic exactly-once delivery/i.test(rssN8nReadme), 'n8n README must disclaim automatic exactly-once delivery');

const terminalScenarios = JSON.parse(await readFile(join(root, 'fixtures', 'terminal-run-scenarios.json'), 'utf8'));
assert(Array.isArray(terminalScenarios) && terminalScenarios.length === 6, 'expected six terminal-run scenarios');
const deliveryStore = new Map();
for (const scenario of terminalScenarios) {
  assert(scenario.run.status === 'FAILED', `${scenario.scenario}: status must be FAILED`);
  const hasDataset = typeof scenario.run.defaultDatasetId === 'string';
  assert(scenario.expected.datasetFetched === hasDataset, `${scenario.scenario}: dataset fetch expectation mismatch`);
  const records = scenario.dataset ?? [];
  assert(scenario.expected.recordsPersisted === records.length, `${scenario.scenario}: persistence count mismatch`);
  const keys = records.map((record, index) => deliveryKeyFor(record, scenario.run, index));
  assert(JSON.stringify(scenario.expected.deliveryKeys ?? []) === JSON.stringify(keys), `${scenario.scenario}: stable keys mismatch`);
  const validCount = records.filter(isValidDatasetRecord).length;
  const diagnosticCount = records.length - validCount;
  if (Object.hasOwn(scenario.expected, 'validRecordsPersisted')) {
    assert(scenario.expected.validRecordsPersisted === validCount, `${scenario.scenario}: valid-row count mismatch`);
    assert(scenario.expected.diagnosticRecordsPersisted === diagnosticCount, `${scenario.scenario}: diagnostic-row count mismatch`);
  }
  records.forEach((record, index) => deliveryStore.set(keys[index], record));
  assert(scenario.expected.terminalFailureReportedAfterIngestion === true, `${scenario.scenario}: failure must follow ingestion`);
  if (scenario.replayOf) assert(deliveryStore.size === scenario.expected.uniqueRecordsAfterReplay, 'replay created a duplicate row');
}
const mixed = terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_MIXED_VALID_AND_MALFORMED');
const mixedReplay = terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_MIXED_REPLAY_IDEMPOTENCY');
assert(mixed && mixedReplay, 'mixed valid/malformed run and replay fixtures are required');
assert(mixed.expected.malformedDiagnosticsDeterministic === true, 'mixed diagnostic must be deterministic');
assert(
  JSON.stringify(mixed.dataset.map((record, index) => deliveryKeyFor(record, mixed.run, index)))
    === JSON.stringify(mixedReplay.dataset.map((record, index) => deliveryKeyFor(record, mixedReplay.run, index))),
  'mixed replay must preserve valid and diagnostic keys',
);
assert(mixed.expected.deliveryKeys.some((key) => key.startsWith('rss:diagnostic:')), 'mixed fixture must persist a sanitized diagnostic');
assert(mixed.expected.terminalFailureReportedAfterIngestion === true, 'mixed terminal failure must follow ingestion');
const preparedMixed = executeN8nCode(prepareCode, 'Run persistent RSS monitoring Task', mixed.run, mixed.dataset);
assert(
  JSON.stringify(preparedMixed.map((item) => item.json.deliveryKey)) === JSON.stringify(mixed.expected.deliveryKeys),
  'executed preparation must preserve the valid row and deterministic diagnostic',
);
const diagnosticRecord = preparedMixed.find((item) => item.json.isDiagnostic === true)?.json;
assert(diagnosticRecord, 'executed mixed preparation must emit one diagnostic');
assert(
  JSON.stringify(Object.keys(JSON.parse(diagnosticRecord.payloadJson)).sort())
    === JSON.stringify(['code', 'datasetId', 'product', 'recordType', 'requiredFields', 'rowIndex', 'runId'].sort()),
  'diagnostic payload must contain only the sanitized envelope',
);
assert(!diagnosticRecord.payloadJson.includes(mixed.dataset[1].feedUrl), 'diagnostic payload leaked malformed feed URL');
assert(!diagnosticRecord.payloadJson.includes(mixed.dataset[1].title), 'diagnostic payload leaked malformed row title');
const replayPrepared = executeN8nCode(prepareCode, 'Run persistent RSS monitoring Task', mixedReplay.run, mixedReplay.dataset);
assert(
  JSON.stringify(replayPrepared.map((item) => item.json.deliveryKey))
    === JSON.stringify(preparedMixed.map((item) => item.json.deliveryKey)),
  'executed replay must emit the same valid and diagnostic keys',
);
const offsetPrepared = executeN8nCode(prepareCode, 'Run persistent RSS monitoring Task', mixed.run, [{}, ...mixed.dataset]);
assert(offsetPrepared[1].json.deliveryKey === 'rss:diagnostic:rssMixedRun001:row:2', 'diagnostic must retain the original dataset input index');
let terminalError = '';
try {
  executeN8nCode(outcomeCode, 'Run persistent RSS monitoring Task', mixed.run, [], preparedMixed);
} catch (error) {
  terminalError = String(error.message);
}
assert(/after 2 committed dataset record\(s\).*1 malformed-row diagnostic record\(s\)/.test(terminalError), 'failed terminal status must report post-ingestion valid/diagnostic counts');
const collisionScenario = terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_WITH_COMMITTED_ROWS');
assert(collisionScenario.dataset.length >= 2, 'RSS collision fixture must contain at least two records');
assert(new Set(collisionScenario.dataset.map((record) => record.itemKey)).size === 1, 'RSS collision fixture must reuse one itemKey');
assert(new Set(collisionScenario.dataset.map((record) => record.feedUrl)).size === collisionScenario.dataset.length, 'RSS collision fixture must use distinct feeds');
assert(new Set(collisionScenario.dataset.map((record, index) => deliveryKeyFor(record, collisionScenario.run, index))).size === collisionScenario.dataset.length, 'composite RSS identity must prevent cross-feed collisions');
assert(terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_EMPTY_DATASET').expected.safeEmptyResult === true, 'FAILED empty dataset is unsafe');
assert(terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_WITHOUT_DATASET_ID').dataset === null, 'missing dataset scenario must not fetch');

const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(root);

const forbiddenNames = ['bWFncGll', 'c2t5bGFyaw==', 'aGVyb24=', 'b3NwcmV5'].map((value) =>
  Buffer.from(value, 'base64').toString('utf8'),
);
const likelySecrets = [
  /apify_api_[A-Za-z0-9]{20,}/,
  /hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,}/,
  /https:\/\/hook\.(?:us1\.)?make\.com\/[A-Za-z0-9_-]{12,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
for (const path of files) {
  const content = await readFile(path, 'utf8');
  const lower = content.toLowerCase();
  for (const name of forbiddenNames) assert(!lower.includes(name), `${relative(root, path)} contains forbidden internal name`);
  for (const pattern of likelySecrets) assert(!pattern.test(content), `${relative(root, path)} contains likely secret`);
}

console.log(`PASS: ${taskFiles.length} Task definitions, ${fixture.length} output fixtures, terminal recovery fixtures, n8n ingest-first semantics, and public-asset scans`);
