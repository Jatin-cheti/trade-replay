import type { DateRangeFilterValue, ParsedFilters, RangeFilterValue, ScreenerFilterField, ScreenerMetaResponse } from "@/lib/screener";
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
  if (field.inputType === "multiselect") {
    const selected = (parsedFilters[field.key] as string[] | undefined) || [];
    if (field.key === "marketCountries") {
      return <CountryFilterEditor selected={selected} onChange={(next) => setMultiFilter(field.key, next)} primaryOnly={parsedFilters.primaryListingOnly === true} onPrimaryChange={(next) => setToggleFilter("primaryListingOnly", next)} />;
    }
    if (field.key === "indices") return <IndexFilterEditor selected={selected} onChange={(next) => setMultiFilter(field.key, next)} />;
    if (field.key === "watchlists") return <WatchlistFilterEditor selected={selected} onChange={(next) => setMultiFilter(field.key, next)} watchlists={meta?.watchlists || []} />;
    return <MultiSelectEditor options={field.options || []} selected={selected} onChange={(next) => setMultiFilter(field.key, next)} />;
  }
  if (field.inputType === "range") return <RangeEditor value={parsedFilters[field.key] as RangeFilterValue | undefined} onChange={(next) => setRangeFilter(field.key, next)} />;
  if (field.inputType === "date-range") return <DateRangeEditor value={parsedFilters[field.key] as DateRangeFilterValue | undefined} onChange={(next) => setDateFilter(field.key, next)} />;
  return <ToggleEditor value={parsedFilters[field.key] === true} onChange={(next) => setToggleFilter(field.key, next)} />;
}
