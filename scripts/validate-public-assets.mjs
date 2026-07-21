import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const requiredDirectories = [
    'bluesky-keyword-mention-alerts',
    'rss-keyword-monitor',
    'ted-tender-monitor',
];

const bannedNames = [
    ['internal suite name', new RegExp(`\\b${['MAG', 'PIE'].join('')}\\b`, 'i')],
    ['internal Bluesky codename', new RegExp(`\\b${['SKY', 'LARK'].join('')}\\b`, 'i')],
    ['internal RSS codename', new RegExp(`\\b${['HE', 'RON'].join('')}\\b`, 'i')],
    ['internal TED codename', new RegExp(`\\b${['OS', 'PREY'].join('')}\\b`, 'i')],
];

const secretPatterns = [
    ['Apify API token', /\bapify_api_[A-Za-z0-9_-]{12,}\b/],
    ['GitHub token', /\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{20,}\b/],
    ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['Slack webhook', /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/i],
    ['Discord webhook', /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9._-]+/i],
    ['embedded bearer token', /["']Authorization["']\s*:\s*["']Bearer\s+[A-Za-z0-9._-]{12,}/i],
];

const forbiddenParts = new Set(['.git', '.env', 'node_modules', 'storage', 'private']);
const errors = [];
const jsonFiles = [];
const pngFiles = [];
const discoveredFiles = [];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const relativePath = path.relative(root, fullPath);
        const parts = relativePath.split(path.sep);

        if (parts.some((part) => forbiddenParts.has(part) || part.startsWith('.env.'))) {
            errors.push(`${relativePath}: forbidden path component`);
            continue;
        }

        if (entry.isDirectory()) {
            await walk(fullPath);
            continue;
        }

        if (!entry.isFile()) continue;
        discoveredFiles.push(relativePath.split(path.sep).join('/'));
        const fileStat = await stat(fullPath);
        if (fileStat.size > 1_000_000) {
            errors.push(`${relativePath}: file exceeds the 1 MB public-asset limit`);
            continue;
        }

        if (path.extname(entry.name).toLowerCase() === '.png') {
            const content = await readFile(fullPath);
            const isPng = pngSignature.every((byte, index) => content[index] === byte);
            if (!isPng) errors.push(`${relativePath}: invalid PNG signature`);
            pngFiles.push(relativePath);
            continue;
        }

        const content = await readFile(fullPath, 'utf8');
        for (const [label, pattern] of [...bannedNames, ...secretPatterns]) {
            if (pattern.test(content)) errors.push(`${relativePath}: contains ${label}`);
        }

        if (entry.name.endsWith('.json')) {
            try {
                jsonFiles.push({ relativePath, value: JSON.parse(content) });
            } catch (error) {
                errors.push(`${relativePath}: invalid JSON (${error.message})`);
            }
        }
    }
}

for (const directory of requiredDirectories) {
    try {
        const info = await stat(path.join(root, directory));
        if (!info.isDirectory()) errors.push(`${directory}: required product path is not a directory`);
    } catch {
        errors.push(`${directory}: required product directory is missing`);
    }
}

await walk(root);

const manifestPath = path.join(root, 'public-files.json');
let manifest = [];
try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!Array.isArray(manifest) || manifest.some((entry) => typeof entry !== 'string')) {
        errors.push('public-files.json: manifest must be an array of relative file paths');
        manifest = [];
    }
} catch (error) {
    errors.push(`public-files.json: cannot read allowlist (${error.message})`);
}

const manifestSet = new Set(manifest);
if (manifestSet.size !== manifest.length) errors.push('public-files.json: duplicate entries are not allowed');
for (const relativePath of manifest) {
    const normalized = path.posix.normalize(relativePath);
    if (
        normalized !== relativePath
        || normalized === '.'
        || normalized.startsWith('../')
        || path.posix.isAbsolute(normalized)
        || normalized.includes('\\')
    ) {
        errors.push(`public-files.json: unsafe path ${relativePath}`);
    }
}
for (const relativePath of discoveredFiles) {
    if (!manifestSet.has(relativePath)) errors.push(`${relativePath}: file is not in public-files.json`);
}
for (const relativePath of manifest) {
    if (!discoveredFiles.includes(relativePath)) errors.push(`${relativePath}: allowlisted file is missing`);
}

const rootReadme = await readFile(path.join(root, 'README.md'), 'utf8');
const securityPolicy = await readFile(path.join(root, 'SECURITY.md'), 'utf8');
const accountGates = await readFile(path.join(root, 'docs', 'account-gates.md'), 'utf8');
const platformChecklist = await readFile(path.join(root, 'docs', 'platform-submission-checklist.md'), 'utf8');
const blueskyReadme = await readFile(path.join(root, 'bluesky-keyword-mention-alerts', 'README.md'), 'utf8');
const rssReadme = await readFile(path.join(root, 'rss-keyword-monitor', 'README.md'), 'utf8');
const tedReadme = await readFile(path.join(root, 'ted-tender-monitor', 'README.md'), 'utf8');
const scheduleDocs = await Promise.all([
    ['Bluesky workflow contract', path.join(root, 'bluesky-keyword-mention-alerts', 'workflows', 'WORKFLOW-CONTRACT.md')],
    ['Bluesky n8n README', path.join(root, 'bluesky-keyword-mention-alerts', 'workflows', 'n8n', 'README.md')],
    ['Bluesky Make README', path.join(root, 'bluesky-keyword-mention-alerts', 'workflows', 'make', 'README.md')],
    ['RSS workflow contract', path.join(root, 'rss-keyword-monitor', 'workflows', 'WORKFLOW-CONTRACT.md')],
    ['RSS n8n README', path.join(root, 'rss-keyword-monitor', 'workflows', 'n8n', 'README.md')],
    ['RSS Make implementation', path.join(root, 'rss-keyword-monitor', 'workflows', 'make', 'IMPLEMENTATION.md')],
    ['TED workflow contract', path.join(root, 'ted-tender-monitor', 'workflow-contract.md')],
    ['TED n8n README', path.join(root, 'ted-tender-monitor', 'n8n', 'README.md')],
    ['TED Make implementation', path.join(root, 'ted-tender-monitor', 'make', 'implementation.md')],
].map(async ([label, file]) => [label, await readFile(file, 'utf8')]));
if (/Make blueprints are marked as drafts/i.test(rootReadme) || !/Make construction specifications, not blueprints/i.test(rootReadme)) {
    errors.push('README.md: Make assets must be described as specifications until a real blueprint exists');
}
if (!/Enable private vulnerability reporting/i.test(accountGates) || !/security-advisory notifications/i.test(accountGates)) {
    errors.push('docs/account-gates.md: GitHub publication gate must verify private vulnerability reporting and notifications');
}
if (!/publication is blocked until that private channel/i.test(securityPolicy)) {
    errors.push('SECURITY.md: reporting instructions must remain gated on a verified private channel');
}
if (!/onlyNew: false[^\n]*every delivered post is charged/i.test(blueskyReadme)) {
    errors.push('Bluesky README: discovery-mode per-record billing must be explicit');
}
if (!/onlyNew: false[^\n]*every delivered matching item is charged/i.test(rssReadme)) {
    errors.push('RSS README: discovery-mode per-record billing must be explicit');
}
if (!/discovery run still records each delivered item/i.test(rssReadme)) {
    errors.push('RSS README: discovery-mode seen-set update must be explicit');
}
for (const [label, content] of scheduleDocs) {
    if (!/interval[^\n]*strictly longer than[^\n]*(?:Task's|Task) (?:configured )?hard timeout/i.test(content)) {
        errors.push(`${label}: schedule interval must be explicitly longer than the saved Task hard timeout`);
    }
}

const documentedCapContracts = [
    { label: 'Bluesky', field: 'maxPostsPerRun', cap: 100, limit: 100, readme: blueskyReadme },
    { label: 'RSS', field: 'maxItemsPerRun', cap: 200, limit: 200, readme: rssReadme },
    { label: 'TED', field: 'maxNewPerRun', cap: 999, limit: 1000, readme: tedReadme },
];
for (const contract of documentedCapContracts) {
    const capPattern = new RegExp(`${contract.field}\\s*<=\\s*${contract.cap}`, 'i');
    for (const [document, content] of [
        [`${contract.label} README`, contract.readme],
        ['root README', rootReadme],
        ['account gates', accountGates],
        ['platform checklist', platformChecklist],
    ]) {
        if (!capPattern.test(content)) errors.push(`${document}: must document ${contract.field} <= ${contract.cap}`);
    }
}
if (!/TED[\s\S]*999[\s\S]*(?:one|1)[^\n]*summary[\s\S]*1000/i.test(rootReadme)) {
    errors.push('README.md: TED cap table must reserve one summary row within retrieval limit 1000');
}
if (!/current revised files have not all been imported exactly/i.test(accountGates)) {
    errors.push('docs/account-gates.md: current n8n exact-file imports must remain external account gates');
}

const taskFiles = jsonFiles.filter(({ relativePath }) => relativePath.includes(`${path.sep}apify-tasks${path.sep}`));
for (const directory of requiredDirectories) {
    const count = taskFiles.filter(({ relativePath }) => relativePath.startsWith(`${directory}${path.sep}`)).length;
    if (count < 3) errors.push(`${directory}: expected at least three JSON Task definitions, found ${count}`);
}

for (const { relativePath, value } of taskFiles) {
    if (typeof value.actorId !== 'string' || value.actorId.length === 0) {
        errors.push(`${relativePath}: actorId is required`);
    }
    const seoTitle = value.publication?.seoTitle;
    const seoDescription = value.publication?.seoDescription;
    if (typeof seoTitle !== 'string' || seoTitle.length === 0 || seoTitle.length > 70) {
        errors.push(`${relativePath}: seoTitle must contain 1-70 characters`);
    }
    if (typeof seoDescription !== 'string' || seoDescription.length === 0 || seoDescription.length > 160) {
        errors.push(`${relativePath}: seoDescription must contain 1-160 characters`);
    }
    const input = value.input ?? value;
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        errors.push(`${relativePath}: Task input must be a JSON object`);
        continue;
    }
    for (const field of ['webhookUrl', 'webhookSecret']) {
        if (field in input && input[field] !== '') {
            errors.push(`${relativePath}: ${field} must be omitted or empty in public Task input`);
        }
    }
    if (input.resetState === true) errors.push(`${relativePath}: resetState must not be enabled in a public Task`);
}

const tedSamplePath = path.join('ted-tender-monitor', 'fixtures', 'sample-output.json');
const tedSample = jsonFiles.find(({ relativePath }) => relativePath === tedSamplePath);
if (!Array.isArray(tedSample?.value)) {
    errors.push(`${tedSamplePath}: sample output must be a JSON array`);
} else {
    const summaries = tedSample.value.filter((record) => record?.recordType === 'summary');
    if (summaries.length !== 1) {
        errors.push(`${tedSamplePath}: expected exactly one summary record`);
    } else {
        const summary = summaries[0];
        const chargeCountFields = [
            'newTenderChargesAttempted',
            'changedTenderChargesAttempted',
            'newTenderChargesActual',
            'changedTenderChargesActual',
        ];
        for (const field of chargeCountFields) {
            if (!Number.isInteger(summary[field]) || summary[field] < 0) {
                errors.push(`${tedSamplePath}: summary.${field} must be a non-negative integer`);
            }
        }
        const chargeStatuses = new Set(['not-applicable', 'pending', 'complete', 'partial', 'failed']);
        if (typeof summary.chargeStatus !== 'string' || !chargeStatuses.has(summary.chargeStatus)) {
            errors.push(`${tedSamplePath}: summary.chargeStatus must be a supported runtime status`);
        }
        if (summary.mode !== 'sample') errors.push(`${tedSamplePath}: representative output must use sample mode`);
        for (const field of chargeCountFields) {
            if (summary[field] !== 0) errors.push(`${tedSamplePath}: sample summary.${field} must be zero`);
        }
        if (summary.chargeStatus !== 'not-applicable') {
            errors.push(`${tedSamplePath}: sample summary.chargeStatus must be not-applicable`);
        }
    }
}

const rssDeliveryKey = (record) => `rss:${encodeURIComponent(record.feedUrl)}:${encodeURIComponent(record.itemKey)}`;
const diagnosticDeliveryKey = (prefix, run, index) => `${prefix}diagnostic:${encodeURIComponent(String(run.id ?? 'unknown-run'))}:row:${index}`;

const terminalFixtureConfigs = [
    {
        directory: 'bluesky-keyword-mention-alerts',
        keyFor: (record, run, index) => typeof record?.uri === 'string' && record.uri.length > 0
            && typeof record?.url === 'string' && record.url.length > 0
            ? `bluesky:${record.uri}`
            : diagnosticDeliveryKey('bluesky:', run, index),
        isDiagnostic: (record) => !(typeof record?.uri === 'string' && record.uri.length > 0
            && typeof record?.url === 'string' && record.url.length > 0),
        requiredPrefix: 'bluesky:',
        requiresMixedFixture: true,
    },
    {
        directory: 'rss-keyword-monitor',
        keyFor: (record, run, index) => typeof record?.feedUrl === 'string' && record.feedUrl.length > 0
            && typeof record?.itemKey === 'string' && record.itemKey.length > 0
            ? rssDeliveryKey(record)
            : diagnosticDeliveryKey('rss:', run, index),
        isDiagnostic: (record) => !(typeof record?.feedUrl === 'string' && record.feedUrl.length > 0
            && typeof record?.itemKey === 'string' && record.itemKey.length > 0),
        requiredPrefix: 'rss:',
        requiresMixedFixture: true,
    },
    {
        directory: 'ted-tender-monitor',
        keyFor: (record, run, index) => record.recordType === 'tender' && record.publicationNumber
            ? `ted:${record.publicationNumber}`
            : `ted:run:${run.id}:row:${index}`,
        requiredPrefix: 'ted:',
    },
];

for (const config of terminalFixtureConfigs) {
    const relativePath = path.join(config.directory, 'fixtures', 'terminal-run-scenarios.json');
    const fixture = jsonFiles.find((entry) => entry.relativePath === relativePath)?.value;
    if (!Array.isArray(fixture)) {
        errors.push(`${relativePath}: terminal fixture must be an array`);
        continue;
    }
    const byScenario = new Map(fixture.map((scenario) => [scenario.scenario, scenario]));
    const committed = [...byScenario.values()].find((scenario) => /FAILED_WITH_COMMITTED/.test(scenario.scenario));
    const replay = byScenario.get('FAILED_REPLAY_IDEMPOTENCY');
    const mixed = byScenario.get('FAILED_MIXED_VALID_AND_MALFORMED');
    const mixedReplay = byScenario.get('FAILED_MIXED_REPLAY_IDEMPOTENCY');
    const empty = byScenario.get('FAILED_EMPTY_DATASET');
    const missing = byScenario.get('FAILED_WITHOUT_DATASET_ID');
    if (!committed || !replay || !empty || !missing) {
        errors.push(`${relativePath}: committed-row, replay, empty-dataset, and missing-dataset scenarios are required`);
        continue;
    }
    if (config.requiresMixedFixture && (!mixed || !mixedReplay)) {
        errors.push(`${relativePath}: mixed valid/malformed and mixed replay scenarios are required`);
    }
    const store = new Map();
    for (const scenario of fixture) {
        if (scenario.run?.status !== 'FAILED') errors.push(`${relativePath}: ${scenario.scenario} must use FAILED status`);
        const hasDatasetId = typeof scenario.run?.defaultDatasetId === 'string' && scenario.run.defaultDatasetId.length > 0;
        if (hasDatasetId !== (scenario.expected?.datasetFetched === true)) {
            errors.push(`${relativePath}: ${scenario.scenario} datasetFetched must follow defaultDatasetId presence`);
        }
        if (hasDatasetId && !Array.isArray(scenario.dataset)) {
            errors.push(`${relativePath}: ${scenario.scenario} must provide a dataset array`);
            continue;
        }
        if (!hasDatasetId && scenario.dataset !== null) {
            errors.push(`${relativePath}: ${scenario.scenario} without a dataset ID must use dataset:null`);
        }
        const records = Array.isArray(scenario.dataset) ? scenario.dataset : [];
        const keys = records.map((record, index) => config.keyFor(record, scenario.run, index));
        if (keys.some((key) => typeof key !== 'string' || !key.startsWith(config.requiredPrefix))) {
            errors.push(`${relativePath}: ${scenario.scenario} generated a non-prefixed delivery key`);
        }
        if (JSON.stringify(keys) !== JSON.stringify(scenario.expected?.deliveryKeys ?? [])) {
            errors.push(`${relativePath}: ${scenario.scenario} expected delivery keys do not match records`);
        }
        for (const [index, record] of records.entries()) store.set(keys[index], record);
        if (scenario.expected?.recordsPersisted !== records.length) {
            errors.push(`${relativePath}: ${scenario.scenario} recordsPersisted must equal dataset length`);
        }
        if (config.isDiagnostic && Object.hasOwn(scenario.expected ?? {}, 'validRecordsPersisted')) {
            const diagnosticCount = records.filter(config.isDiagnostic).length;
            const validCount = records.length - diagnosticCount;
            if (
                scenario.expected.validRecordsPersisted !== validCount
                || scenario.expected.diagnosticRecordsPersisted !== diagnosticCount
            ) {
                errors.push(`${relativePath}: ${scenario.scenario} valid/diagnostic persistence counts are incorrect`);
            }
        }
        if (scenario.expected?.terminalFailureReportedAfterIngestion !== true) {
            errors.push(`${relativePath}: ${scenario.scenario} must report terminal failure after ingestion`);
        }
        if (scenario.replayOf && scenario.expected?.uniqueRecordsAfterReplay !== store.size) {
            errors.push(`${relativePath}: ${scenario.scenario} replay did not prove stable-key idempotency`);
        }
    }
    if (committed.dataset.length < 1 || replay.dataset.length < 1) {
        errors.push(`${relativePath}: failed committed-row and replay datasets must be non-empty`);
    }
    if (config.requiresMixedFixture && mixed && mixedReplay) {
        const mixedKeys = mixed.dataset.map((record, index) => config.keyFor(record, mixed.run, index));
        const replayKeys = mixedReplay.dataset.map((record, index) => config.keyFor(record, mixedReplay.run, index));
        if (
            mixed.expected?.malformedDiagnosticsDeterministic !== true
            || mixedReplay.expected?.malformedDiagnosticsDeterministic !== true
            || JSON.stringify(mixedKeys) !== JSON.stringify(replayKeys)
            || !mixedKeys.some((key) => key.startsWith(`${config.requiredPrefix}diagnostic:`))
            || !mixedKeys.some((key) => !key.startsWith(`${config.requiredPrefix}diagnostic:`))
            || mixed.expected?.terminalFailureReportedAfterIngestion !== true
        ) {
            errors.push(`${relativePath}: mixed fixture must preserve valid rows and deterministic diagnostic keys before terminal reporting`);
        }
    }
    if (empty.dataset.length !== 0 || empty.expected?.safeEmptyResult !== true) {
        errors.push(`${relativePath}: FAILED empty dataset must be a safe zero-record result`);
    }
    if (missing.dataset !== null || missing.expected?.safeEmptyResult !== true) {
        errors.push(`${relativePath}: missing-dataset scenario must be safe and avoid retrieval`);
    }
}

const rssTerminalPath = path.join('rss-keyword-monitor', 'fixtures', 'terminal-run-scenarios.json');
const rssTerminal = jsonFiles.find(({ relativePath }) => relativePath === rssTerminalPath)?.value;
const rssCollisionScenario = Array.isArray(rssTerminal)
    ? rssTerminal.find((scenario) => scenario.scenario === 'FAILED_WITH_COMMITTED_ROWS')
    : null;
const rssCollisionRecords = rssCollisionScenario?.dataset ?? [];
if (
    rssCollisionRecords.length < 2
    || new Set(rssCollisionRecords.map((record) => record.itemKey)).size !== 1
    || new Set(rssCollisionRecords.map((record) => record.feedUrl)).size !== rssCollisionRecords.length
    || new Set(rssCollisionRecords.map(rssDeliveryKey)).size !== rssCollisionRecords.length
) {
    errors.push(`${rssTerminalPath}: must prove equal itemKey values from distinct feeds produce distinct composite keys`);
}

const tedTerminalPath = path.join('ted-tender-monitor', 'fixtures', 'terminal-run-scenarios.json');
const tedTerminal = jsonFiles.find(({ relativePath }) => relativePath === tedTerminalPath)?.value;
const tedNullTitle = Array.isArray(tedTerminal)
    ? tedTerminal.flatMap((scenario) => scenario.dataset ?? []).find((record) => record?.recordType === 'tender' && record.title === null)
    : null;
if (!tedNullTitle || typeof tedNullTitle.publicationNumber !== 'string') {
    errors.push(`${tedTerminalPath}: expected an identified tender with title:null`);
}

const n8nFiles = jsonFiles.filter(({ relativePath }) => relativePath.includes(`${path.sep}n8n${path.sep}`));
const workflowCapContracts = [
    { directory: 'bluesky-keyword-mention-alerts', field: 'maxPostsPerRun', cap: 100, limit: 100, controlRows: 0 },
    { directory: 'rss-keyword-monitor', field: 'maxItemsPerRun', cap: 200, limit: 200, controlRows: 0 },
    { directory: 'ted-tender-monitor', field: 'maxNewPerRun', cap: 999, limit: 1000, controlRows: 1 },
];
const capContractForPath = (relativePath) => workflowCapContracts.find((contract) => relativePath.startsWith(`${contract.directory}${path.sep}`));
for (const directory of requiredDirectories) {
    const count = n8nFiles.filter(({ relativePath }) => relativePath.startsWith(`${directory}${path.sep}`)).length;
    if (count < 1) errors.push(`${directory}: missing n8n workflow JSON`);
}

function canReach(workflow, from, to, seen = new Set()) {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    const outputs = workflow.connections?.[from]?.main ?? [];
    const targets = outputs.flatMap((branch) => branch ?? []).map((connection) => connection.node);
    return targets.some((target) => canReach(workflow, target, to, seen));
}

for (const { relativePath, value } of n8nFiles) {
    if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
        errors.push(`${relativePath}: n8n workflow must contain nodes`);
        continue;
    }
    for (const node of value.nodes) {
        if (node.credentials && Object.keys(node.credentials).length > 0) {
            errors.push(`${relativePath}: node ${node.name ?? '<unnamed>'} contains a credential binding`);
        }
        const serialized = JSON.stringify(node.parameters ?? {});
        if (/api[_-]?token|authorization/i.test(serialized) && !/YOUR_|\{\{|credential/i.test(serialized)) {
            errors.push(`${relativePath}: node ${node.name ?? '<unnamed>'} may embed authentication material`);
        }
        if (node.type === '@apify/n8n-nodes-apify.apify' && node.parameters?.resource === 'Actor tasks') {
            const locator = node.parameters.actorTaskId;
            if (
                typeof locator !== 'object'
                || locator === null
                || locator.__rl !== true
                || locator.mode !== 'id'
                || typeof locator.value !== 'string'
                || locator.value.length === 0
            ) {
                errors.push(`${relativePath}: Apify Task selector must use the current ID resource-locator object`);
            }
            if (node.parameters.useCustomBody !== false) {
                errors.push(`${relativePath}: Apify Task node must preserve saved Task input`);
            }
            for (const field of ['timeout', 'memory', 'build']) {
                if (Object.hasOwn(node.parameters, field)) {
                    errors.push(`${relativePath}: Apify Task node overrides saved Task ${field}`);
                }
            }
            if (node.parameters.authentication !== 'apifyApi') {
                errors.push(`${relativePath}: public default authentication must be API key`);
            }
        }
    }
    const runNode = value.nodes.find((node) =>
        node.type === '@apify/n8n-nodes-apify.apify'
        && node.parameters?.resource === 'Actor tasks'
        && node.parameters?.operation === 'Run task'
    );
    const datasetNode = value.nodes.find((node) =>
        node.type === '@apify/n8n-nodes-apify.apify'
        && node.parameters?.resource === 'Datasets'
        && node.parameters?.operation === 'Get items'
    );
    const destination = value.nodes.find((node) =>
        node.type === 'n8n-nodes-base.dataTable'
        && node.parameters?.resource === 'row'
        && node.parameters?.operation === 'upsert'
    );
    const outcome = value.nodes.find((node) => node.name === 'Report terminal outcome after ingestion');
    const missingDataset = value.nodes.find((node) => node.name === 'Report terminal run without dataset');
    if (!runNode || runNode.parameters?.waitForFinish !== true) {
        errors.push(`${relativePath}: n8n must use Run task with waitForFinish=true to retain every terminal status`);
    }
    if (runNode?.retryOnFail === true || (runNode?.maxTries ?? 1) > 1) {
        errors.push(`${relativePath}: n8n must never retry or rerun the Apify Task node`);
    }
    if (value.nodes.some((node) => node.parameters?.operation === 'Run task and get dataset')) {
        errors.push(`${relativePath}: success-gated Run task and get dataset operation is forbidden`);
    }
    if (!datasetNode || datasetNode.alwaysOutputData !== true || !String(datasetNode.parameters?.datasetId ?? '').includes('defaultDatasetId')) {
        errors.push(`${relativePath}: n8n must fetch the terminal run dataset by defaultDatasetId and preserve empty output`);
    }
    for (const [operation, node] of [['dataset retrieval', datasetNode], ['Data Table upsert', destination]]) {
        if (node?.retryOnFail !== true || node?.maxTries !== 3 || node?.waitBetweenTries !== 5000) {
            errors.push(`${relativePath}: n8n ${operation} must retry the same operation in place up to 3 times with a 5000 ms wait`);
        }
    }
    const capContract = capContractForPath(relativePath);
    const datasetNotes = String(datasetNode?.notes ?? '');
    if (
        !capContract
        || datasetNode?.parameters?.offset !== 0
        || datasetNode?.parameters?.limit !== capContract.limit
        || !/intentionally non-paginated/i.test(datasetNotes)
        || !new RegExp(`${capContract.field}[^.]*no greater than ${capContract.cap}`, 'i').test(datasetNotes)
        || !/account-gated validation/i.test(datasetNotes)
    ) {
        errors.push(`${relativePath}: n8n must enforce and document the fixed non-paginated ${capContract?.field ?? 'Task cap'} / retrieval-limit contract`);
    }
    if (capContract?.controlRows === 1 && (
        capContract.cap + capContract.controlRows !== capContract.limit
        || !/exactly one summary control row/i.test(datasetNotes)
    )) {
        errors.push(`${relativePath}: TED n8n must reserve exactly one summary control row within the 1000-row retrieval limit`);
    }
    const keyValue = destination?.parameters?.filters?.conditions?.[0]?.keyValue;
    const deliveryKeyMapping = destination?.parameters?.columns?.value?.deliveryKey;
    if (!destination || destination.typeVersion < 1.1 || !String(keyValue).includes('deliveryKey') || !String(deliveryKeyMapping).includes('deliveryKey')) {
        errors.push(`${relativePath}: n8n must Data Table upsert on deliveryKey`);
    }
    const productPrefix = relativePath.startsWith(`bluesky-keyword-mention-alerts${path.sep}`) ? 'bluesky:'
        : relativePath.startsWith(`rss-keyword-monitor${path.sep}`) ? 'rss:' : 'ted:';
    const prepareCode = value.nodes.find((node) => /Prepare .*dataset record/i.test(node.name ?? ''))?.parameters?.jsCode ?? '';
    if (!prepareCode.includes(productPrefix)) errors.push(`${relativePath}: n8n preparation must create ${productPrefix} keys`);
    if (capContract?.directory === 'bluesky-keyword-mention-alerts' || capContract?.directory === 'rss-keyword-monitor') {
        if (
            !prepareCode.includes(`${productPrefix}diagnostic:`)
            || !/map\(\(item, rowIndex\)/.test(prepareCode)
            || !/rowIdentity = `row:\$\{rowIndex\}`/.test(prepareCode)
            || !/payloadJson: JSON\.stringify\(diagnostic\)/.test(prepareCode)
            || /throw new Error/.test(prepareCode)
        ) {
            errors.push(`${relativePath}: malformed rows must become sanitized deterministic run-row diagnostics without aborting valid-row ingestion`);
        }
        if (!/diagnosticRecordsPersisted/.test(outcome?.parameters?.jsCode ?? '')) {
            errors.push(`${relativePath}: terminal outcome must report diagnostic persistence after the common upsert`);
        }
    }
    if (capContract?.directory === 'rss-keyword-monitor' && (
        !prepareCode.includes('encodeURIComponent(record.feedUrl)')
        || !prepareCode.includes('encodeURIComponent(record.itemKey)')
    )) {
        errors.push(`${relativePath}: RSS n8n delivery identity must include encoded feedUrl and itemKey components`);
    }
    if (!outcome || !/status\s*!==\s*'SUCCEEDED'/.test(outcome.parameters?.jsCode ?? '') || !/persisted/i.test(outcome.parameters?.jsCode ?? '')) {
        errors.push(`${relativePath}: n8n must report terminal failure after persistence`);
    }
    if (!missingDataset || !/no dataset request was attempted/i.test(missingDataset.parameters?.jsCode ?? '')) {
        errors.push(`${relativePath}: n8n must safely report a terminal run without a dataset ID`);
    }
    if (runNode && datasetNode && !canReach(value, runNode.name, datasetNode.name)) {
        errors.push(`${relativePath}: terminal run metadata must reach dataset retrieval`);
    }
    if (datasetNode && destination && !canReach(value, datasetNode.name, destination.name)) {
        errors.push(`${relativePath}: fetched dataset records must reach the idempotent destination`);
    }
    if (destination && outcome && !canReach(value, destination.name, outcome.name)) {
        errors.push(`${relativePath}: terminal outcome must be downstream of persistence`);
    }
}

const makeFiles = jsonFiles.filter(({ relativePath }) => relativePath.includes(`${path.sep}make${path.sep}`));
for (const directory of requiredDirectories) {
    const count = makeFiles.filter(({ relativePath }) => relativePath.startsWith(`${directory}${path.sep}`)).length;
    if (count < 1) errors.push(`${directory}: missing structured Make specification JSON`);
}

for (const { relativePath, value } of makeFiles) {
    if (value.schemaVersion !== 2) errors.push(`${relativePath}: Make schemaVersion must be 2`);
    if (value.status !== 'DRAFT_NOT_IMPORTED_RUN_OR_EXPORTED_BY_MAKE') {
        errors.push(`${relativePath}: Make status must remain an explicit draft`);
    }
    if (value.architecture !== 'APIFY_SCHEDULE_TO_WATCH_TASK_RUNS') {
        errors.push(`${relativePath}: Make package must use the event-driven Task watcher architecture`);
    }
    if (value.scenarioSettings?.storeIncompleteExecutions !== true) {
        errors.push(`${relativePath}: Make must store incomplete executions for retry handling`);
    }
    const modules = Array.isArray(value.modules) ? value.modules : [];
    const byName = new Map(modules.map((module) => [module.module, module]));
    for (const name of ['Watch Task Runs', 'Router', 'Get Dataset Items', 'Array Aggregator', 'Iterator']) {
        if (!byName.has(name)) errors.push(`${relativePath}: missing Make module/control ${name}`);
    }
    const watcher = byName.get('Watch Task Runs');
    if (watcher?.configuration?.event !== 'any finished Task run') {
        errors.push(`${relativePath}: watcher must pass every terminal Task run to the status router`);
    }
    const dataset = byName.get('Get Dataset Items');
    if (!Number.isInteger(dataset?.configuration?.limit) || dataset.configuration.limit < 1) {
        errors.push(`${relativePath}: dataset retrieval limit must be a positive integer`);
    }
    if (typeof dataset?.capInvariant !== 'string' || !dataset.capInvariant.includes('must be no greater than')) {
        errors.push(`${relativePath}: Task cap must be tied to the dataset retrieval limit`);
    }
    const capContract = capContractForPath(relativePath);
    const requirements = value.taskLaunch?.requirements ?? {};
    const capRequirementName = `${capContract?.field ?? ''}AtMost`;
    if (
        !capContract
        || requirements[capRequirementName] !== capContract.cap
        || requirements.datasetRetrievalLimit !== capContract.limit
        || requirements.paginationEnabled !== false
        || dataset?.configuration?.offset !== 0
        || dataset?.configuration?.limit !== capContract.limit
        || dataset?.configuration?.paginationEnabled !== false
        || !/intentionally non-paginated/i.test(dataset?.capInvariant ?? '')
        || !new RegExp(`${capContract.field}[^.]*no greater than ${capContract.cap}`, 'i').test(dataset?.capInvariant ?? '')
    ) {
        errors.push(`${relativePath}: Make must enforce the exact saved-Task cap, retrieval limit, and disabled-pagination contract`);
    }
    if (capContract?.controlRows === 1 && (
        requirements.summaryRowsPerRun !== 1
        || capContract.cap + requirements.summaryRowsPerRun !== capContract.limit
        || !/exactly one summary control row/i.test(dataset?.capInvariant ?? '')
    )) {
        errors.push(`${relativePath}: TED Make must reserve exactly one summary control row within the 1000-row retrieval limit`);
    }
    const aggregator = byName.get('Array Aggregator');
    if (aggregator?.configuration?.stopProcessingAfterEmptyAggregation !== false) {
        errors.push(`${relativePath}: Array Aggregator must emit an empty aggregation`);
    }
    if (aggregator?.configuration?.arrayOutputField !== 'Array[]') {
        errors.push(`${relativePath}: Array Aggregator output must use Make's actual Array[] field`);
    }
    const terminalRouter = modules.find((module) => module.module === 'Router' && module.routes?.datasetAvailable);
    if (
        !terminalRouter
        || /SUCCEEDED/i.test(terminalRouter.routes.datasetAvailable)
        || !/defaultDatasetId exists/i.test(terminalRouter.routes.datasetAvailable)
        || !/defaultDatasetId does not exist/i.test(terminalRouter.routes.missingDataset ?? '')
    ) {
        errors.push(`${relativePath}: dataset retrieval must route only on dataset ID presence, never terminal success`);
    }
    const terminalRoute = value.terminalFailureRoute;
    const persistedRowRoutes = [
        terminalRoute?.datasetWithRows,
        terminalRoute?.identifiedTenderRows,
        terminalRoute?.runScopedRows,
    ].filter((route) => typeof route === 'string');
    if (
        !terminalRoute
        || persistedRowRoutes.length === 0
        || persistedRowRoutes.some((route) => !/after .*persisted/i.test(route))
        || !/zero-row dataset/i.test(terminalRoute.emptyDataset ?? '')
        || !/does not request dataset/i.test(terminalRoute.missingDataset ?? '')
        || !/do not throw/i.test(terminalRoute.then ?? '')
    ) {
        errors.push(`${relativePath}: terminal failure routes must cover post-persistence, empty, and missing-dataset reporting`);
    }
    if (dataset?.route !== 'datasetAvailable') {
        errors.push(`${relativePath}: Get Dataset Items must run for every terminal status with a dataset ID`);
    }
    const postPersistenceReport = modules.find((module) =>
        module.module === 'Set Multiple Variables'
        && /after module \d+ when status != SUCCEEDED/i.test(module.route ?? '')
        && /persisted/i.test(module.purpose ?? '')
    );
    const destinationModule = modules.find((module) => module.app === 'Data store' && module.module === 'Add/Replace a Record');
    if (!postPersistenceReport || !destinationModule || postPersistenceReport.order <= destinationModule.order) {
        errors.push(`${relativePath}: non-success status reporting must follow the Data store write`);
    }
    for (const handlerName of ['getDatasetItems', 'destination']) {
        const handler = value.errorHandlers?.[handlerName];
        if (
            handler?.handler !== 'Retry'
            || handler.automaticCompletion !== true
            || handler.maximumAttempts !== 3
            || handler.delayMinutes !== 15
        ) {
            errors.push(`${relativePath}: ${handlerName} must use automatic Retry with 3 attempts and a 15-minute delay`);
        }
    }
    if (!Array.isArray(value.credentials) || value.credentials.length !== 0) {
        errors.push(`${relativePath}: Make specification must contain no credentials`);
    }
    const gate = Array.isArray(value.publicationGate) ? value.publicationGate.join(' ') : '';
    if (
        !/exact file/i.test(gate)
        || !/save and activate/i.test(gate)
        || !/recreated the Task-scoped Watch Task Runs webhook/i.test(gate)
        || !/Repeat .* after exact-file import/i.test(gate)
        || !/post-commit timeout/i.test(gate)
        || !/exactly one record/i.test(gate)
        || !/validator PASS/i.test(gate)
        || !/adversarial PASS/i.test(gate)
    ) {
        errors.push(`${relativePath}: Make publication gate must require exact-file re-import and two reviews`);
    }
    if (
        capContract
        && (!new RegExp(`${capContract.field}[^.]*no greater than ${capContract.cap}`, 'i').test(gate)
            || !new RegExp(`non-paginated retrieval limit of ${capContract.limit}`, 'i').test(gate))
    ) {
        errors.push(`${relativePath}: Make publication gate must verify the saved-Task cap against the fixed retrieval limit`);
    }
}

const blueskyMake = makeFiles.find(({ relativePath }) => relativePath.startsWith(`bluesky-keyword-mention-alerts${path.sep}`));
if (blueskyMake?.value?.taskLaunch?.requirements?.scheduleIntervalExceedsTaskTimeout !== true) {
    errors.push('Bluesky Make Task schedule interval must exceed the saved Task hard timeout');
}
const blueskyOutput = blueskyMake?.value?.modules?.find((module) => module.normalizedOutput)?.normalizedOutput;
for (const field of ['postUri', 'postUrl', 'authorHandle', 'authorDisplayName', 'text', 'createdAt', 'matchedTerms', 'matchSource', 'isNew']) {
    if (!Object.hasOwn(blueskyOutput ?? {}, field)) errors.push(`Bluesky Make mapping missing ${field}`);
}
if (!Object.hasOwn(blueskyOutput?.metrics ?? {}, 'quotes')) errors.push('Bluesky Make mapping missing metrics.quotes');

function validateDataStoreDestination(make, label, expectedKey, expectedFields) {
    const destination = make?.value?.modules?.find((module) => module.app === 'Data store' && module.module === 'Add/Replace a Record');
    const handler = make?.value?.errorHandlers?.destination;
    if (!destination) {
        errors.push(`${label} Make must use Data store Add/Replace a Record as its canonical destination`);
        return null;
    }
    if (destination.configuration?.overwriteExistingRecord !== true) {
        errors.push(`${label} Make data-store destination must enable overwrite`);
    }
    if (destination.idempotencyKey !== expectedKey || handler?.idempotencyKey !== expectedKey) {
        errors.push(`${label} Make data-store key must remain ${expectedKey} in the module and retry handler`);
    }
    for (const expectedField of expectedFields) {
        if (!String(destination.configuration?.key ?? '').includes(expectedField)) {
            errors.push(`${label} Make data-store key mapping must include ${expectedField}`);
        }
    }
    if (!/exactly one record/i.test(destination.nativeIdempotency ?? '') || !/exactly one record/i.test(handler?.requiredProof ?? '')) {
        errors.push(`${label} Make must require an exactly-one-record post-commit retry proof`);
    }
    return destination;
}

validateDataStoreDestination(blueskyMake, 'Bluesky', 'bluesky:postUri', ['uri']);

const rssMake = makeFiles.find(({ relativePath }) => relativePath.startsWith(`rss-keyword-monitor${path.sep}`));
const rssEnvelopes = rssMake?.value?.modules?.filter((module) => module.outputEnvelope).map((module) => module.outputEnvelope) ?? [];
if (!rssEnvelopes.some((envelope) => envelope.hasNewItems === true)) errors.push('RSS Make mapping missing true envelope');
if (!rssEnvelopes.some((envelope) => envelope.hasNewItems === false && envelope.newItemCount === 0)) errors.push('RSS Make mapping missing false envelope');
if (rssMake?.value?.taskLaunch?.requirements?.scheduleIntervalExceedsTaskTimeout !== true) {
    errors.push('RSS Make Task schedule interval must exceed the saved Task hard timeout');
}
const rssModules = rssMake?.value?.modules ?? [];
const rssValidationRouter = rssModules.find((module) => module.module === 'Router' && module.routes?.validRecord);
const rssAggregator = rssModules.find((module) => module.module === 'Array Aggregator');
if (!rssValidationRouter || !rssAggregator || rssValidationRouter.order >= rssAggregator.order) {
    errors.push('RSS Make must validate each record before aggregation');
}
const rssIterator = rssModules.find((module) => module.module === 'Iterator');
const rssDestination = validateDataStoreDestination(
    rssMake,
    'RSS',
    'rss:encodeURL(feedUrl):encodeURL(itemKey)',
    ['encodeURL(module 9 feedUrl)', 'encodeURL(module 9 itemKey)'],
);
if (!rssIterator || !rssDestination || rssIterator.order >= rssDestination.order || !/module 9 Iterator/i.test(rssDestination.route ?? '')) {
    errors.push('RSS Make per-item data-store destination must consume the mandatory Iterator output');
}

const tedMake = makeFiles.find(({ relativePath }) => relativePath.startsWith(`ted-tender-monitor${path.sep}`));
if (tedMake?.value?.taskLaunch?.requirements?.scheduleIntervalExceedsTaskTimeout !== true) {
    errors.push('TED Make Task schedule interval must exceed the saved Task hard timeout');
}
const tedOutput = tedMake?.value?.modules?.find((module) => module.normalizedOutput)?.normalizedOutput;
for (const field of ['publicationNumber', 'noticeType', 'links']) {
    if (!Object.hasOwn(tedOutput ?? {}, field)) errors.push(`TED Make mapping missing ${field}`);
}
for (const field of ['html', 'pdf', 'xml']) {
    if (!Object.hasOwn(tedOutput?.links ?? {}, field)) errors.push(`TED Make mapping missing links.${field}`);
}
const tedModules = tedMake?.value?.modules ?? [];
const tedModulesByOrder = new Map(tedModules.map((module) => [module.order, module]));
const tedDestinations = tedModules.filter((module) => module.app === 'Data store' && module.module === 'Add/Replace a Record');
const tedIdentifiedDestination = tedModulesByOrder.get(8);
const tedRunScopedDestination = tedModulesByOrder.get(9);
if (tedDestinations.length !== 2 || tedDestinations[0] !== tedIdentifiedDestination || tedDestinations[1] !== tedRunScopedDestination) {
    errors.push('TED Make must use exactly modules 8 and 9 as its two Data store Add/Replace destinations');
}
const tedDestinationContracts = [
    {
        module: tedIdentifiedDestination,
        route: 'identifiedTender',
        key: 'ted:{{module 6 publicationNumber}}',
        idempotencyKey: 'ted:publicationNumber',
    },
    {
        module: tedRunScopedDestination,
        route: 'runScopedRecord',
        key: 'ted:run:{{module 1 id}}:row:{{module 6 bundle order}}',
        idempotencyKey: 'ted:run:runId:row:bundleOrder',
    },
];
for (const contract of tedDestinationContracts) {
    const destination = contract.module;
    if (
        destination?.route !== contract.route
        || destination?.configuration?.key !== contract.key
        || destination?.idempotencyKey !== contract.idempotencyKey
    ) {
        errors.push(`TED Make module ${destination?.order ?? 'missing'} must preserve the exact ${contract.route} route and key semantics`);
    }
    if (destination?.configuration?.overwriteExistingRecord !== true) {
        errors.push(`TED Make module ${destination?.order ?? 'missing'} must enable overwrite`);
    }
    if (!/title:null remains null/i.test(destination?.configuration?.record?.payloadJson ?? '')) {
        errors.push(`TED Make module ${destination?.order ?? 'missing'} must preserve title:null in payloadJson`);
    }
    if (!/exactly one record/i.test(destination?.nativeIdempotency ?? '')) {
        errors.push(`TED Make module ${destination?.order ?? 'missing'} must document exactly-one-record retry behavior`);
    }
}
const tedClassificationRouter = tedModulesByOrder.get(7);
if (
    tedClassificationRouter?.module !== 'Router'
    || tedClassificationRouter?.routes?.identifiedTender !== 'recordType = tender AND publicationNumber exists'
    || tedClassificationRouter?.routes?.runScopedRecord !== 'recordType != tender OR publicationNumber missing'
) {
    errors.push('TED Make module 7 must classify identified and run-scoped records with the exact route semantics');
}
for (const router of tedModules.filter((module) => module.module === 'Router')) {
    if (/ted:(?:<|\{\{|publicationNumber|run:)/.test(JSON.stringify(router))) {
        errors.push(`TED Make Router module ${router.order} must not pretend to assign a persistence key`);
    }
}
const tedDiagnosticRouter = tedModulesByOrder.get(10);
if (
    tedDiagnosticRouter?.module !== 'Router'
    || tedDiagnosticRouter?.route !== 'after module 9'
    || tedDiagnosticRouter?.routes?.invalidTenderDiagnostic !== 'recordType = tender AND publicationNumber missing'
    || tedDiagnosticRouter?.routes?.terminalFailureDiagnostic !== 'status != SUCCEEDED'
    || tedModulesByOrder.get(11)?.route !== 'module 10 invalidTenderDiagnostic'
    || tedModulesByOrder.get(12)?.route !== 'module 10 terminalFailureDiagnostic'
    || tedModulesByOrder.get(13)?.route !== 'after module 8 when status != SUCCEEDED'
    || tedModulesByOrder.get(14)?.route !== 'quiet when status != SUCCEEDED'
    || tedModulesByOrder.get(15)?.route !== 'missingDataset'
) {
    errors.push('TED Make diagnostic routers and modules 10-15 must preserve the post-sink route topology');
}
const tedDestinationRetry = tedMake?.value?.errorHandlers?.destination;
if (
    JSON.stringify(tedDestinationRetry?.modules) !== JSON.stringify([8, 9])
    || tedDestinationRetry?.idempotencyKeys?.module8 !== 'ted:publicationNumber'
    || tedDestinationRetry?.idempotencyKeys?.module9 !== 'ted:run:runId:row:bundleOrder'
    || !/module 8 with ted:<publicationNumber>/i.test(tedDestinationRetry?.requiredProof ?? '')
    || !/module 9 with ted:run:<runId>:row:<bundleOrder>/i.test(tedDestinationRetry?.requiredProof ?? '')
) {
    errors.push('TED Make destination retry must cover modules 8 and 9 with their separate stable keys and post-commit proofs');
}
const tedTerminalRoute = tedMake?.value?.terminalFailureRoute;
if (
    !/module 13.*module 8 persisted ted:<publicationNumber>/i.test(tedTerminalRoute?.identifiedTenderRows ?? '')
    || !/module 12.*module 9 persisted ted:run:<runId>:row:<bundleOrder>/i.test(tedTerminalRoute?.runScopedRows ?? '')
    || !/module 14.*zero-row dataset/i.test(tedTerminalRoute?.emptyDataset ?? '')
    || !/module 15.*does not request dataset items/i.test(tedTerminalRoute?.missingDataset ?? '')
) {
    errors.push('TED Make terminal failure routes must follow the applicable sink and use coherent diagnostic module orders');
}
if (!tedMake?.value?.invalidTenderRoute) errors.push('TED Make mapping missing invalid-tender diagnostic route');
const tedMakeValidationRouter = tedMake?.value?.modules?.find((module) => module.module === 'Router' && module.routes?.identifiedTender);
if (!tedMakeValidationRouter || /title exists/i.test(JSON.stringify(tedMakeValidationRouter.routes))) {
    errors.push('TED Make must accept title:null and validate tender identity only by publicationNumber');
}
if (!String(tedMake?.value?.nonTenderRoute ?? '').includes('persisted under deterministic')) {
    errors.push('TED Make must persist non-tender dataset records under deterministic run-row keys');
}

if (errors.length > 0) {
    console.error(`Public asset validation failed with ${errors.length} finding(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(`Public asset validation passed: ${jsonFiles.length} JSON files, ${pngFiles.length} PNG assets, ${taskFiles.length} Task files, ${n8nFiles.length} n8n workflows, ${makeFiles.length} Make specifications.`);
}
