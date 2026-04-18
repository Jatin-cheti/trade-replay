import { getFilterIndex } from "../filterCache.service";
import {
  COUNTRY_OPTIONS,
  FILTER_CATEGORIES,
  INDEX_OPTIONS,
  SCREENER_COLUMN_FIELDS,
  SCREENER_FILTER_FIELDS,
  SCREENER_HEATMAP_TYPES,
  SCREENER_TABS,
  SCREENER_TYPES,
  SCREEN_MENU_OPTIONS,
  WATCHLIST_OPTIONS,
} from "./screener.constants";

export async function getScreenerMeta() {
  const filterIndex = await getFilterIndex();

  const sectors = filterIndex.sectors.map((sector) => ({ value: sector, label: sector }));
  const exchanges = filterIndex.exchanges.map((exchange) => ({ value: exchange, label: exchange }));

  const filterFields = SCREENER_FILTER_FIELDS.map((field) => {
    if (field.key === "sector") {
      return {
        ...field,
        options: sectors,
      };
    }

    if (field.key === "exchanges") {
      return {
        ...field,
        options: exchanges,
      };
    }

    return field;
  });

  return {
    screenerTypes: SCREENER_TYPES,
    heatmapTypes: SCREENER_HEATMAP_TYPES,
    tabs: SCREENER_TABS,
    filterCategories: FILTER_CATEGORIES,
    filterFields,
    columnFields: SCREENER_COLUMN_FIELDS,
    screenMenuOptions: SCREEN_MENU_OPTIONS,
    countries: COUNTRY_OPTIONS,
    indices: INDEX_OPTIONS,
    watchlists: WATCHLIST_OPTIONS,
    sectors,
    exchanges: filterIndex.exchanges,
  };
}

export async function getScreenerFilterOptions() {
  const filterIndex = await getFilterIndex();
  return {
    exchanges: filterIndex.exchanges,
    countries: filterIndex.countries,
    sectors: filterIndex.sectors,
  };
}

export async function getScreenerStats() {
  const filterIndex = await getFilterIndex();
  return {
    total: filterIndex.total,
    byType: filterIndex.byType,
    exchanges: filterIndex.exchanges,
    countries: filterIndex.countries,
    sectors: filterIndex.sectors,
  };
}
