import { run } from "uebersicht"

export const command =
  "cat /Users/karolgrochulski/Development/scraper/output/transfers.json"

// Refresh every 5 min
export const refreshFrequency = 5 * 60 * 1000

// Persisted filter state — survives data refreshes
export const initialState = {
  statusFilter: "all",
  countryFilter: "all",
  countryOpen: false,
  __output: null,
  __error: null,
}

export const updateState = (event, prev) => {
  if (event == null) return prev

  // Catch Übersicht's command result and stash it in state, regardless of event.type
  if (event.output !== undefined || event.error !== undefined) {
    return { ...prev, __output: event.output, __error: event.error }
  }

  switch (event.type) {
    case "SET_STATUS":     return { ...prev, statusFilter:  event.value }
    case "SET_COUNTRY":    return { ...prev, countryFilter: event.value, countryOpen: false }
    case "TOGGLE_COUNTRY": return { ...prev, countryOpen: !prev.countryOpen }
    case "CLOSE_COUNTRY":  return { ...prev, countryOpen: false }
    default: return prev
  }
}

export const className = `
  top: 5px;
  right: 10px;
  width: 300px;
  max-height: 60vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  font-size: 11px;
  color: #e8e8ea;
  background: rgba(58, 58, 58, 0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  padding: 14px 16px;

  h1 {
    font-size: 13px;
    font-weight: 560;
    letter-spacing: 0.1px;
    text-transform: ;
    margin: 0 0 8px 95px;
    color: #fff;
  }

  /* Status pills */
  .pills {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
  }
  .pill {
    flex: 1;
    font-size: 10px;
    padding: 4px 0;
    border-radius: 5px;
    background: rgba(255,255,255,0.10);
    color: #d8dadf;
    text-align: center;
    cursor: pointer;
    border: 1px solid transparent;
    user-select: none;
  }
  .pill:hover { background: rgba(255,255,255,0.16); }
  .pill.active {
    background: rgba(108, 160, 255, 0.28);
    border-color: rgba(108, 160, 255, 0.6);
    color: #fff;
    font-weight: 600;
  }

  /* Custom country dropdown */
  .country {
    position: relative;
    margin-bottom: 8px;
  }
  .country-button {
    width: 100%;
    font-size: 10px;
    padding: 5px 8px;
    border-radius: 5px;
    background: rgba(255,255,255,0.10);
    border: 1px solid rgba(255,255,255,0.18);
    color: #fff;
    cursor: pointer;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: inherit;
    user-select: none;
  }
  .country-button:hover { background: rgba(255,255,255,0.16); }
  .country-button .chev { opacity: 0.6; font-size: 9px; margin-left: 6px; }

  .country-menu {
    position: absolute;
    top: calc(100% + 3px);
    left: 0;
    right: 0;
    background: rgba(28, 30, 38, 0.96);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 6px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    padding: 4px 0;
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  }
  .country-menu::-webkit-scrollbar { width: 4px; }
  .country-menu::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.20);
    border-radius: 2px;
  }
  .country-option {
    padding: 5px 10px;
    font-size: 10px;
    color: #e8e8ea;
    cursor: pointer;
    user-select: none;
  }
  .country-option:hover { background: rgba(108, 160, 255, 0.22); }
  .country-option.active { background: rgba(108, 160, 255, 0.32); color: #fff; }

  .meta {
    font-size: 10px;
    color: #9aa0aa;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
  }

  .list {
    max-height: calc(60vh - 170px);
    overflow-y: auto;
    padding-right: 4px;
  }
  .list::-webkit-scrollbar { width: 4px; }
  .list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 2px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    padding: 7px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .row:last-child { border-bottom: none; }

  .player {
    font-weight: 600;
    color: #fff;
    font-size: 12px;
  }
  .player a {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  .player a:hover {
    color: #6ca0ff;
    text-decoration: underline;
  }

  .badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 4px;
    align-self: center;
    white-space: nowrap;
  }
  .badge.done   { background: rgba(52, 199, 89, 0.18);  color: #6ce088; }
  .badge.rumor  { background: rgba(255, 159, 10, 0.18); color: #ffba5c; }

  .move {
    grid-column: 1 / -1;
    color: #c4c8d0;
    font-size: 11px;
  }
  .arrow { color: #8a8f99; margin: 0 5px; }

  .details {
    grid-column: 1 / -1;
    color: #8a8f99;
    font-size: 10px;
  }

  .league { color: #6ca0ff; }

  .empty {
    color: #9aa0aa;
    font-size: 11px;
    padding: 12px 0;
    text-align: center;
  }

  .error {
    color: #ff7b7b;
    font-size: 11px;
  }
`

// Pull nationality
const playerCountry = (t) => {
  const m = /from\s+(.+?)\s*$/.exec(t.Details || "")
  return m ? m[1].trim() : ""
}

export const render = (state, dispatch) => {
  state = state || {}
  dispatch = dispatch || (() => {})

  const output = state.__output
  const error  = state.__error

  if (error) {
    return (
      <div className="error">
        Übersicht command error: {String(error)}
      </div>
    )
  }

  // show loading
  if (output == null || String(output).trim() === "") {
    return <div style={{ color: "#9aa0aa", fontSize: "11px" }}>Loading…</div>
  }

  let data
  try {
    data = JSON.parse(output)
  } catch (e) {
    return (
      <div className="error" style={{ whiteSpace: "pre-wrap" }}>
        Couldn't parse transfers.json:{"\n"}{String(e.message || e)}{"\n\n"}
        {String(output).slice(0, 500)}
      </div>
    )
  }

  const transfers = Array.isArray(data.transfers) ? data.transfers : []

  const statusFilter  = (state && state.statusFilter)  || "all"
  const countryFilter = (state && state.countryFilter) || "all"
  const countryOpen   = !!(state && state.countryOpen)


  const countrySet = new Set()
  transfers.forEach(t => {
    if (t.League) countrySet.add(t.League)
    const c = playerCountry(t)
    if (c) countrySet.add(c)
  })
  const countries = Array.from(countrySet).sort()

  // both filters
  
  const filtered = transfers.filter(t => {
    const isDone = (t.Status || "").toLowerCase().includes("done")
    if (statusFilter === "confirmed" && !isDone) return false
    if (statusFilter === "rumor"     &&  isDone) return false
    if (countryFilter !== "all") {
      if (t.League !== countryFilter && playerCountry(t) !== countryFilter) return false
    }
    return true
  })

  let updatedLabel = data.updated || ""
  try {
    const d = new Date(data.updated)
    if (!isNaN(d)) {
      updatedLabel = d.toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    }
  } catch (_) {}

  const statusOptions = [
    { key: "all",       label: "All"       },
    { key: "confirmed", label: "Confirmed" },
    { key: "rumor",     label: "Rumors"    },
  ]

  return (
    <div>
      <h1>Today's Transfers</h1>

      <div className="pills">
        {statusOptions.map(opt => (
          <div
            key={opt.key}
            className={"pill" + (statusFilter === opt.key ? " active" : "")}
            onClick={() => dispatch({ type: "SET_STATUS", value: opt.key })}
          >
            {opt.label}
          </div>
        ))}
      </div>

      <div className="country">
        <div
          className="country-button"
          onClick={() => dispatch({ type: "TOGGLE_COUNTRY" })}
        >
          <span>{countryFilter === "all" ? "All countries" : countryFilter}</span>
          <span className="chev">{countryOpen ? "▲" : "▼"}</span>
        </div>
        {countryOpen && (
          <div className="country-menu">
            <div
              className={"country-option" + (countryFilter === "all" ? " active" : "")}
              onClick={() => dispatch({ type: "SET_COUNTRY", value: "all" })}
            >
              All countries
            </div>
            {countries.map(c => (
              <div
                key={c}
                className={"country-option" + (countryFilter === c ? " active" : "")}
                onClick={() => dispatch({ type: "SET_COUNTRY", value: c })}
              >
                {c}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="meta">
        <span>{filtered.length} of {transfers.length}</span>
        <span>updated {updatedLabel}</span>
      </div>

      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">No matches</div>
        ) : filtered.map((t, i) => {
          const isDone = (t.Status || "").toLowerCase().includes("done")
          return (
            <div className="row" key={i}>
              <div className="player">
                {t.PlayerUrl ? (
                  <a
                    href={t.PlayerUrl}
                    onClick={(e) => {
                      e.preventDefault()
                      run("open " + JSON.stringify(t.PlayerUrl))
                    }}
                  >{t.Player}</a>
                ) : t.Player}
              </div>
              <div className={"badge " + (isDone ? "done" : "rumor")}>
                {isDone ? "Confirmed" : t.Status}
              </div>
              <div className="move">
                {t.Team_from}
                <span className="arrow">→</span>
                {t.Team_to}
              </div>
              <div className="details">
                <span className="league">{t.League}</span>
                {t.Details ? " · " + t.Details : ""}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
