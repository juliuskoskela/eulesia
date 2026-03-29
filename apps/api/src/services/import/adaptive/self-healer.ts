/**
 * Self-Healer
 *
 * Automatically repairs broken scraper configurations.
 *
 * When a config reaches 5+ consecutive failures (marked 'failing'):
 * 1. Re-fetch the page and re-analyze structure
 * 2. If page is gone (404/DNS) → disable config
 * 3. If structure changed → AI generates new config
 * 4. Test new config → at least 1 meeting found = success
 * 5. Save new version (config_version++) and archive old one
 * 6. After 3 failed heal attempts → permanently disable
 */

import {
  scraperDb,
  scraperConfigs,
  configHistory,
  healthEvents,
} from "../../../db/scraper-db.js";
import { eq } from "drizzle-orm";
import { analyzePage } from "./page-analyzer.js";
import { getTemplate } from "./templates.js";
import { validateFetcherConfig, type FetcherConfig } from "./config-schema.js";
import { callAi, parseAiJson } from "./ai-provider.js";
import { getFailingConfigs, recordHealed } from "./health-monitor.js";
import { testConfig } from "./config-generator.js";

export interface HealResult {
  configId: string;
  municipality: string;
  action: "healed" | "disabled" | "failed";
  reason: string;
  newVersion?: number;
}

/**
 * Run self-healing for all failing configs.
 */
export async function runSelfHealing(): Promise<HealResult[]> {
  const failing = await getFailingConfigs();

  if (failing.length === 0) {
    console.log("   [self-healer] No failing configs to heal");
    return [];
  }

  console.log(
    `   [self-healer] Attempting to heal ${failing.length} failing configs...`,
  );
  const results: HealResult[] = [];

  for (const config of failing) {
    try {
      const result = await healConfig(config);
      results.push(result);
      console.log(
        `   [self-healer] ${config.municipalityName}: ${result.action} — ${result.reason}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        configId: config.id,
        municipality: config.municipalityName,
        action: "failed",
        reason: msg,
      });
      console.log(
        `   [self-healer] ${config.municipalityName}: error — ${msg}`,
      );
    }
  }

  return results;
}

/**
 * Attempt to heal a single failing config.
 */
async function healConfig(
  config: typeof scraperConfigs.$inferSelect,
): Promise<HealResult> {
  const { id, municipalityName, baseUrl, country, systemType, configVersion } =
    config;

  // Step 1: Re-analyze the page
  console.log(`   [self-healer] Analyzing ${baseUrl}...`);
  const analysis = await analyzePage(baseUrl);

  // Step 2: Page is unreachable → disable
  if (!analysis || analysis.status === 0) {
    await disableConfig(id, "Page unreachable (network error)");
    return {
      configId: id,
      municipality: municipalityName,
      action: "disabled",
      reason: "Page unreachable",
    };
  }

  if (analysis.status === 404 || analysis.status === 410) {
    await disableConfig(id, `HTTP ${analysis.status}: page removed`);
    return {
      configId: id,
      municipality: municipalityName,
      action: "disabled",
      reason: `HTTP ${analysis.status}`,
    };
  }

  if (analysis.status >= 500) {
    // Server error — don't disable yet, might be temporary
    return {
      configId: id,
      municipality: municipalityName,
      action: "failed",
      reason: `Server error HTTP ${analysis.status}`,
    };
  }

  // Step 3: Page is reachable — try to generate a new config

  // First: if heuristics detect a known system, try template
  let newConfig: FetcherConfig | null = null;
  let generatedBy = "template";

  if (analysis.structure?.patterns.detectedSystem) {
    const detected = analysis.structure.patterns.detectedSystem;
    const template = getTemplate(detected);
    if (template) {
      newConfig = template;
      generatedBy = `template:${detected}`;
      console.log(
        `   [self-healer] Detected system: ${detected}, using template`,
      );
    }
  }

  // If no template matched, use AI
  if (!newConfig) {
    console.log(`   [self-healer] Using AI to regenerate config...`);
    try {
      newConfig = await regenerateConfigWithAi(
        baseUrl,
        country,
        config.config as FetcherConfig,
        analysis,
      );
      generatedBy = "ai-self-heal";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        configId: id,
        municipality: municipalityName,
        action: "failed",
        reason: `AI generation failed: ${msg}`,
      };
    }
  }

  // Step 4: Test the new config
  console.log(`   [self-healer] Testing new config...`);
  const testResult = await testConfig(baseUrl, newConfig);

  if (!testResult.success) {
    // Increment heal attempts in the failing state
    await scraperDb.insert(healthEvents).values({
      configId: id,
      eventType: "failure",
      details: `Self-heal test failed: ${testResult.error}`,
    });

    return {
      configId: id,
      municipality: municipalityName,
      action: "failed",
      reason: `New config test failed: ${testResult.error}`,
    };
  }

  // Step 5: Success — archive old config and update
  const newVersion = configVersion + 1;

  // Archive the old config
  await scraperDb.insert(configHistory).values({
    configId: id,
    version: configVersion,
    config: config.config,
    generatedBy: config.configGeneratedBy,
    reason: "self-heal",
  });

  // Update with new config
  await scraperDb
    .update(scraperConfigs)
    .set({
      config: newConfig as unknown as Record<string, unknown>,
      configVersion: newVersion,
      configGeneratedBy: generatedBy,
      systemType: analysis.structure?.patterns.detectedSystem || systemType,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, id));

  // Mark as healed (resets failures, increments healAttempts)
  await recordHealed(id);

  console.log(
    `   [self-healer] Healed ${municipalityName}: v${configVersion} → v${newVersion} (${testResult.meetingCount} meetings found)`,
  );

  return {
    configId: id,
    municipality: municipalityName,
    action: "healed",
    reason: `Updated to v${newVersion} by ${generatedBy}, ${testResult.meetingCount} meetings found`,
    newVersion,
  };
}

/**
 * Disable a config permanently.
 */
async function disableConfig(configId: string, reason: string): Promise<void> {
  await scraperDb
    .update(scraperConfigs)
    .set({
      status: "disabled",
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, configId));

  await scraperDb.insert(healthEvents).values({
    configId,
    eventType: "disabled",
    details: reason,
  });
}

/**
 * Use AI to regenerate a config, providing the old config for context.
 */
async function regenerateConfigWithAi(
  baseUrl: string,
  country: string,
  oldConfig: FetcherConfig,
  analysis: NonNullable<Awaited<ReturnType<typeof analyzePage>>>,
): Promise<FetcherConfig> {
  const structureHints = analysis.structure
    ? `
Page structure:
- Title: ${analysis.structure.title}
- Language: ${analysis.structure.lang}
- Links: ${analysis.structure.linkCount} total, ${analysis.structure.pdfLinks.length} PDFs
- Tables: ${analysis.structure.tableCount}, Forms: ${analysis.structure.formCount}
- Date format detected: ${analysis.structure.patterns.detectedDateFormat || "none"}
- Meeting keywords found: ${analysis.structure.patterns.hasMeetingKeywords}
- Protocol keywords found: ${analysis.structure.patterns.hasProtocolKeywords}

Sample links:
${analysis.structure.sampleLinks
  .slice(0, 10)
  .map((l) => `  - "${l.text}" → ${l.href}`)
  .join("\n")}

PDF links:
${analysis.structure.pdfLinks
  .slice(0, 5)
  .map((l) => `  - ${l}`)
  .join("\n")}
`
    : "";

  const systemPrompt = `You are a web scraping self-repair expert. A scraper configuration has been failing and you need to generate a corrected version.

You will receive:
1. The old (broken) configuration that was working before
2. The current page HTML
3. Structural analysis of the page

Your task: analyze what changed on the page and generate an updated FetcherConfig JSON.

Common reasons for breakage:
- URL path changed (e.g. /meetings → /sessions)
- HTML structure changed (different class names, tag hierarchy)
- New link format (different query parameters)
- Site migration to new CMS/platform

Output must be a valid JSON object matching the FetcherConfig schema. Return ONLY the JSON object, no explanation.`;

  const userPrompt = `The scraper for ${baseUrl} (country: ${country}) has been failing. Please generate a corrected FetcherConfig.

Previous (broken) config:
${JSON.stringify(oldConfig, null, 2)}

${structureHints}

Current page HTML (cleaned):
${analysis.cleanedHtml}

Generate an updated FetcherConfig JSON that works with the current page structure. Return ONLY the JSON object.`;

  const response = await callAi(
    "self-healing",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.1,
      maxTokens: 4000,
      jsonMode: true,
    },
  );

  const parsed = parseAiJson<unknown>(response);
  const validation = validateFetcherConfig(parsed);

  if (!validation.success) {
    throw new Error(
      `AI-generated config validation failed: ${validation.errors.join(", ")}`,
    );
  }

  return validation.data;
}
