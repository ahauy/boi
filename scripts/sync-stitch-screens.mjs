#!/usr/bin/env node
/**
 * Sync all 16 Stitch Screens from PalmSight Terminal Landing Page project
 * to local cache in docs/stitch-screens/ for zero-token, instant offline inspection.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'stitch-screens');

const STITCH_ENDPOINT = 'https://stitch.googleapis.com/mcp';
const PROJECT_ID = '15464591816682045618';

async function getApiKey() {
  if (process.env.STITCH_API_KEY) return process.env.STITCH_API_KEY;
  try {
    const configPath = path.join(ROOT_DIR, '.agents', 'mcp_config.json');
    const content = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(content);
    return config.mcpServers?.stitch?.headers?.['X-Goog-Api-Key'] || '';
  } catch {
    return '';
  }
}

async function callStitchMcp(methodName, args) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('STITCH_API_KEY not found in process.env or .agents/mcp_config.json');
  }

  const response = await fetch(STITCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: methodName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Stitch MCP HTTP error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(`Stitch RPC error: ${JSON.stringify(json.error)}`);
  }

  const textContent = json.result?.content?.[0]?.text;
  if (!textContent) {
    return json.result;
  }

  try {
    return JSON.parse(textContent);
  } catch {
    return textContent;
  }
}

function sanitizeSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log(`[Stitch Sync] Connecting to Stitch MCP for project ${PROJECT_ID}...`);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const listRes = await callStitchMcp('list_screens', { projectId: PROJECT_ID });
  const screens = listRes.screens || [];
  console.log(`[Stitch Sync] Found ${screens.length} screens in project.`);

  const catalog = [];

  for (let i = 0; i < screens.length; i++) {
    const screenSummary = screens[i];
    const screenName = screenSummary.name;
    const screenId = screenName.split('/').pop();
    const title = screenSummary.title || `screen-${screenId}`;
    const slug = `${String(i + 1).padStart(2, '0')}-${sanitizeSlug(title)}`;
    const screenDir = path.join(OUTPUT_DIR, slug);

    console.log(`[${i + 1}/${screens.length}] Fetching ${title} (${screenId})...`);
    await fs.mkdir(screenDir, { recursive: true });

    const fullScreen = await callStitchMcp('get_screen', { name: screenName });

    let screenshotFile = null;
    if (fullScreen.screenshot?.downloadUrl) {
      try {
        const imgRes = await fetch(fullScreen.screenshot.downloadUrl);
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          screenshotFile = 'screenshot.png';
          await fs.writeFile(path.join(screenDir, screenshotFile), imgBuffer);
        }
      } catch (err) {
        console.warn(`  - Warning: Failed to download screenshot for ${title}:`, err.message);
      }
    }

    let htmlFile = null;
    if (fullScreen.htmlCode?.downloadUrl) {
      try {
        const htmlRes = await fetch(fullScreen.htmlCode.downloadUrl);
        if (htmlRes.ok) {
          const htmlText = await htmlRes.text();
          htmlFile = 'screen.html';
          await fs.writeFile(path.join(screenDir, htmlFile), htmlText, 'utf8');
        }
      } catch (err) {
        console.warn(`  - Warning: Failed to download HTML for ${title}:`, err.message);
      }
    }

    catalog.push({
      index: i + 1,
      title,
      screenId,
      slug,
      screenshotFile,
      htmlFile,
    });
  }

  // Generate catalog README.md
  let catalogMd = `# 📱 PalmSight Stitch Screens Cache\n\n`;
  catalogMd += `> **Source:** Stitch MCP Project \`PalmSight Terminal Landing Page\` (\`${PROJECT_ID}\`)\n`;
  catalogMd += `> **Last Synced:** ${new Date().toISOString()}\n`;
  catalogMd += `> **Purpose:** Local zero-token, zero-latency visual reference for all subagents.\n\n`;
  catalogMd += `| # | Màn hình | Screen ID | Screenshot | HTML Mockup |\n`;
  catalogMd += `| :---: | :--- | :--- | :---: | :---: |\n`;

  for (const item of catalog) {
    const imgLink = item.screenshotFile ? `[Ảnh](./${item.slug}/${item.screenshotFile})` : '—';
    const htmlLink = item.htmlFile ? `[HTML](./${item.slug}/${item.htmlFile})` : '—';
    catalogMd += `| ${item.index} | **${item.title}** | \`${item.screenId}\` | ${imgLink} | ${htmlLink} |\n`;
  }

  await fs.writeFile(path.join(OUTPUT_DIR, 'README.md'), catalogMd, 'utf8');
  console.log(`[Stitch Sync] Successfully synced ${screens.length} screens to ${OUTPUT_DIR}/README.md!`);
}

main().catch((err) => {
  console.error('[Stitch Sync Error]:', err);
  process.exit(1);
});
