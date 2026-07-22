import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const actorReadmeArg = process.argv.find((arg) => arg.startsWith('--actor-readme='));
const actorReadme = actorReadmeArg ? path.resolve(actorReadmeArg.slice('--actor-readme='.length)) : null;

async function filesUnder(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await filesUnder(fullPath)));
        if (entry.isFile()) files.push(fullPath);
    }
    return files;
}

function walk(value, visit, trail = '$') {
    visit(value, trail);
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${trail}[${index}]`));
    else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) walk(item, visit, `${trail}.${key}`);
    }
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

const publicFiles = await filesUnder(root);
const jsonFiles = publicFiles.filter((file) => file.endsWith('.json'));
const parsed = new Map();
for (const file of jsonFiles) parsed.set(file, JSON.parse(await readFile(file, 'utf8')));

const forbiddenNames = [
    ['MAG', 'PIE'].join(''),
    ['SKY', 'LARK'].join(''),
    ['HER', 'ON'].join(''),
    ['OS', 'PREY'].join(''),
];
const scanFiles = actorReadme ? [...publicFiles, actorReadme] : publicFiles;
for (const file of scanFiles) {
    const content = await readFile(file, 'utf8');
    for (const name of forbiddenNames) {
        assert(!content.toLowerCase().includes(name.toLowerCase()), `Forbidden public name in ${file}`);
    }
    assert(!/Bearer\s+[A-Za-z0-9_-]{12,}/i.test(content), `Likely bearer token in ${file}`);
    assert(!/hooks\.slack\.com\/services\//i.test(content), `Slack webhook URL in ${file}`);
    assert(!/(?:apify_api_token|apify_token|x-apify-token)\s*[=:]/i.test(content), `Likely Apify token in ${file}`);
}

const taskDir = path.join(root, 'apify-tasks');
const taskFiles = (await filesUnder(taskDir)).filter((file) => file.endsWith('.json'));
assert.equal(taskFiles.length, 3, 'Expected exactly three public Task definitions');

const allowedInputKeys = new Set([
    'keywords',
    'handles',
    'hashtags',
    'excludeTerms',
    'langs',
    'onlyNew',
    'maxPostsPerRun',
    'sort',
    'resetState',
]);
for (const file of taskFiles) {
    const task = parsed.get(file);
    assert.equal(task.definitionVersion, 1);
    assert.equal(task.actorId, 'uplifted_novice_vbl/bluesky-keyword-mention-alerts');
    assert(/^[a-z0-9-]+$/.test(task.taskName), `Invalid Task name in ${file}`);
    assert.equal(task.taskName, task.publication.slug, `Task name and slug differ in ${file}`);
    assert(task.publication.seoTitle.length <= 70, `SEO title is too long in ${file}`);
    assert(task.publication.seoDescription.length <= 160, `SEO description is too long in ${file}`);
    assert.equal(task.publication.datasetView, 'overview');
    assert.equal(task.input.onlyNew, false, `Discovery Task must be repeatable in ${file}`);
    assert.equal(task.input.resetState, false, `resetState must be false in ${file}`);
    assert.equal(task.input.sort, 'latest', `Sort must remain latest in ${file}`);
    assert(Number.isInteger(task.input.maxPostsPerRun));
    assert(task.input.maxPostsPerRun >= 1 && task.input.maxPostsPerRun <= 10, `Discovery cap exceeds 10 in ${file}`);
    assert(!Object.hasOwn(task.input, 'webhookUrl'), `Public Task contains webhookUrl in ${file}`);
    assert(Object.keys(task.input).every((key) => allowedInputKeys.has(key)), `Unknown Actor input key in ${file}`);
    const targetCount = task.input.keywords.length + task.input.handles.length + task.input.hashtags.length;
    assert(targetCount >= 1 && targetCount <= 20, `Invalid target count in ${file}`);
    assert.equal(task.discoveryValidation.timeoutSeconds, 300);
    assert.equal(task.discoveryValidation.expectedMinimumDatasetItems, 1);
    assert.equal(task.monitoringChange.onlyNew, true);
    assert.equal(task.monitoringChange.persistentTaskRequired, true);
}

const fixtureFile = path.join(root, 'fixtures', 'sample-posts.json');
const fixtures = parsed.get(fixtureFile);
assert(Array.isArray(fixtures) && fixtures.length > 0, 'Fixture must contain records');
const requiredOutputFields = [
    'uri', 'cid', 'url', 'author', 'text', 'createdAt', 'indexedAt', 'langs',
    'likeCount', 'repostCount', 'replyCount', 'quoteCount', 'matchedTerms', 'source', 'isNew',
];
const allowedSources = new Set(['keyword', 'handle', 'hashtag', 'mention']);
for (const item of fixtures) {
    assert.deepEqual(Object.keys(item).sort(), [...requiredOutputFields].sort(), 'Fixture fields differ from dataset schema');
    assert.equal(typeof item.author.did, 'string');
    assert.equal(typeof item.author.handle, 'string');
    assert(allowedSources.has(item.source));
    assert.equal(item.isNew, true);
}

const isValidDatasetRecord = (record) => typeof record?.uri === 'string' && record.uri.length > 0
    && typeof record?.url === 'string' && record.url.length > 0;
const deliveryKeyFor = (record, run, index) => isValidDatasetRecord(record)
    ? `bluesky:${record.uri}`
    : `bluesky:diagnostic:${encodeURIComponent(String(run.id ?? 'unknown-run'))}:row:${index}`;

const workflowFile = path.join(root, 'workflows', 'n8n', 'bluesky-alerts-task-to-json.json');
const workflow = parsed.get(workflowFile);
const nodesByName = new Map(workflow.nodes.map((node) => [node.name, node]));
for (const name of [
    'Run persistent Bluesky monitoring Task',
    'Fetch terminal run dataset',
    'Prepare dataset records',
    'Upsert committed posts',
    'Report terminal outcome after ingestion',
    'Report terminal run without dataset',
]) assert(nodesByName.has(name), `Missing n8n node: ${name}`);

const runNode = nodesByName.get('Run persistent Bluesky monitoring Task');
assert.equal(runNode.type, '@apify/n8n-nodes-apify.apify');
assert.equal(runNode.parameters.resource, 'Actor tasks');
assert.equal(runNode.parameters.operation, 'Run task');
assert.equal(runNode.parameters.waitForFinish, true, 'n8n must retain every terminal run status');
assert.equal(runNode.parameters.useCustomBody, false, 'n8n workflow must preserve saved Task input');
assert.deepEqual(runNode.parameters.actorTaskId, { __rl: true, value: 'PASTEYOURTASKID', mode: 'id' });
assert.equal(runNode.parameters.authentication, 'apifyApi');
for (const field of ['timeout', 'memory', 'build']) {
    assert(!Object.hasOwn(runNode.parameters, field), `n8n workflow overrides saved Task ${field}`);
}
const datasetNode = nodesByName.get('Fetch terminal run dataset');
assert.equal(datasetNode.parameters.resource, 'Datasets');
assert.equal(datasetNode.parameters.operation, 'Get items');
assert.match(datasetNode.parameters.datasetId, /defaultDatasetId/);
assert.equal(datasetNode.alwaysOutputData, true, 'Empty failed datasets must reach terminal reporting');
assert.equal(datasetNode.parameters.offset, 0, 'n8n dataset retrieval must start at offset 0');
assert.equal(datasetNode.parameters.limit, 100, 'n8n dataset retrieval limit must remain 100');
assert.equal(datasetNode.retryOnFail, true);
assert.equal(datasetNode.maxTries, 3);
assert.equal(datasetNode.waitBetweenTries, 5000);
assert.match(datasetNode.notes, /intentionally non-paginated/i);
assert.match(datasetNode.notes, /maxPostsPerRun must be no greater than 100/i);
assert.match(datasetNode.notes, /account-gated validation/i);
const destinationNode = nodesByName.get('Upsert committed posts');
assert.equal(destinationNode.type, 'n8n-nodes-base.dataTable');
assert.equal(destinationNode.parameters.operation, 'upsert');
assert.equal(destinationNode.retryOnFail, true);
assert.equal(destinationNode.maxTries, 3);
assert.equal(destinationNode.waitBetweenTries, 5000);
assert.equal(destinationNode.parameters.filters.conditions[0].keyName, 'deliveryKey');
assert.match(destinationNode.parameters.columns.value.deliveryKey, /deliveryKey/);
const prepareCode = nodesByName.get('Prepare dataset records').parameters.jsCode;
assert.match(prepareCode, /bluesky:\$\{post\.uri\}/);
assert.match(prepareCode, /bluesky:diagnostic:\$\{encodeURIComponent\(String\(run\.id/);
assert.match(prepareCode, /map\(\(item, rowIndex\)/, 'Diagnostic identity must retain the original dataset index');
assert.match(prepareCode, /rowIdentity = `row:\$\{rowIndex\}`/);
assert.match(prepareCode, /payloadJson: JSON\.stringify\(diagnostic\)/);
assert.doesNotMatch(prepareCode, /throw new Error/, 'Malformed rows must not abort valid-row ingestion');
const outcomeCode = nodesByName.get('Report terminal outcome after ingestion').parameters.jsCode;
assert.match(outcomeCode, /after \$\{recordsPersisted\} committed dataset record/);
assert.match(outcomeCode, /diagnosticRecordsPersisted/);
assert.match(nodesByName.get('Report terminal run without dataset').parameters.jsCode, /no dataset request was attempted/i);
assert.equal(workflow.nodes.some((node) => node.parameters?.operation === 'Run task and get dataset'), false);
assert.notEqual(runNode.retryOnFail, true, 'The Task itself must never be retried');
assert.deepEqual(workflow.pinData, {}, 'Published workflow must not contain pinned data');
walk(workflow, (_value, trail) => assert(!/(^|\.)credentials(\.|$)/i.test(trail), `Credential object found at ${trail}`));

const makeFile = path.join(root, 'workflows', 'make', 'module-spec.json');
const make = parsed.get(makeFile);
const makeDataset = make.modules.find((module) => module.label === 'HTTP Get Dataset Items');
const makeListRuns = make.modules.find((module) => module.label === 'HTTP List Task Runs');
const makeRunCheckpoint = make.modules.find((module) => module.label === 'Write Run Checkpoint');
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
assert.equal(make.modules.find((module) => module.label === 'Overflow Guard Router').order, 4);
assert.match(JSON.stringify(make.modules.find((module) => module.label === 'Overflow Guard Router')), /must not reach module 5/);
assert.equal(make.taskLaunch.requirements.maxPostsPerRunAtMost, 100);
assert.equal(make.taskLaunch.requirements.datasetRetrievalLimit, 100);
assert.equal(make.taskLaunch.requirements.paginationEnabled, false);
assert.equal(make.taskLaunch.requirements.makePollIntervalCoversRunWindow, true);
assert.equal(makeDataset.configuration.method, 'GET');
assert.match(makeDataset.configuration.url, /\/datasets\/\{\{module 5 defaultDatasetId\}\}\/items\?format=json&clean=1&offset=0&limit=100$/);
assert.equal(makeDataset.configuration.headers.find((header) => header.name === 'Authorization').value, 'Bearer <APIFY_TOKEN_PLACEHOLDER>');
assert.equal(makeDataset.configuration.limit, 100);
assert.equal(makeDataset.configuration.paginationEnabled, false);
assert.match(makeDataset.capInvariant, /intentionally non-paginated/i);
assert.equal(makeRunCheckpoint.idempotencyKey, 'bluesky:run:runId');
assert.match(makeRunCheckpoint.checkpointInvariant, /after all product row upserts/i);
assert.equal(makeRunCheckpoint.order, 18);
assert.match(make.publicationGate.join(' '), /maxPostsPerRun is no greater than 100/i);
assert.match(make.publicationGate.join(' '), /non-paginated retrieval limit of 100/i);
assert.match(make.publicationGate.join(' '), /HTTP polling/i);
assert.match(make.publicationGate.join(' '), /run checkpoint/i);
assert.match(make.publicationGate.join(' '), /desc=1&limit=1000&offset=0/i);
assert.match(make.publicationGate.join(' '), /overflow-stop/i);

for (const relativePath of [
    'README.md',
    path.join('workflows', 'WORKFLOW-CONTRACT.md'),
    path.join('workflows', 'n8n', 'README.md'),
    path.join('workflows', 'make', 'README.md'),
    path.join('validation', 'PRODUCT-VALIDATION.md'),
]) {
    const content = await readFile(path.join(root, relativePath), 'utf8');
    assert.match(content, /maxPostsPerRun\s*<=\s*100/i, `${relativePath}: must document the workflow cap`);
}
const blueskyN8nReadme = await readFile(path.join(root, 'workflows', 'n8n', 'README.md'), 'utf8');
assert.match(blueskyN8nReadme, /account-gated/i, 'n8n README must retain the saved-Task cap account gate');
assert.match(blueskyN8nReadme, /manual recovery.*original.*run ID/is, 'n8n README must document exhausted-retry recovery');
assert.match(blueskyN8nReadme, /does not provide automatic exactly-once delivery/i, 'n8n README must disclaim automatic exactly-once delivery');

const terminalFixtureFile = path.join(root, 'fixtures', 'terminal-run-scenarios.json');
const terminalScenarios = parsed.get(terminalFixtureFile);
assert(Array.isArray(terminalScenarios) && terminalScenarios.length === 6, 'Expected six terminal-run scenarios');
const deliveryStore = new Map();
for (const scenario of terminalScenarios) {
    assert.equal(scenario.run.status, 'FAILED');
    const hasDataset = typeof scenario.run.defaultDatasetId === 'string';
    assert.equal(scenario.expected.datasetFetched, hasDataset, `${scenario.scenario}: dataset fetch expectation mismatch`);
    const records = scenario.dataset ?? [];
    assert.equal(scenario.expected.recordsPersisted, records.length, `${scenario.scenario}: persistence count mismatch`);
    const keys = records.map((record, index) => deliveryKeyFor(record, scenario.run, index));
    assert.deepEqual(scenario.expected.deliveryKeys ?? [], keys, `${scenario.scenario}: stable keys mismatch`);
    const validCount = records.filter(isValidDatasetRecord).length;
    const diagnosticCount = records.length - validCount;
    if (Object.hasOwn(scenario.expected, 'validRecordsPersisted')) {
        assert.equal(scenario.expected.validRecordsPersisted, validCount, `${scenario.scenario}: valid-row count mismatch`);
        assert.equal(scenario.expected.diagnosticRecordsPersisted, diagnosticCount, `${scenario.scenario}: diagnostic-row count mismatch`);
    }
    records.forEach((record, index) => deliveryStore.set(keys[index], record));
    assert.equal(scenario.expected.terminalFailureReportedAfterIngestion, true);
    if (scenario.replayOf) assert.equal(deliveryStore.size, scenario.expected.uniqueRecordsAfterReplay, 'Replay created a duplicate row');
}
const mixed = terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_MIXED_VALID_AND_MALFORMED');
const mixedReplay = terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_MIXED_REPLAY_IDEMPOTENCY');
assert(mixed && mixedReplay, 'Mixed valid/malformed run and replay fixtures are required');
assert.equal(mixed.expected.malformedDiagnosticsDeterministic, true);
assert.deepEqual(
    mixed.dataset.map((record, index) => deliveryKeyFor(record, mixed.run, index)),
    mixedReplay.dataset.map((record, index) => deliveryKeyFor(record, mixedReplay.run, index)),
    'Mixed replay must preserve valid and diagnostic keys',
);
assert(mixed.expected.deliveryKeys.some((key) => key.startsWith('bluesky:diagnostic:')), 'Mixed fixture must persist a sanitized diagnostic');
assert.equal(mixed.expected.terminalFailureReportedAfterIngestion, true);
const preparedMixed = executeN8nCode(
    prepareCode,
    'Run persistent Bluesky monitoring Task',
    mixed.run,
    mixed.dataset,
);
assert.deepEqual(
    preparedMixed.map((item) => item.json.deliveryKey),
    mixed.expected.deliveryKeys,
    'Executed preparation must preserve the valid row and deterministic diagnostic',
);
const diagnosticRecord = preparedMixed.find((item) => item.json.isDiagnostic === true)?.json;
assert(diagnosticRecord, 'Executed mixed preparation must emit one diagnostic');
assert.deepEqual(
    Object.keys(JSON.parse(diagnosticRecord.payloadJson)).sort(),
    ['code', 'datasetId', 'product', 'recordType', 'requiredFields', 'rowIndex', 'runId'].sort(),
    'Diagnostic payload must contain only the sanitized envelope',
);
assert(!diagnosticRecord.payloadJson.includes(mixed.dataset[1].url), 'Diagnostic payload leaked malformed source URL');
assert(!diagnosticRecord.payloadJson.includes(mixed.dataset[1].text), 'Diagnostic payload leaked malformed row text');
const replayPrepared = executeN8nCode(prepareCode, 'Run persistent Bluesky monitoring Task', mixedReplay.run, mixedReplay.dataset);
assert.deepEqual(
    replayPrepared.map((item) => item.json.deliveryKey),
    preparedMixed.map((item) => item.json.deliveryKey),
    'Executed replay must emit the same valid and diagnostic keys',
);
const offsetPrepared = executeN8nCode(prepareCode, 'Run persistent Bluesky monitoring Task', mixed.run, [{}, ...mixed.dataset]);
assert.equal(offsetPrepared[1].json.deliveryKey, 'bluesky:diagnostic:blueskyMixedRun001:row:2', 'Diagnostic must retain the original dataset input index');
assert.throws(
    () => executeN8nCode(outcomeCode, 'Run persistent Bluesky monitoring Task', mixed.run, [], preparedMixed),
    /after 2 committed dataset record\(s\).*1 malformed-row diagnostic record\(s\)/,
    'Failed terminal status must be reported with post-ingestion valid/diagnostic counts',
);
assert.equal(terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_EMPTY_DATASET').expected.safeEmptyResult, true);
assert.equal(terminalScenarios.find((scenario) => scenario.scenario === 'FAILED_WITHOUT_DATASET_ID').dataset, null);

console.log(`PASS: ${jsonFiles.length} JSON files parsed`);
console.log('PASS: 3 Task definitions match bounded discovery and persistent monitoring rules');
console.log(`PASS: ${fixtures.length} fixture records match the documented dataset shape`);
console.log('PASS: n8n retains terminal status, ingests datasets, upserts stable keys, then reports failure');
console.log('PASS: FAILED committed-row, mixed-row survival, deterministic diagnostic replay, empty-dataset, and missing-dataset fixtures');
console.log(`PASS: ${scanFiles.length} public-surface files passed internal-name and credential scans`);
