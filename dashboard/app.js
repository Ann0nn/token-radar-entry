// Token Radar — the dashboard. It renders window.RADAR, which main.ts wrote
// from the sealed snapshot. No network: the page, its data and its styles are
// all local files.
//
// THE MODEL, AS THE PAGE SHOWS IT
//   implied value = TVL x BASE x GROWTH x MATURITY
//   BASE     the median market-cap-to-TVL ratio of the snapshot's own
//            token-trading protocols with $50M+ of TVL (52 protocols,
//            median 0.082 on this snapshot). Computed from the snapshot at
//            build time, never hardcoded; the "Already trading" section below
//            the board lists the protocols it was measured over.
//   GROWTH   1 + 0.5 x the 7-day TVL change, clamped to [-50%, +200%], so a
//            protocol halving in a week scores 0.75 and one tripling 2.0.
//   MATURITY 1.0 at listing, rising to 1.25 at two years with no token.
// Every row's detail view shows its own three multipliers beside the value,
// so the number is never a black box. Rows the snapshot's watchlist names
// carry a WATCHLIST badge; the board also ranks 161 pre-token protocols
// below the watchlist's $50M floor, which is the early discovery the radar
// exists for. Exchanges, bridges and wrapped or staked products are set
// aside by the model (see lib/model.ts): they record no token because they
// are not protocols that issue one.

(function () {
  'use strict';

  var RADAR = window.RADAR;
  if (!RADAR || !Array.isArray(RADAR.rows)) {
    document.getElementById('rows').innerHTML =
      '<tr><td colspan="6">No radar data loaded. Run main.ts to write data.js beside this page.</td></tr>';
    return;
  }

  var rows = RADAR.rows;
  var state = { query: '', category: 'all', chain: 'all', watchlistOnly: false, sort: 'rank', selected: null };

  function $(id) { return document.getElementById(id); }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** $2.75B, $265.4M, $5.0M — compact dollars, one decimal when it matters. */
  function money(value) {
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(value);
  }

  function fullMoney(value) {
    return '$' + value.toLocaleString('en-US');
  }

  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30.4) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  function changeCell(pct) {
    if (pct === null || pct === undefined) return '<span class="flat">—</span>';
    var cls = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
    var sign = pct > 0 ? '+' : '';
    return '<span class="' + cls + '">' + sign + pct.toFixed(1) + '%</span>';
  }

  function formatMultiple(x) {
    return x.toFixed(3);
  }

  /* ---- header stats and the model strip ---- */

  $('stats').innerHTML =
    stat(money(RADAR.total_implied_usd), 'total implied value') +
    stat(String(RADAR.board_size), 'protocols ranked') +
    stat(String(RADAR.watchlist_size), 'on the watchlist') +
    stat(formatMultiple(RADAR.base_multiple), 'base multiple (median)');

  function stat(value, label) {
    return '<div class="stat"><b>' + escapeHtml(value) + '</b><span>' + escapeHtml(label) + '</span></div>';
  }

  $('base-multiple').textContent = formatMultiple(RADAR.base_multiple);
  $('base-multiple-text').textContent = formatMultiple(RADAR.base_multiple);
  $('live-count').textContent = String(RADAR.base_measured_over);

  /* ---- filter controls ---- */

  var categories = [];
  var chains = [];
  rows.forEach(function (row) {
    if (row.category && categories.indexOf(row.category) === -1) categories.push(row.category);
    row.chains.forEach(function (chain) {
      if (chains.indexOf(chain) === -1) chains.push(chain);
    });
  });
  categories.sort();
  chains.sort();

  $('category').innerHTML = '<option value="all">All categories</option>' +
    categories.map(function (c) {
      return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');
  $('chain').innerHTML = '<option value="all">All chains</option>' +
    chains.map(function (c) {
      return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');

  $('search').addEventListener('input', function (e) {
    state.query = e.target.value.trim().toLowerCase();
    renderBoard();
  });
  $('category').addEventListener('change', function (e) {
    state.category = e.target.value;
    renderBoard();
  });
  $('chain').addEventListener('change', function (e) {
    state.chain = e.target.value;
    renderBoard();
  });
  $('watchlist-only').addEventListener('change', function (e) {
    state.watchlistOnly = e.target.checked;
    renderBoard();
  });
  $('sort').addEventListener('change', function (e) {
    state.sort = e.target.value;
    renderBoard();
  });

  /* ---- the board ---- */

  function filteredRows() {
    var out = rows.filter(function (row) {
      if (state.watchlistOnly && !row.on_watchlist) return false;
      if (state.category !== 'all' && row.category !== state.category) return false;
      if (state.chain !== 'all' && row.chains.indexOf(state.chain) === -1) return false;
      if (state.query) {
        var hay = (row.name + ' ' + row.slug + ' ' + (row.category || '')).toLowerCase();
        if (hay.indexOf(state.query) === -1) return false;
      }
      return true;
    });
    if (state.sort === 'tvl') out.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (state.sort === 'growth') out.sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); });
    else if (state.sort === 'age') out.sort(function (a, b) { return (b.age_days || 0) - (a.age_days || 0); });
    else out.sort(function (a, b) { return a.rank - b.rank; });
    return out;
  }

  function rowHtml(row) {
    var selected = state.selected === row.slug ? ' class="selected"' : '';
    return '<tr data-slug="' + escapeHtml(row.slug) + '"' + selected + '>' +
      '<td class="num rank">' + row.rank + '</td>' +
      '<td><span class="name">' + escapeHtml(row.name) + '</span>' +
      (row.on_watchlist ? '<span class="watch-dot">● watchlist</span>' : '') +
      '<span class="sub">' + escapeHtml(row.category || 'Uncategorised') + ' · ' +
      escapeHtml(row.chains.slice(0, 3).join(', ')) + (row.chains.length > 3 ? ' +' + (row.chains.length - 3) : '') + '</span></td>' +
      '<td class="num">' + money(row.tvl_usd) + '</td>' +
      '<td class="num">' + changeCell(row.change_7d) + '</td>' +
      '<td class="num">' + ageText(row.age_days) + '</td>' +
      '<td class="num value">' + money(row.implied_value_usd) + '</td>' +
      '</tr>';
  }

  function renderBoard() {
    var list = filteredRows();
    $('rows').innerHTML = list.map(rowHtml).join('');
    $('count').textContent = list.length === rows.length
      ? rows.length + ' protocols — every rankable pre-token protocol in the snapshot.'
      : list.length + ' of ' + rows.length + ' protocols match.';
    var body = $('rows');
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () { select(tr.getAttribute('data-slug')); });
    });
  }

  /* ---- the detail view ---- */

  function select(slug) {
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].slug === slug) { row = rows[i]; break; }
    }
    if (!row) return;
    state.selected = slug;
    renderBoard();
    var panel = $('detail');
    panel.classList.remove('hidden');
    var steps = row.farm_steps.map(function (step) {
      return '<li>' + escapeHtml(step) + '</li>';
    }).join('');
    panel.innerHTML =
      '<div class="detail-card">' +
      '<button class="close-detail" id="close-detail" type="button">Close ×</button>' +
      '<h2>' + escapeHtml(row.name) +
      (row.on_watchlist ? '<span class="watch-badge">Watchlist</span>' : '') + '</h2>' +
      '<p class="detail-meta">Rank #' + row.rank + ' · ' + escapeHtml(row.category || 'Uncategorised') +
      ' · ' + escapeHtml(row.chains.join(', ')) +
      ' · records no token · snapshot 14 Nov 2026</p>' +
      '<div class="detail-grid">' +
      stat(fullMoney(row.implied_value_usd), 'implied value') +
      stat(money(row.tvl_usd), 'total value locked') +
      stat(row.change_7d === null ? '—' : (row.change_7d > 0 ? '+' : '') + row.change_7d.toFixed(1) + '%', 'TVL, last 7 days') +
      stat(ageText(row.age_days), 'tracked since') +
      '</div>' +
      '<div class="breakdown">How the value was scored: ' +
      '<code>' + money(row.tvl_usd) + ' TVL × ' + formatMultiple(row.model.base_multiple) +
      ' base × ' + row.model.growth_multiplier.toFixed(3) + ' growth × ' +
      row.model.maturity_multiplier.toFixed(3) + ' maturity = ' +
      fullMoney(row.implied_value_usd) + '</code></div>' +
      '<h3>Farm plan — how to position for a token, if one ever comes</h3>' +
      '<ol>' + steps + '</ol>' +
      '</div>';
    $('close-detail').addEventListener('click', function () {
      state.selected = null;
      panel.classList.add('hidden');
      panel.innerHTML = '';
      renderBoard();
    });
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---- the live yardstick ---- */

  $('live-rows').innerHTML = RADAR.live.map(function (live) {
    return '<tr><td><span class="name">' + escapeHtml(live.name) + '</span>' +
      '<span class="sub">' + escapeHtml(live.category || 'Uncategorised') + '</span></td>' +
      '<td class="num">' + money(live.tvl_usd) + '</td>' +
      '<td class="num">' + money(live.mcap_usd) + '</td>' +
      '<td class="num">' + formatMultiple(live.multiple) + '×</td></tr>';
  }).join('');

  /* ---- deep links: #detail=<slug>, #category=<name>, #watchlist=1 ---- */

  function applyHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    hash.split('&').forEach(function (part) {
      var kv = part.split('=');
      var key = decodeURIComponent(kv[0] || '');
      var value = decodeURIComponent(kv[1] || '');
      if (key === 'category' && categories.indexOf(value) !== -1) {
        state.category = value;
        $('category').value = value;
      } else if (key === 'chain' && chains.indexOf(value) !== -1) {
        state.chain = value;
        $('chain').value = value;
      } else if (key === 'watchlist' && value === '1') {
        state.watchlistOnly = true;
        $('watchlist-only').checked = true;
      } else if (key === 'detail' && value) {
        state.selected = value;
      }
    });
  }

  applyHash();
  renderBoard();
  if (state.selected) select(state.selected);
})();
