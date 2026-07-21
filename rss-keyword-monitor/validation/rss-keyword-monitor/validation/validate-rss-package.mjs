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
const makeDataset = make.modules.find((module) => module.module === 'Get Dataset Items');
const makeDestination = make.modules.find((module) => module.app === 'Data store' && module.module === 'Add/Replace a Record');
assert(make.taskLaunch.requirements.maxItemsPerRunAtMost === 200, 'Make saved Task cap must remain 200');
assert(make.taskLaunch.requirements.datasetRetrievalLimit === 200, 'Make retrieval contract must remain 200');
assert(make.taskLaunch.requirements.paginationEnabled === false, 'Make pagination must remain disabled');
assert(makeDataset.configuration.limit === 200 && makeDataset.configuration.paginationEnabled === false, 'Make Get Dataset Items must use fixed non-paginated limit 200');
assert(makeDestination.configuration.key === 'rss:{{encodeURL(module 9 feedUrl)}}:{{encodeURL(module 9 itemKey)}}', 'Make RSS key must include encoded feedUrl and itemKey');
assert(makeDestination.idempotencyKey === 'rss:encodeURL(feedUrl):encodeURL(itemKey)', 'Make RSS idempotency contract must use both identity fields');
assert(make.errorHandlers.destination.idempotencyKey === makeDestination.idempotencyKey, 'Make RSS retry must preserve the composite key');
assert(/maxItemsPerRun is no greater than 200/i.test(make.publicationGate.join(' ')), 'Make account gate must verify the saved Task cap');

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
