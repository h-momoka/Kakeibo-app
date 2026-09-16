"use strict";

  function txRowHtml(e, opts){
    opts = opts || {};
    var isDelConfirm = state.deleteConfirmId === e.id;
    var metaChips = "";
    if(opts.mode==="shared"){
      var payer = e.paidBy==="personA" ? "a" : "b";
      metaChips += '<span class="chip '+payer+'">'+personName(e.paidBy)+'が支払い</span>';
      var sp = (typeof e.splitPercentA==="number") ? e.splitPercentA : 50;
      if(sp===100) metaChips += '<span class="chip">'+personName("personA")+'全額負担</span>';
      else if(sp===0) metaChips += '<span class="chip">'+personName("personB")+'全額負担</span>';
      else metaChips += '<span class="chip">按分 '+sp+' / '+(100-sp)+'</span>';
      if(e.settled) metaChips += '<span class="chip settled">精算済み</span>';
    }
    return '<div class="tx" data-id="'+e.id+'">' +
      (e.receiptAssetId ?
        '<img class="receipt-thumb" data-receipt="'+e.receiptAssetId+'" src="/_blob/'+e.receiptAssetId+'" alt="レシート">' :
        '<span class="cdot" style="background:'+catColor(e.category)+'">'+ (e.category||"其").charAt(0) +'</span>') +
      '<span class="mid">' +
        '<span class="cat">'+(e.category||"未分類")+'</span>' +
        (e.memo ? '<div class="memo">'+escapeHtml(e.memo)+'</div>' : '') +
        (metaChips ? '<div class="meta">'+metaChips+'</div>' : '') +
      '</span>' +
      '<span class="right">' +
        '<span class="amt num">'+fmtYen(e.amount)+'</span>' +
        '<span class="date">'+(e.date||"").slice(5)+'</span>' +
      '</span>' +
      '<button class="del'+(isDelConfirm?' confirm':'')+'" data-del="'+e.id+'">'+(isDelConfirm?"削除？":"✕")+'</button>' +
    '</div>';
  }
  function renderTrendChart(mode){
    var months = lastNMonths(state.monthCursor, 3);
    var source = mode==="personal" ? state.personalTx : state.sharedTx;
    var lastIdx = months.length - 1;

    // per-category totals for each of the 3 months
    var catSeries = CATS.map(function(c){
      var vals = months.map(function(m){
        return source.filter(function(e){ return e.category===c.k && inMonth(e.date, m); })
          .reduce(function(a,e){ return a + (e.amount||0); }, 0);
      });
      return { k:c.k, c:c.c, vals:vals };
    }).filter(function(s){ return s.vals.some(function(v){ return v>0; }); });

    if(!catSeries.length){
      return '<div class="card trend-card"><div class="label">直近3か月の比較</div><div class="empty-note">まだ記録がありません。</div></div>';
    }

    var maxV = Math.max.apply(null, catSeries.map(function(s){ return Math.max.apply(null,s.vals); }).concat([1]));
    // round the axis ceiling up to a clean step
    var niceMax = (function(){
      var steps = [1000,2000,5000,10000,20000,50000,100000,200000,500000,1000000,2000000,5000000];
      for(var i=0;i<steps.length;i++){ if(steps[i] >= maxV*1.05) return steps[i]; }
      return Math.ceil(maxV*1.05/100000)*100000;
    })();

    var W = 320, H = 168, padL = 40, padR = 10, padT = 10, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var xAt = function(i){ return padL + (months.length===1 ? plotW/2 : (plotW * i / (months.length-1))); };
    var yAt = function(v){ return padT + plotH - (niceMax>0 ? (v/niceMax)*plotH : 0); };

    var activeIdx = (state.trendMonth===null || state.trendMonth>lastIdx) ? lastIdx : state.trendMonth;

    // gridlines + y ticks at 0%, 50%, 100%
    var gridSteps = [0, 0.5, 1];
    var grid = gridSteps.map(function(f){
      var y = padT + plotH * (1-f);
      var val = niceMax * f;
      return '<line class="trend-gridline" x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'"></line>' +
        '<text class="trend-tick" x="'+(padL-6)+'" y="'+(y+3)+'" text-anchor="end">'+fmtYenCompact(val)+'</text>';
    }).join("");

    // crosshair for the active column
    var cx = xAt(activeIdx);
    var crosshair = '<line class="trend-crosshair" x1="'+cx+'" y1="'+padT+'" x2="'+cx+'" y2="'+(padT+plotH)+'"></line>';

    // one polyline + endpoint dots per active category
    var lines = catSeries.map(function(s){
      var pts = s.vals.map(function(v,i){ return xAt(i)+","+yAt(v); }).join(" ");
      var dots = s.vals.map(function(v,i){
        var r = (i===activeIdx) ? 4.5 : 3;
        return '<circle class="trend-dot" cx="'+xAt(i)+'" cy="'+yAt(v)+'" r="'+r+'" style="fill:'+s.c+'"></circle>';
      }).join("");
      return '<polyline class="trend-line" points="'+pts+'" style="stroke:'+s.c+'"></polyline>' + dots;
    }).join("");

    // x-axis month labels + click/tap hit bands (one per month column)
    var colW = months.length>1 ? plotW/(months.length-1) : plotW;
    var xlabels = months.map(function(m,i){
      var label = parseInt(m.split("-")[1],10) + "月";
      return '<text class="trend-xlabel'+(i===activeIdx?" current":"")+'" x="'+xAt(i)+'" y="'+(H-6)+'" text-anchor="middle">'+label+'</text>';
    }).join("");
    var hits = months.map(function(m,i){
      var bx = padL + colW*(i-0.5);
      if(i===0) bx = padL - 4;
      var bw = colW;
      if(i===0 || i===lastIdx) bw = colW/2 + 4;
      return '<g class="trend-hit'+(i===activeIdx?" active":"")+'" data-trend-month="'+i+'">' +
        '<rect class="trend-hit-band" x="'+bx+'" y="'+padT+'" width="'+bw+'" height="'+plotH+'"></rect>' +
        '<rect class="trend-hit" x="'+bx+'" y="0" width="'+bw+'" height="'+H+'"></rect>' +
      '</g>';
    }).join("");

    var svg = '<svg class="trend-chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">' +
      grid + crosshair + lines + hits + xlabels +
    '</svg>';

    var legend = '<div class="trend-legend">' + catSeries.map(function(s){
      return '<div class="trend-legend-item"><span class="dot" style="background:'+s.c+'"></span>'+s.k+'</div>';
    }).join("") + '</div>';

    var activeMonth = months[activeIdx];
    var monthLabelText = parseInt(activeMonth.split("-")[1],10) + "月";
    var detailList = source.filter(function(e){ return inMonth(e.date, activeMonth); });
    var breakdown = computeCategoryBreakdown(detailList);
    var detail = '<div class="trend-detail">' +
      '<div class="section-title">'+monthLabelText+'の内訳</div>' +
      renderCatList(breakdown.rows, breakdown.total) +
    '</div>';

    return '<div class="card trend-card"><div class="label">直近3か月の比較（カテゴリ別）</div>' + svg + legend + detail + '</div>';
  }
  function renderHistorySection(monthList, mode){
    var toggle =
      '<div class="section-title-row">' +
        '<div class="section-title">履歴</div>' +
        '<div class="view-toggle">' +
          '<button type="button" data-view="calendar" class="'+(state.viewMode==="calendar"?"on":"")+'">カレンダー</button>' +
          '<button type="button" data-view="list" class="'+(state.viewMode==="list"?"on":"")+'">リスト</button>' +
        '</div>' +
      '</div>';
    var content = state.viewMode==="list" ? (renderTrendChart(mode) + txListHtml(monthList, mode)) : calendarHtml(monthList, mode);
    return toggle + content;
  }
  function txListHtml(monthList, mode){
    return '<div class="tx-list">' + (monthList.length ? monthList.map(function(e){ return txRowHtml(e,{mode:mode}); }).join("") : '<div class="empty-note">まだ記録がありません。右下の + から追加してください。</div>') + '</div>';
  }
  function calendarHtml(monthList, mode){
    var byDay = {};
    monthList.forEach(function(e){ byDay[e.date] = (byDay[e.date]||0) + (e.amount||0); });
    var parts = state.monthCursor.split("-");
    var year = parseInt(parts[0],10), monIdx = parseInt(parts[1],10)-1;
    var firstDow = new Date(year, monIdx, 1).getDay();
    var daysInMonth = new Date(year, monIdx+1, 0).getDate();
    var todayS = todayStr();
    var dowLabels = ["日","月","火","水","木","金","土"];
    var cells = dowLabels.map(function(d){ return '<div class="cal-dow">'+d+'</div>'; }).join("");
    for(var i=0;i<firstDow;i++) cells += '<div class="cal-cell empty"></div>';
    for(var day=1; day<=daysInMonth; day++){
      var ds = state.monthCursor + "-" + pad2(day);
      var amt = byDay[ds] || 0;
      cells += '<div class="cal-cell'+(amt>0?" has":"")+(ds===todayS?" today":"")+(state.selectedDay===ds?" selected":"")+'" data-day="'+ds+'">' +
        '<span class="d">'+day+'</span>' +
        (amt>0 ? '<span class="a num">'+fmtYenCompact(amt)+'</span>' : '') +
      '</div>';
    }
    var dayList = "";
    if(state.selectedDay){
      var dayTx = monthList.filter(function(e){ return e.date === state.selectedDay; });
      var dLabel = parseInt(state.selectedDay.slice(5,7),10) + "月" + parseInt(state.selectedDay.slice(8,10),10) + "日";
      dayList = '<div class="section-title" style="margin-top:16px;">'+dLabel+'の内訳</div>' +
        txListHtml(dayTx, mode);
    }
    return '<div class="card"><div class="cal-grid">'+cells+'</div></div>' + dayList;
  }

