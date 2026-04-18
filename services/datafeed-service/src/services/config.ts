const SUPPORTED_RESOLUTIONS = ["1", "3", "5", "15", "30", "60", "120", "240", "D", "W", "M"];

export function getConfig() {
  return {
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    supports_search: true,
    supports_group_request: false,
    supports_marks: true,
    supports_timescale_marks: true,
    supports_time: true,
    exchanges: [
      { value: "NSE", name: "NSE India", desc: "National Stock Exchange of India" },
      { value: "BSE", name: "BSE India", desc: "Bombay Stock Exchange" },
      { value: "NASDAQ", name: "NASDAQ", desc: "NASDAQ US" },
      { value: "NYSE", name: "NYSE", desc: "New York Stock Exchange" },
      { value: "BINANCE", name: "Binance", desc: "Binance Crypto Exchange" },
    ],
    symbols_types: [
      { name: "All", value: "" },
      { name: "Stocks", value: "stock" },
      { name: "Crypto", value: "crypto" },
      { name: "Forex", value: "forex" },
      { name: "Index", value: "index" },
    ],
  };
}

export { SUPPORTED_RESOLUTIONS };
