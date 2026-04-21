import { useState } from "react";
import type { DateRangeFilterValue, ParsedFilters, RangeFilterValue, ScreenerFilterField, ScreenerMetaResponse, ScreenerOption } from "@/lib/screener";
import { RANGE_PRESETS, DATE_PRESETS, ANALYST_RATING_OPTIONS, SECTOR_OPTIONS } from "@/lib/screener/filterPresets";
import CountryFilterEditor from "./CountryFilterEditor";
import IndexFilterEditor from "./IndexFilterEditor";
import WatchlistFilterEditor from "./WatchlistFilterEditor";
import MultiSelectEditor from "./MultiSelectEditor";
import { RangeEditor, DateRangeEditor, ToggleEditor } from "./RangeEditors";

export default function FilterEditorSwitch({
  field, parsedFilters, meta, setMultiFilter, setRangeFilter, setDateFilter, setToggleFilter,
}: {
  field: ScreenerFilterField;
  parsedFilters: ParsedFilters;
  meta: ScreenerMetaResponse | null;
  setMultiFilter: (key: string, values: string[]) => void;
  setRangeFilter: (key: string, value?: RangeFilterValue) => void;
  setDateFilter: (key: string, value?: DateRangeFilterValue) => void;
  setToggleFilter: (key: string, value: boolean) => void;
}) {
  const [changeInterval, setChangeInterval] = useState("1D");

  if (field.inputType === "multiselect") {
    const selected = (parsedFilters[field.key] as string[] | undefined) || [];
    if (field.key === "marketCountries") {
      return <CountryFilterEditor selected={selected} onChange={(next) => setMultiFilter(field.key, next)} primaryOnly={parsedFilters.primaryListingOnly === true} onPrimaryChange={(next) => setToggleFilter("primaryListingOnly", next)} />;
    }
    if (field.key === "indices") return <IndexFilterEditor selected={selected} onChange={(next) => setMultiFilter(field.key, next)} />;
    if (field.key === "watchlists") return <WatchlistFilterEditor selected={selected} onChange={(next) => setMultiFilter(field.key, next)} watchlists={meta?.watchlists || []} />;

    let options: ScreenerOption[] = field.options || [];
    if (!options.length && field.key === "analystRating") options = ANALYST_RATING_OPTIONS;
    if (!options.length && field.key === "sector") options = (meta?.sectors && meta.sectors.length ? meta.sectors : SECTOR_OPTIONS);
    return <MultiSelectEditor options={options} selected={selected} onChange={(next) => setMultiFilter(field.key, next)} />;
  }
  if (field.inputType === "range") {
    const presets = RANGE_PRESETS[field.key];
    const isChangePercent = field.key === "changePercent";
    return (
      <RangeEditor
        value={parsedFilters[field.key] as RangeFilterValue | undefined}
        onChange={(next) => setRangeFilter(field.key, next)}
        presets={presets}
        intervals={isChangePercent ? ["1D", "1W", "1M", "YTD"] : undefined}
        activeInterval={isChangePercent ? changeInterval : undefined}
        onIntervalChange={isChangePercent ? setChangeInterval : undefined}
      />
    );
  }
  if (field.inputType === "date-range") {
    const presets = DATE_PRESETS[field.key];
    return (
      <DateRangeEditor
        value={parsedFilters[field.key] as DateRangeFilterValue | undefined}
        onChange={(next) => setDateFilter(field.key, next)}
        presets={presets}
      />
    );
  }
  return <ToggleEditor value={parsedFilters[field.key] === true} onChange={(next) => setToggleFilter(field.key, next)} />;
}
