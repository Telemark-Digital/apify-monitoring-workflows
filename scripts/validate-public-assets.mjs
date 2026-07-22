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
        if (relativePath === '.git' && entry.isDirectory()) continue;
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
    if (value.architecture !== 'APIFY_SCHEDULE_TO_HTTP_POLLING_RECONCILER') {
        errors.push(`${relativePath}: Make package must use the HTTP polling Task-run reconciler architecture`);
    }
    if (value.scenarioSettings?.storeIncompleteExecutions !== true) {
        errors.push(`${relativePath}: Make must store incomplete executions for retry handling`);
    }
    if (value.scenarioSettings?.processInOrder !== true) {
        errors.push(`${relativePath}: Make must process in order / avoid overlapping executions for checkpoint safety`);
    }
    const modules = Array.isArray(value.modules) ? value.modules : [];
    if (modules.some((module) => module.app === 'Apify' || module.module === 'Watch Task Runs' || module.module === 'Get Dataset Items')) {
        errors.push(`${relativePath}: Make must not use the Make Apify connector modules`);
    }
    const byLabel = new Map(modules.filter((module) => module.label).map((module) => [module.label, module]));
    for (const label of ['HTTP List Task Runs', 'Read Last Processed Run Cursor', 'Preflight Cursor Guard', 'Cursor Guard Router', 'Iterator - Reversed Recent Task Runs', 'Current Run Context', 'Run Dataset Router', 'HTTP Get Dataset Items', 'Iterator - Dataset Items', 'Prepare Delivery Record', 'Write Delivery Record', 'Aggregate Completed Delivery Writes', 'Dataset Run Outcome', 'Write Dataset Run Cursor', 'Missing Dataset Outcome', 'Write Missing-Dataset Run Cursor']) {
        if (!byLabel.has(label)) errors.push(`${relativePath}: missing Make module/control ${label}`);
    }
    if (modules.some((module) => module.module === 'Search Records')) {
        errors.push(`${relativePath}: Make must not use Data store Search Records for cursor or checkpoint discovery`);
    }
    if (!modules.some((module) => module.module === 'Router')) errors.push(`${relativePath}: missing Make Router control`);
    if (!modules.some((module) => module.module === 'Array Aggregator')) errors.push(`${relativePath}: missing Make Array Aggregator control`);
    if (!modules.some((module) => module.module === 'Iterator')) errors.push(`${relativePath}: missing Make Iterator control`);
    const listRuns = byLabel.get('HTTP List Task Runs');
    const listHeaders = Array.isArray(listRuns?.configuration?.headers) ? listRuns.configuration.headers : [];
    const listAuth = listHeaders.find((header) => header.name === 'Authorization')?.value;
    if (
        listRuns?.app !== 'HTTP'
        || listRuns?.module !== 'Make a request'
        || listRuns?.configuration?.method !== 'GET'
        || !/\/actor-tasks\/\{\{TASK_ID\}\}\/runs\?desc=1&limit=1000&offset=0&status=SUCCEEDED,FAILED,ABORTED,TIMED-OUT$/.test(listRuns?.configuration?.url ?? '')
        || listAuth !== 'Bearer <APIFY_TOKEN_PLACEHOLDER>'
        || listRuns?.configuration?.limit !== 1000
        || listRuns?.configuration?.offset !== 0
        || listRuns?.configuration?.desc !== true
        || listRuns?.configuration?.status !== 'SUCCEEDED,FAILED,ABORTED,TIMED-OUT'
        || listRuns?.runWindow?.limit !== 1000
        || !/reverse/i.test(listRuns?.runWindow?.sort ?? '')
        || !/limit maximum is 1000/i.test(listRuns?.runWindow?.officialPagination ?? '')
        || !/stored cursor run is not present/i.test(listRuns?.runWindow?.overflowGuard ?? '')
        || !/maxRunsPerScenarioExecution=1/i.test(listRuns?.runWindow?.sort ?? '')
        || !Array.isArray(listRuns?.runWindow?.terminalStatuses)
        || !['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].every((status) => listRuns.runWindow.terminalStatuses.includes(status))
    ) {
        errors.push(`${relativePath}: HTTP List Task Runs must use the max 1000-run terminal-status-filtered page, reversed processing, overflow stop, and a scrubbed limited-token Authorization placeholder`);
    }
    const cursorRead = byLabel.get('Read Last Processed Run Cursor');
    const preflightGuard = byLabel.get('Preflight Cursor Guard');
    const overflowRouter = byLabel.get('Cursor Guard Router');
    const runIterator = byLabel.get('Iterator - Reversed Recent Task Runs');
    const runContext = byLabel.get('Current Run Context');
    const datasetItemIterator = byLabel.get('Iterator - Dataset Items');
    if (
        cursorRead?.order !== 2
        || cursorRead?.app !== 'Data store'
        || cursorRead?.module !== 'Get a Record'
        || !/before any product or run-cursor write/i.test(cursorRead?.route ?? '')
        || cursorRead?.configuration?.readOnly !== true
        || !/^[a-z]+:cursor:\{\{TASK_ID\}\}$/.test(cursorRead?.configuration?.key ?? '')
        || !/Do not use Data store Search Records/i.test(cursorRead?.purpose ?? '')
        || preflightGuard?.order !== 3
        || preflightGuard?.module !== 'Set Multiple Variables'
        || !/cursorFoundInFetchedPage/i.test(JSON.stringify(preflightGuard))
        || !/cursorPrimingStop/i.test(JSON.stringify(preflightGuard))
        || preflightGuard?.outputs?.cursorBoundaryMissing !== 'cursorExists = true AND cursorFoundInFetchedPage = false'
        || !/maxRunsPerScenarioExecution/i.test(preflightGuard?.outputs?.reversedRuns ?? '')
        || preflightGuard?.inputs?.maxRunsPerScenarioExecution !== 1
        || !/exact-key cursor that existed before/i.test(preflightGuard?.invariant ?? '')
        || overflowRouter?.order !== 4
        || overflowRouter?.module !== 'Router'
        || !/module 3 cursorPrimingStop = true/.test(overflowRouter?.routes?.cursorPrimingStop ?? '')
        || !/module 3 cursorBoundaryMissing = true/.test(overflowRouter?.routes?.overflowStop ?? '')
        || !/must not reach module 5 or any product\/run-cursor write/i.test(overflowRouter?.invariant ?? '')
        || runIterator?.order !== 5
        || runIterator?.array !== 'module 3 reversedRuns[]'
        || runIterator?.route !== 'proceed'
        || runContext?.order !== 6
        || runContext?.module !== 'Set Multiple Variables'
        || runContext?.outputs?.defaultDatasetId !== 'module 5 defaultDatasetId'
        || datasetItemIterator?.order !== 9
        || datasetItemIterator?.module !== 'Iterator'
        || datasetItemIterator?.route !== 'datasetAvailable'
        || datasetItemIterator?.array !== 'module 8 parsed JSON array[]'
    ) {
        errors.push(`${relativePath}: Make must structurally preflight the exact run cursor and stop before processing on cursor gaps`);
    }
    const dataset = byLabel.get('HTTP Get Dataset Items');
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
        || requirements.pollRunLimit !== 1000
        || requirements.overflowStopIfCursorMissingFromFetchedPage !== true
        || requirements.overflowStopBeforeProcessing !== true
        || requirements.preflightCursorRead !== true
        || requirements.cursorPrimingRequired !== true
        || requirements.noDataStoreSearchForCursor !== true
        || !/single exact-key Data store cursor/i.test(requirements.runCursorStrategy ?? '')
        || requirements.maxRunsPerScenarioExecution !== 1
        || requirements.operationBudgetValidation !== true
        || !/one cursor-selected terminal Task run/i.test(requirements.operationBudgetGuard ?? '')
        || requirements.backlogDrainFormula !== 'makePollsPerHour * maxRunsPerScenarioExecution > apifyRunsPerHour'
        || !/pause the Apify Schedule/i.test(requirements.backlogDrainRequirement ?? '')
        || !/module 12 Array Aggregator sourceModule=9/i.test(requirements.completionBarrier ?? '')
        || !/completedDeliveryWrites equals attemptedDatasetRows/i.test(requirements.completionBarrier ?? '')
        || !/Module 11 must use Rollback\/stop-on-error/i.test(requirements.deliveryFailureStrategy ?? '')
        || !/Retry saves failed bundles as incomplete executions/i.test(requirements.deliveryFailureStrategy ?? '')
        || JSON.stringify(requirements.preflightModules) !== JSON.stringify([2, 3, 4])
        || requirements.runOrdering !== 'reverse-fetched-desc-page-after-cursor-filter'
        || !/covered_minutes = pollRunLimit/i.test(requirements.pollWindowFormula ?? '')
        || requirements.makePollIntervalCoversRunWindow !== true
        || dataset?.configuration?.offset !== 0
        || dataset?.configuration?.limit !== capContract.limit
        || dataset?.configuration?.paginationEnabled !== false
        || dataset?.app !== 'HTTP'
        || dataset?.module !== 'Make a request'
        || dataset?.configuration?.method !== 'GET'
        || !String(dataset?.configuration?.url ?? '').endsWith(`/datasets/{{module 5 defaultDatasetId}}/items?format=json&clean=1&offset=0&limit=${capContract.limit}`)
        || !Array.isArray(dataset?.configuration?.headers)
        || dataset.configuration.headers.find((header) => header.name === 'Authorization')?.value !== 'Bearer <APIFY_TOKEN_PLACEHOLDER>'
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
    const prepareDelivery = byLabel.get('Prepare Delivery Record');
    const payloadSerializer = byLabel.get('Serialize Delivery Payload');
    const deliverySink = byLabel.get('Write Delivery Record');
    const aggregator = byLabel.get('Aggregate Completed Delivery Writes');
    const datasetOutcome = byLabel.get('Dataset Run Outcome');
    const datasetCursor = byLabel.get('Write Dataset Run Cursor');
    const missingDatasetOutcome = byLabel.get('Missing Dataset Outcome');
    const missingDatasetCursor = byLabel.get('Write Missing-Dataset Run Cursor');
    if (
        prepareDelivery?.order !== 10
        || prepareDelivery?.module !== 'Set Multiple Variables'
        || !/one idempotent Data store delivery record for every dataset row/i.test(prepareDelivery?.purpose ?? '')
        || !/module 9/i.test(prepareDelivery?.inputs ?? '')
        || deliverySink?.order !== 11
        || deliverySink?.app !== 'Data store'
        || deliverySink?.module !== 'Add/Replace a Record'
        || deliverySink?.configuration?.key !== '{{module 10 recordKey}}'
        || deliverySink?.configuration?.overwriteExistingRecord !== true
        || deliverySink?.idempotencyKey !== 'module 10 recordKey'
        || !/module 10 recordKey/i.test(deliverySink?.nativeIdempotency ?? '')
    ) {
        errors.push(`${relativePath}: Make must prepare every row in module 10 and write it through the single module 11 delivery sink`);
    }
    if (relativePath.startsWith(`bluesky-keyword-mention-alerts${path.sep}`) && (
        payloadSerializer?.order !== 10.5
        || payloadSerializer?.makeModuleId !== 17
        || payloadSerializer?.app !== 'JSON'
        || payloadSerializer?.module !== 'Transform to JSON'
        || !/after module 10 before module 11/i.test(payloadSerializer?.route ?? '')
        || payloadSerializer?.configuration?.output !== 'json'
        || !/native JSON serializer/i.test(payloadSerializer?.purpose ?? '')
        || deliverySink?.configuration?.record?.payloadJson !== '{{module 17 json}}'
    )) {
        errors.push(`${relativePath}: Bluesky Make must serialize payloadJson through native JSON module 17 before the Data store write`);
    }
    if (aggregator?.configuration?.stopProcessingAfterEmptyAggregation !== false) {
        errors.push(`${relativePath}: Array Aggregator must emit an empty aggregation`);
    }
    if (aggregator?.configuration?.arrayOutputField !== 'Array[]') {
        errors.push(`${relativePath}: Array Aggregator output must use Make's actual Array[] field`);
    }
    if (
        aggregator?.order !== 12
        || aggregator?.configuration?.sourceModule !== 9
        || !/Make-native completion barrier/i.test(aggregator?.barrierInvariant ?? '')
        || !/completedDeliveryWrites equals attemptedDatasetRows/i.test(aggregator?.barrierInvariant ?? '')
    ) {
        errors.push(`${relativePath}: Array Aggregator must consume completed delivery writes from module 11 as the Make-native cursor barrier`);
    }
    const terminalRouter = modules.find((module) => module.module === 'Router' && module.routes?.datasetAvailable);
    if (
        !terminalRouter
        || /SUCCEEDED/i.test(terminalRouter.routes.datasetAvailable)
        || !/defaultDatasetId exists/i.test(terminalRouter.routes.datasetAvailable)
        || !/defaultDatasetId missing/i.test(terminalRouter.routes.missingDataset ?? '')
    ) {
        errors.push(`${relativePath}: dataset retrieval must route only on dataset ID presence, never terminal success`);
    }
    const terminalRoute = value.terminalFailureRoute;
    if (
        !terminalRoute
        || !/module 12 aggregates completed module 11 delivery writes/i.test(terminalRoute.datasetPath ?? '')
        || !/module 12 emits an empty Array\[\]/i.test(terminalRoute.emptyDataset ?? '')
        || !/module 15 records that no dataset request was attempted/i.test(terminalRoute.missingDataset ?? '')
        || !/do not throw/i.test(terminalRoute.then ?? '')
    ) {
        errors.push(`${relativePath}: terminal failure routes must cover the completion barrier, empty dataset, and missing-dataset cursor paths`);
    }
    if (dataset?.route !== 'datasetAvailable') {
        errors.push(`${relativePath}: HTTP Get Dataset Items must run for every terminal status with a dataset ID`);
    }
    const destinationModule = deliverySink;
    if (
        datasetOutcome?.order !== 13
        || datasetOutcome?.module !== 'Set Multiple Variables'
        || !/after module 12 completion barrier/i.test(datasetOutcome?.route ?? '')
        || !JSON.stringify(datasetOutcome?.fields ?? []).includes('Task run status')
        || datasetOutcome?.outputs?.attemptedDatasetRows !== 'length(module 8 parsed JSON array[])'
        || datasetOutcome?.outputs?.completedDeliveryWrites !== 'length(module 12 Array[])'
        || datasetOutcome?.outputs?.cursorWriteAllowed !== 'completedDeliveryWrites = attemptedDatasetRows AND module11IncompleteExecutions = 0'
        || !/must stop before module 14 unless every attempted dataset row/i.test(datasetOutcome?.purpose ?? '')
        || datasetOutcome.order <= (aggregator?.order ?? 0)
    ) {
        errors.push(`${relativePath}: dataset status reporting must follow the delivery-write completion barrier`);
    }
    for (const handlerName of ['listTaskRuns', 'preflightCursorRead', 'getDatasetItems', 'runCursor']) {
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
    const destinationHandler = value.errorHandlers?.destination;
    if (
        destinationHandler?.handler !== 'Rollback'
        || destinationHandler.automaticCompletion !== false
        || destinationHandler.stopsScenario !== true
        || destinationHandler.noFurtherBundles !== true
        || destinationHandler.idempotencyKey !== 'module 10 recordKey'
        || !/Do not use Make Retry\/Break on module 11/i.test(destinationHandler.never ?? '')
        || !/module 12\/module 14 do not run/i.test(destinationHandler.requiredProof ?? '')
        || !/run cursor remains unchanged/i.test(destinationHandler.requiredProof ?? '')
    ) {
        errors.push(`${relativePath}: destination/module 11 failures must use Rollback stop-on-error, not Retry/Break`);
    }
    if (value.errorHandlers?.listTaskRuns?.never !== 'rerun the Apify Task' || value.errorHandlers?.getDatasetItems?.never !== 'rerun the Apify Task') {
        errors.push(`${relativePath}: Make HTTP polling retries must never rerun the Apify Task`);
    }
    if (!Array.isArray(value.credentials) || value.credentials.length !== 0) {
        errors.push(`${relativePath}: Make specification must contain no credentials`);
    }
    if (
        value.authentication?.app !== 'HTTP'
        || value.authentication?.value !== 'Bearer <APIFY_TOKEN_PLACEHOLDER>'
        || !/Remove real Authorization values/i.test(value.authentication?.exportScrub ?? '')
        || !/limited Apify token/i.test(value.authentication?.tokenScope ?? '')
    ) {
        errors.push(`${relativePath}: Make authentication must use a scrubbed limited-token HTTP placeholder`);
    }
    const cursorWrites = [datasetCursor, missingDatasetCursor];
    if (
        datasetCursor?.order !== 14
        || !/after module 13 dataset outcome when module 13 cursorWriteAllowed = true/i.test(datasetCursor?.route ?? '')
        || missingDatasetOutcome?.order !== 15
        || !/no dataset request was attempted/i.test(missingDatasetOutcome?.purpose ?? '')
        || missingDatasetCursor?.order !== 16
        || !/after module 15 missing-dataset outcome/i.test(missingDatasetCursor?.route ?? '')
        || cursorWrites.some((checkpoint) =>
            checkpoint?.app !== 'Data store'
            || checkpoint?.module !== 'Add/Replace a Record'
            || checkpoint?.configuration?.overwriteExistingRecord !== true
            || checkpoint?.order <= (destinationModule?.order ?? 0)
            || !/^[a-z]+:cursor:taskId$/.test(checkpoint?.idempotencyKey ?? '')
        )
        || !/completedDeliveryWrites equals attemptedDatasetRows/i.test(datasetCursor?.checkpointInvariant ?? '')
        || !/zero module 11 incomplete executions/i.test(datasetCursor?.checkpointInvariant ?? '')
        || !/module 11 must use Rollback\/stop-on-error/i.test(datasetCursor?.checkpointInvariant ?? '')
        || !/module 15 has completed/i.test(missingDatasetCursor?.checkpointInvariant ?? '')
    ) {
        errors.push(`${relativePath}: Make run cursor must be an idempotent write after the dataset barrier or missing-dataset outcome`);
    }
    const gate = Array.isArray(value.publicationGate) ? value.publicationGate.join(' ') : '';
    if (
        !/exact file/i.test(gate)
        || !/save and activate/i.test(gate)
        || !/HTTP polling/i.test(gate)
        || !/desc=1&limit=1000&offset=0/i.test(gate)
        || !/reverse the fetched page/i.test(gate)
        || !/fetched page has no cursor boundary/i.test(gate)
        || !/cursor-gap stop/i.test(gate)
        || !/run-cursor/i.test(gate)
        || !/maxRunsPerScenarioExecution at 1/i.test(gate)
        || !/makePollsPerHour \* maxRunsPerScenarioExecution > apifyRunsPerHour/i.test(gate)
        || !/module 12 as the Array Aggregator completion barrier with sourceModule=9/i.test(gate)
        || !/Rollback\/stop-on-error rather than Retry\/Break/i.test(gate)
        || !/completedDeliveryWrites equals attemptedDatasetRows/i.test(gate)
        || !/module 12\/module 14 do not run/i.test(gate)
        || !/Do not use Data store Search Records/i.test(gate)
        || !/Authorization headers/i.test(gate)
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

function validateDataStoreDestination(make, label, expectedRecordKeyPattern, expectedProofPattern) {
    const destination = make?.value?.modules?.find((module) => module.label === 'Write Delivery Record');
    const prepare = make?.value?.modules?.find((module) => module.label === 'Prepare Delivery Record');
    const handler = make?.value?.errorHandlers?.destination;
    if (!destination) {
        errors.push(`${label} Make must use Data store Add/Replace a Record as its canonical destination`);
        return null;
    }
    if (destination.configuration?.overwriteExistingRecord !== true) {
        errors.push(`${label} Make data-store destination must enable overwrite`);
    }
    if (destination.idempotencyKey !== 'module 10 recordKey' || handler?.idempotencyKey !== 'module 10 recordKey') {
        errors.push(`${label} Make data-store key must use the module 10 prepared recordKey in the module and destination failure handler`);
    }
    if (destination.configuration?.key !== '{{module 10 recordKey}}') {
        errors.push(`${label} Make data-store destination must use the prepared module 10 recordKey`);
    }
    if (!expectedRecordKeyPattern.test(prepare?.recordKey ?? '')) {
        errors.push(`${label} Make prepared recordKey does not include the expected stable product identity`);
    }
    if (!expectedProofPattern.test(destination.destinationKeyProof ?? '')) {
        errors.push(`${label} Make destination proof does not document the expected stable product key`);
    }
    if (!/exactly one record/i.test(destination.nativeIdempotency ?? '') || !/exactly one record/i.test(handler?.requiredProof ?? '')) {
        errors.push(`${label} Make must require an exactly-one-record post-commit retry proof`);
    }
    return destination;
}

validateDataStoreDestination(blueskyMake, 'Bluesky', /bluesky:\{\{module 9 uri\}\}/, /bluesky:<postUri>/);

const rssMake = makeFiles.find(({ relativePath }) => relativePath.startsWith(`rss-keyword-monitor${path.sep}`));
const rssEnvelope = rssMake?.value?.modules?.find((module) => module.label === 'Prepare Delivery Record')?.outputEnvelope;
if (!rssEnvelope || !/validDelivery = true/.test(rssEnvelope.hasNewItems ?? '') || !/valid RSS records/i.test(rssEnvelope.items ?? '')) {
    errors.push('RSS Make mapping missing a valid-row output envelope');
}
if (rssMake?.value?.taskLaunch?.requirements?.scheduleIntervalExceedsTaskTimeout !== true) {
    errors.push('RSS Make Task schedule interval must exceed the saved Task hard timeout');
}
const rssModules = rssMake?.value?.modules ?? [];
const rssPrepare = rssModules.find((module) => module.label === 'Prepare Delivery Record');
const rssAggregator = rssModules.find((module) => module.module === 'Array Aggregator');
if (!rssPrepare || !/validDelivery = itemKey exists AND feedUrl exists AND isNew = true/.test(rssPrepare.validation ?? '') || !rssAggregator || rssPrepare.order >= rssAggregator.order) {
    errors.push('RSS Make must validate each record before the completion barrier');
}
const rssDestination = validateDataStoreDestination(
    rssMake,
    'RSS',
    /rss:\{\{encodeURL\(module 9 feedUrl\)\}\}:\{\{encodeURL\(module 9 itemKey\)\}\}/,
    /rss:<encodedFeedUrl>:<encodedItemKey>/,
);
if (!rssDestination || rssDestination.order !== 11 || !/after module 10 for every dataset row/i.test(rssDestination.route ?? '')) {
    errors.push('RSS Make per-item data-store destination must consume the prepared module 10 record');
}
const rssPostPersistenceReport = rssModules.find((module) => module.order === 13);
if (
    rssPostPersistenceReport?.module !== 'Set Multiple Variables'
    || rssPostPersistenceReport?.route !== 'after module 12 completion barrier'
    || !/delivery-write barrier/i.test(rssPostPersistenceReport?.purpose ?? '')
) {
    errors.push('RSS Make terminal status report must run after the module 12 delivery-write barrier');
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
const tedPrepare = tedModulesByOrder.get(10);
const tedDeliveryDestination = tedModulesByOrder.get(11);
const tedDatasetCursor = tedModulesByOrder.get(14);
const tedMissingDatasetCursor = tedModulesByOrder.get(16);
if (tedDestinations.length !== 3 || tedDeliveryDestination?.label !== 'Write Delivery Record' || tedDatasetCursor?.label !== 'Write Dataset Run Cursor' || tedMissingDatasetCursor?.label !== 'Write Missing-Dataset Run Cursor') {
    errors.push('TED Make must use one delivery Data store sink plus two explicit cursor writes');
}
if (
    tedDeliveryDestination?.configuration?.key !== '{{module 10 recordKey}}'
    || tedDeliveryDestination?.idempotencyKey !== 'module 10 recordKey'
    || !/ted:<publicationNumber>.*ted:run:<runId>:row:<bundleOrder>/i.test(tedDeliveryDestination?.destinationKeyProof ?? '')
    || !/title:null remains null/i.test(tedPrepare?.recordFields?.payloadJson ?? '')
    || !/exactly one record/i.test(tedDeliveryDestination?.nativeIdempotency ?? '')
) {
    errors.push('TED Make module 11 must preserve identified and run-scoped key semantics through module 10 recordKey');
}
if (
    tedPrepare?.label !== 'Prepare Delivery Record'
    || tedPrepare?.validation !== 'identifiedTender = recordType = tender AND publicationNumber exists'
    || !/ted:\{\{module 9 publicationNumber\}\}/.test(tedPrepare?.recordKey ?? '')
    || !/ted:run:\{\{module 5 id\}\}:row:\{\{module 9 bundle order\}\}/.test(tedPrepare?.recordKey ?? '')
) {
    errors.push('TED Make module 10 must classify identified and run-scoped records with the exact key semantics');
}
const tedClassificationRouter = tedPrepare;
if (
    tedClassificationRouter?.validation !== 'identifiedTender = recordType = tender AND publicationNumber exists'
) {
    errors.push('TED Make module 10 must classify identified and run-scoped records with the exact route semantics');
}
for (const router of tedModules.filter((module) => module.module === 'Router')) {
    if (/ted:(?:<|\{\{|publicationNumber|run:)/.test(JSON.stringify(router))) {
        errors.push(`TED Make Router module ${router.order} must not pretend to assign a persistence key`);
    }
}
const tedDestinationRetry = tedMake?.value?.errorHandlers?.destination;
if (
    tedDestinationRetry?.idempotencyKey !== 'module 10 recordKey'
    || !/module 11/i.test(tedDestinationRetry?.resumeAt ?? '')
    || !/ted:<publicationNumber>/i.test(tedDestinationRetry?.requiredProof ?? '')
    || !/ted:run:<runId>:row:<bundleOrder>/i.test(tedDestinationRetry?.requiredProof ?? '')
) {
    errors.push('TED Make destination retry must cover module 11 with both stable key families and post-commit proofs');
}
const tedTerminalRoute = tedMake?.value?.terminalFailureRoute;
if (
    !/module 12 aggregates completed module 11 delivery writes/i.test(tedTerminalRoute?.datasetPath ?? '')
    || !/module 12 emits an empty Array\[\]/i.test(tedTerminalRoute?.emptyDataset ?? '')
    || !/module 15 records that no dataset request was attempted/i.test(tedTerminalRoute?.missingDataset ?? '')
) {
    errors.push('TED Make terminal failure routes must follow the applicable sink and use coherent diagnostic module orders');
}
if (!tedMake?.value?.invalidTenderRoute) errors.push('TED Make mapping missing invalid-tender diagnostic route');
if (!tedPrepare || /title exists/i.test(JSON.stringify(tedPrepare))) {
    errors.push('TED Make must accept title:null and validate tender identity only by publicationNumber');
}
if (!/deterministic run-row keys/i.test(tedMake?.value?.nonTenderRoute ?? '')) {
    errors.push('TED Make must persist non-tender dataset records under deterministic run-row keys');
}

if (errors.length > 0) {
    console.error(`Public asset validation failed with ${errors.length} finding(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(`Public asset validation passed: ${jsonFiles.length} JSON files, ${pngFiles.length} PNG assets, ${taskFiles.length} Task files, ${n8nFiles.length} n8n workflows, ${makeFiles.length} Make specifications.`);
}
