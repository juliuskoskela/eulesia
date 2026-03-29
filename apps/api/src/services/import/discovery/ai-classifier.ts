/**
 * AI Classifier
 *
 * Uses AI to identify which CMS/system a municipality website runs.
 * Called during discovery when heuristic detection fails.
 *
 * Classification is cheap: one short AI call per unknown site.
 * Results are cached in scraper_configs.system_type.
 */

import { callAi, parseAiJson } from "../adaptive/ai-provider.js";
import { analyzePage } from "../adaptive/page-analyzer.js";
import { getTemplate } from "../adaptive/templates.js";
import {
  generateFetcherConfig,
  testConfig,
} from "../adaptive/config-generator.js";
import { scraperDb, scraperConfigs } from "../../../db/scraper-db.js";
import { eq } from "drizzle-orm";

// Known systems that AI can classify into
const KNOWN_SYSTEMS = [
  "cloudnc",
  "dynasty",
  "tweb", // Finland
  "allris",
  "sessionnet",
  "sdnet", // Germany
  "volis",
  "delta", // Estonia
  "flexite",
  "sweden-generic", // Sweden
  "webdelib",
  "idelbes", // France
  "ibabs",
  "notubiz", // Netherlands
  "norway-generic",
  "denmark-generic", // Nordics
  "spain-generic",
  "italy-generic", // Southern Europe
  "portugal-generic",
  "poland-bip", // Other
  "czech-generic",
  "austria-generic", // Central Europe
];

export interface ClassificationResult {
  systemType: string; // Detected system or 'unknown'
  confidence: "high" | "medium" | "low";
  hasTemplate: boolean; // Whether a template exists for this system
  reasoning: string; // Short explanation
}

/**
 * Classify a municipality website's CMS/system using AI.
 */
export async function classifySystem(
  url: string,
): Promise<ClassificationResult> {
  // Step 1: Page analysis (also runs heuristic detection)
  const analysis = await analyzePage(url);

  if (!analysis || analysis.error) {
    return {
      systemType: "unknown",
      confidence: "low",
      hasTemplate: false,
      reasoning: `Could not analyze page: ${analysis?.error || "unreachable"}`,
    };
  }

  // Step 2: If heuristics detected it, no AI needed
  if (analysis.structure?.patterns.detectedSystem) {
    const detected = analysis.structure.patterns.detectedSystem;
    return {
      systemType: detected,
      confidence: "high",
      hasTemplate: !!getTemplate(detected),
      reasoning: `Detected by heuristics (HTML fingerprint)`,
    };
  }

  // Step 3: AI classification
  const systemPrompt = `You are a municipal website CMS classification expert. Given a web page's structure and content, identify which content management system or meeting minutes platform the municipality uses.

Known systems:
${KNOWN_SYSTEMS.map((s) => `- ${s}`).join("\n")}

If the site doesn't match any known system, respond with "unknown".

Respond with a JSON object:
{
  "systemType": "detected_system_name",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of why this system was identified"
}

Classification signals:
- URL patterns (e.g., /bi/si010.asp → ALLRIS, DREQUEST.PHP → Dynasty)
- HTML meta tags and generator tags
- CSS class names and JavaScript frameworks
- Page structure and navigation patterns
- Keywords and language patterns`;

  const structureInfo = analysis.structure
    ? `
Title: ${analysis.structure.title}
Language: ${analysis.structure.lang}
Links: ${analysis.structure.linkCount} total, ${analysis.structure.pdfLinks.length} PDFs
Tables: ${analysis.structure.tableCount}, Forms: ${analysis.structure.formCount}
Date format: ${analysis.structure.patterns.detectedDateFormat || "none"}
Meeting keywords: ${analysis.structure.patterns.hasMeetingKeywords}
Protocol keywords: ${analysis.structure.patterns.hasProtocolKeywords}

Sample links:
${analysis.structure.sampleLinks
  .slice(0, 15)
  .map((l) => `  "${l.text}" → ${l.href}`)
  .join("\n")}
`
    : "No structure data available";

  const userPrompt = `Classify this municipal website:
URL: ${url}

${structureInfo}

Page HTML (cleaned, first ~8000 chars):
${analysis.cleanedHtml}

What CMS/system does this municipality use? Return ONLY the JSON object.`;

  try {
    const response = await callAi(
      "classification",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.1,
        maxTokens: 500,
        jsonMode: true,
      },
    );

    const result = parseAiJson<{
      systemType: string;
      confidence: string;
      reasoning: string;
    }>(response);

    const systemType = KNOWN_SYSTEMS.includes(result.systemType)
      ? result.systemType
      : "unknown";
    const confidence = (
      ["high", "medium", "low"].includes(result.confidence)
        ? result.confidence
        : "low"
    ) as ClassificationResult["confidence"];

    return {
      systemType,
      confidence,
      hasTemplate: !!getTemplate(systemType),
      reasoning: result.reasoning || "AI classification",
    };
  } catch (err) {
    return {
      systemType: "unknown",
      confidence: "low",
      hasTemplate: false,
      reasoning: `AI classification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Classify and configure a pending scraper config.
 *
 * For configs with status='pending' and no system_type:
 * 1. Classify the system type
 * 2. If a template exists → apply it
 * 3. If unknown → AI generates config
 * 4. Test the config
 * 5. Update status to 'active' or leave as 'pending'
 */
export async function classifyAndConfigure(configId: string): Promise<{
  classified: boolean;
  systemType: string;
  configured: boolean;
  tested: boolean;
  error?: string;
}> {
  const [config] = await scraperDb
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.id, configId))
    .limit(1);

  if (!config) {
    return {
      classified: false,
      systemType: "unknown",
      configured: false,
      tested: false,
      error: "Config not found",
    };
  }

  // Step 1: Classify
  console.log(
    `   [classifier] Classifying ${config.municipalityName} (${config.baseUrl})...`,
  );
  const classification = await classifySystem(config.baseUrl);

  console.log(
    `   [classifier] Result: ${classification.systemType} (${classification.confidence}) — ${classification.reasoning}`,
  );

  // Update system type
  await scraperDb
    .update(scraperConfigs)
    .set({
      systemType: classification.systemType,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, configId));

  // Step 2: Get or generate config
  if (classification.hasTemplate) {
    const template = getTemplate(classification.systemType)!;

    // Test the template
    const test = await testConfig(config.baseUrl, template);

    if (test.success) {
      await scraperDb
        .update(scraperConfigs)
        .set({
          config: template as unknown as Record<string, unknown>,
          configGeneratedBy: `template:${classification.systemType}`,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(scraperConfigs.id, configId));

      console.log(
        `   [classifier] Configured with template: ${classification.systemType} (${test.meetingCount} meetings)`,
      );
      return {
        classified: true,
        systemType: classification.systemType,
        configured: true,
        tested: true,
      };
    }

    console.log(`   [classifier] Template test failed: ${test.error}`);
  }

  // Step 3: AI generation for unknown or failed template
  try {
    const result = await generateFetcherConfig(
      config.baseUrl,
      config.country,
      classification.systemType !== "unknown"
        ? classification.systemType
        : undefined,
    );

    if (result.success && result.config) {
      // Test the AI-generated config
      const test = await testConfig(config.baseUrl, result.config);

      if (test.success) {
        await scraperDb
          .update(scraperConfigs)
          .set({
            config: result.config as unknown as Record<string, unknown>,
            configGeneratedBy: `ai:${result.generatedBy}`,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(scraperConfigs.id, configId));

        console.log(
          `   [classifier] Configured with AI (${test.meetingCount} meetings)`,
        );
        return {
          classified: true,
          systemType: classification.systemType,
          configured: true,
          tested: true,
        };
      }

      // AI config generated but test failed — save config but keep pending
      await scraperDb
        .update(scraperConfigs)
        .set({
          config: result.config as unknown as Record<string, unknown>,
          configGeneratedBy: `ai:${result.generatedBy}:untested`,
          updatedAt: new Date(),
        })
        .where(eq(scraperConfigs.id, configId));

      return {
        classified: true,
        systemType: classification.systemType,
        configured: true,
        tested: false,
        error: `Config generated but test failed: ${test.error}`,
      };
    }

    return {
      classified: true,
      systemType: classification.systemType,
      configured: false,
      tested: false,
      error: result.error,
    };
  } catch (err) {
    return {
      classified: true,
      systemType: classification.systemType,
      configured: false,
      tested: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Process all pending configs (classify + configure).
 * Useful as a batch job after discovery.
 */
export async function processPendingConfigs(options?: {
  limit?: number;
}): Promise<{
  processed: number;
  activated: number;
  errors: string[];
}> {
  const pending = await scraperDb
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.status, "pending"))
    .limit(options?.limit || 20);

  console.log(
    `   [classifier] Processing ${pending.length} pending configs...`,
  );

  let activated = 0;
  const errors: string[] = [];

  for (const config of pending) {
    try {
      const result = await classifyAndConfigure(config.id);
      if (result.configured && result.tested) {
        activated++;
      }
      if (result.error) {
        errors.push(`${config.municipalityName}: ${result.error}`);
      }
    } catch (err) {
      errors.push(
        `${config.municipalityName}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `   [classifier] Done: ${activated}/${pending.length} activated, ${errors.length} errors`,
  );
  return { processed: pending.length, activated, errors };
}
