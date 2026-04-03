import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Hash } from "lucide-react";
import { Layout } from "../components/layout";
import { SEOHead } from "../components/SEOHead";
import { FollowButton } from "../components/common";
import { useTags } from "../hooks/useApi";
import type { TagWithCategory } from "../lib/api";

// Maps category keys (from backend data) to i18n keys
const CATEGORY_I18N_KEYS: Record<string, string> = {
  talous: "topics.categories.economy",
  terveys: "topics.categories.health",
  koulutus: "topics.categories.education",
  ympäristö: "topics.categories.environment",
  liikenne: "topics.categories.transport",
  turvallisuus: "topics.categories.security",
  työ: "topics.categories.work",
  kulttuuri: "topics.categories.culture",
  eu: "topics.categories.eu",
  kunta: "topics.categories.municipal",
};

const CATEGORY_ORDER = [
  "talous",
  "terveys",
  "koulutus",
  "ympäristö",
  "liikenne",
  "turvallisuus",
  "työ",
  "kulttuuri",
  "eu",
  "kunta",
];

function groupByCategory(
  tags: TagWithCategory[],
): Record<string, TagWithCategory[]> {
  const groups: Record<string, TagWithCategory[]> = {};

  for (const tag of tags) {
    const category = tag.category || "muut";
    if (!groups[category]) groups[category] = [];
    groups[category].push(tag);
  }

  // Sort each group by sortOrder (embedded in data) and count
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  return groups;
}

export function TopicsPage() {
  const { t } = useTranslation(["agora", "common"]);
  const { data: tags, isLoading } = useTags();

  const grouped = tags ? groupByCategory(tags) : {};

  // Ordered categories
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead
        title="Aiheet"
        description="Selaa keskusteluaiheita Eulesia-alustalla. Talous, terveys, koulutus, ympäristö ja monta muuta aihealuetta."
        path="/aiheet"
      />
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-white dark:from-teal-950/30 dark:to-gray-950 px-4 py-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
            <Hash className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("agora:topics.title")}
          </h1>
        </div>
        <p className="text-gray-600">{t("agora:topics.subtitle")}</p>
      </div>

      {/* Categories */}
      <div className="px-4 py-4 space-y-6">
        {orderedCategories.map((category) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {CATEGORY_I18N_KEYS[category]
                ? t(CATEGORY_I18N_KEYS[category])
                : category}
            </h2>
            <div className="space-y-2">
              {grouped[category].map((tag) => (
                <div
                  key={tag.tag}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between"
                >
                  <Link
                    to={`/agora/tag/${encodeURIComponent(tag.tag)}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      <span className="font-medium text-gray-900">
                        {tag.displayName || tag.tag.replace(/-/g, " ")}
                      </span>
                      {tag.count > 0 && (
                        <span className="text-xs text-gray-400">
                          {tag.count}
                        </span>
                      )}
                    </div>
                    {tag.description && (
                      <p className="text-xs text-gray-500 mt-0.5 ml-6 line-clamp-1">
                        {tag.description}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <FollowButton
                      entityType="tag"
                      entityId={tag.tag}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Uncategorized tags (from thread usage, not in tagCategories) */}
        {grouped["muut"] &&
          grouped["muut"].length > 0 &&
          !orderedCategories.includes("muut") && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {t("agora:topics.otherTopics")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {grouped["muut"].map((tag) => (
                  <Link
                    key={tag.tag}
                    to={`/agora/tag/${encodeURIComponent(tag.tag)}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                  >
                    {tag.displayName || tag.tag.replace(/-/g, " ")}
                    {tag.count > 0 && (
                      <span className="text-xs text-gray-400">
                        ({tag.count})
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
      </div>
    </Layout>
  );
}
