import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const products = [
    {
        name: 'bluesky-keyword-alerts',
        displayName: 'Bluesky Keyword Alerts',
        actorId: 'uplifted_novice_vbl/bluesky-keyword-mention-alerts',
        mcpServerName: 'telemark-bluesky-keyword-alerts',
        capText: 'maxPostsPerRun <= 100',
    },
    {
        name: 'rss-keyword-monitor',
        displayName: 'RSS Keyword Monitor',
        actorId: 'uplifted_novice_vbl/rss-keyword-monitor-only-new',
        mcpServerName: 'telemark-rss-keyword-monitor',
        capText: 'maxItemsPerRun <= 200',
    },
    {
        name: 'ted-tender-monitor',
        displayName: 'TED Tender Monitor',
        actorId: 'uplifted_novice_vbl/ted-tender-watch',
        mcpServerName: 'telemark-ted-tender-monitor',
        capText: 'maxNewPerRun <= 999',
    },
];

const errors = [];

async function readJson(relativePath) {
    try {
        return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
    } catch (error) {
        errors.push(`${relativePath}: cannot read valid JSON (${error.message})`);
        return null;
    }
}

async function readText(relativePath) {
    try {
        return await readFile(path.join(root, relativePath), 'utf8');
    } catch (error) {
        errors.push(`${relativePath}: cannot read file (${error.message})`);
        return '';
    }
}

async function assertFile(relativePath) {
    try {
        const info = await stat(path.join(root, relativePath));
        if (!info.isFile()) errors.push(`${relativePath}: expected file`);
    } catch {
        errors.push(`${relativePath}: missing file`);
    }
}

function assert(condition, message) {
    if (!condition) errors.push(message);
}

function isHttpsUrl(value) {
    return typeof value === 'string' && /^https:\/\/[^ \n]+$/i.test(value);
}

function assertNoCredentialShape(relativePath, text) {
    const checks = [
        ['Apify token', new RegExp(`\\b${['apify', 'api'].join('_')}_[A-Za-z0-9_-]{12,}\\b`)],
        ['authorization header', /authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._-]{12,}/i],
        ['webhook URL', /https:\/\/hooks\.slack\.com|discord(?:app)?\.com\/api\/webhooks/i],
        ['environment-secret reference', new RegExp(`\\b(?:${['APIFY', 'TOKEN'].join('_')}|${['API', 'SECRET'].join('_')}|${['WEBHOOK', 'SECRET'].join('_')})\\b`)],
    ];
    for (const [label, pattern] of checks) {
        if (pattern.test(text)) errors.push(`${relativePath}: contains ${label}`);
    }
}

const codexMarketplace = await readJson('.agents/plugins/marketplace.json');
const claudeMarketplace = await readJson('.claude-plugin/marketplace.json');

assert(codexMarketplace?.name === 'telemark-digital-apify', '.agents/plugins/marketplace.json: unexpected marketplace name');
assert(codexMarketplace?.interface?.displayName === 'Telemark Digital Apify', '.agents/plugins/marketplace.json: missing display name');
assert(Array.isArray(codexMarketplace?.plugins) && codexMarketplace.plugins.length === products.length, '.agents/plugins/marketplace.json: expected three plugin entries');

assert(claudeMarketplace?.name === 'telemark-digital-apify', '.claude-plugin/marketplace.json: unexpected marketplace name');
assert(claudeMarketplace?.owner?.name === 'Telemark Digital', '.claude-plugin/marketplace.json: missing owner name');
assert(typeof claudeMarketplace?.description === 'string' && claudeMarketplace.description.length > 0, '.claude-plugin/marketplace.json: missing marketplace description');
assert(Array.isArray(claudeMarketplace?.plugins) && claudeMarketplace.plugins.length === products.length, '.claude-plugin/marketplace.json: expected three plugin entries');

for (const product of products) {
    const pluginRoot = `plugins/${product.name}`;
    const codexEntry = codexMarketplace?.plugins?.find((entry) => entry.name === product.name);
    const claudeEntry = claudeMarketplace?.plugins?.find((entry) => entry.name === product.name);
    assert(codexEntry?.source?.source === 'local', `${product.name}: Codex marketplace source must be local`);
    assert(codexEntry?.source?.path === `./${pluginRoot}`, `${product.name}: Codex marketplace path must point to plugin root`);
    assert(codexEntry?.policy?.installation === 'AVAILABLE', `${product.name}: Codex marketplace installation policy must be AVAILABLE`);
    assert(codexEntry?.policy?.authentication === 'ON_INSTALL', `${product.name}: Codex marketplace auth policy must be ON_INSTALL`);
    assert(codexEntry?.category === 'Productivity', `${product.name}: Codex marketplace category must be Productivity`);
    assert(claudeEntry?.source === `./${pluginRoot}`, `${product.name}: Claude marketplace path must point to plugin root`);
    assert(!Object.hasOwn(claudeEntry ?? {}, 'version'), `${product.name}: Claude marketplace entry should not pin a version during early git distribution`);

    const codexManifestPath = `${pluginRoot}/.codex-plugin/plugin.json`;
    const claudeManifestPath = `${pluginRoot}/.claude-plugin/plugin.json`;
    const mcpPath = `${pluginRoot}/.mcp.json`;
    const skillPath = `${pluginRoot}/skills/${product.name}/SKILL.md`;
    const codexManifest = await readJson(codexManifestPath);
    assert(codexManifest?.name === product.name, `${codexManifestPath}: name mismatch`);
    assert(/^\d+\.\d+\.\d+$/.test(codexManifest?.version ?? ''), `${codexManifestPath}: version must be strict semver`);
    assert(codexManifest?.author?.name === 'Telemark Digital', `${codexManifestPath}: author name mismatch`);
    assert(codexManifest?.skills === './skills/', `${codexManifestPath}: skills path must be ./skills/`);
    assert(codexManifest?.mcpServers === './.mcp.json', `${codexManifestPath}: mcpServers path must be ./.mcp.json`);
    assert(codexManifest?.interface?.displayName === product.displayName, `${codexManifestPath}: display name mismatch`);
    assert(!Object.hasOwn(codexManifest?.interface ?? {}, 'composerIcon'), `${codexManifestPath}: omit optional composerIcon while the public package is text-only`);
    assert(!Object.hasOwn(codexManifest?.interface ?? {}, 'logo'), `${codexManifestPath}: omit optional logo while the public package is text-only`);
    assert(isHttpsUrl(codexManifest?.homepage), `${codexManifestPath}: homepage must be https`);
    assert(isHttpsUrl(codexManifest?.repository), `${codexManifestPath}: repository must be https`);

    const claudeManifest = await readJson(claudeManifestPath);
    assert(claudeManifest?.name === product.name, `${claudeManifestPath}: name mismatch`);
    assert(/^\d+\.\d+\.\d+$/.test(claudeManifest?.version ?? ''), `${claudeManifestPath}: version must be strict semver`);
    assert(claudeManifest?.author?.name === 'Telemark Digital', `${claudeManifestPath}: author name mismatch`);

    const mcp = await readJson(mcpPath);
    const servers = mcp?.mcpServers ?? {};
    assert(Object.keys(servers).length === 1, `${mcpPath}: expected exactly one MCP server`);
    const server = servers[product.mcpServerName];
    assert(server?.type === 'http', `${mcpPath}: MCP server must use Streamable HTTP`);
    assert(server?.url === `https://mcp.apify.com?tools=${product.actorId}`, `${mcpPath}: MCP URL must pin exactly one Actor`);
    assert(!JSON.stringify(mcp).match(/headers|Authorization|token|command|args/i), `${mcpPath}: MCP config must not embed local commands, headers, or tokens`);

    const skill = await readText(skillPath);
    assert(skill.startsWith('---\n'), `${skillPath}: skill must start with YAML frontmatter`);
    assert(skill.includes(`name: ${product.name}`), `${skillPath}: frontmatter name mismatch`);
    assert(skill.includes(product.actorId), `${skillPath}: skill must name exact Actor ID`);
    assert(skill.includes('Apify charges'), `${skillPath}: skill must warn about Apify charges`);
    assert(skill.includes('persistent saved Apify Task'), `${skillPath}: skill must direct recurring use to saved Tasks`);
    assert(skill.includes('does not run in the background'), `${skillPath}: skill must not imply background monitoring`);
    assert(skill.includes(product.capText), `${skillPath}: skill must document saved Task cap`);
    assert(!/published\s+(?:n8n\s+or\s+)?Make\s+(?:workflow|blueprint|template)/i.test(skill), `${skillPath}: must not claim a published Make workflow, blueprint, or template`);
    assert(/published n8n workflow or the Make implementation package after it has been built and validated/i.test(skill), `${skillPath}: must distinguish published n8n from unsubmitted Make implementation packages`);
    assert(/Do not place webhook URLs, tokens/.test(skill), `${skillPath}: skill must ban webhook URLs and tokens in examples`);
    assertNoCredentialShape(skillPath, skill);
}

for (const relativePath of [
    '.agents/plugins/marketplace.json',
    '.claude-plugin/marketplace.json',
    'docs/ai-plugin-marketplaces.md',
]) {
    assertNoCredentialShape(relativePath, await readText(relativePath));
}

if (errors.length > 0) {
    console.error(`Plugin validation failed with ${errors.length} finding(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(`Plugin validation passed: ${products.length} plugins, one pinned Apify MCP Actor per plugin.`);
}

