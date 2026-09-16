"use strict";

  function computeCategoryBreakdown(list){
    var sums = {};
    list.forEach(function(e){ sums[e.category] = (sums[e.category]||0) + (e.amount||0); });
    var total = Object.values(sums).reduce(function(a,b){return a+b;},0);
    var rows = Object.keys(sums).map(function(k){ return {cat:k, amt:sums[k]}; });
    rows.sort(function(a,b){ return b.amt - a.amt; });
    return { rows:rows, total:total };
  }

  function renderCatList(rows, total){
    if(!rows.length) return '<div class="empty-note">この月の記録はまだありません。</div>';
    return '<div class="cat-list">' + rows.map(function(r){
      var pct = total>0 ? (r.amt/total*100) : 0;
      return '<div class="cat-row">' +
        '<span class="dot" style="background:'+catColor(r.cat)+'"></span>' +
        '<span class="cname">'+r.cat+'</span>' +
        '<span class="track"><span class="fill" style="width:'+pct.toFixed(1)+'%; background:'+catColor(r.cat)+'"></span></span>' +
        '<span class="camt num">'+fmtYen(r.amt)+'</span>' +
      '</div>';
    }).join("") + '</div>';
  }

  function openLightbox(assetId){
    var html = '<div class="lightbox" id="lightbox"><img src="/_blob/'+assetId+'" alt="レシート拡大"></div>';
    document.body.insertAdjacentHTML("beforeend", html);
    document.getElementById("lightbox").addEventListener("click", function(){ this.remove(); });
  }

  function renderRecurringCard(scope, monthList){
    var list = scope==="personal" ? state.recurringPersonal : state.recurringShared;
    if(!list.length) return "";
    var rows = list.map(function(item){
      var done = monthList.some(function(tx){ return tx.recurringId === item.id; });
      var sub = "";
      if(scope==="shared"){
        var sp = (typeof item.splitPercentA==="number") ? item.splitPercentA : 50;
        var splitLabel = sp===100 ? (personName("personA")+"全額") : sp===0 ? (personName("personB")+"全額") : ("按分 "+sp+"/"+(100-sp));
        sub = personName(item.paidBy)+"が支払い ・ "+splitLabel;
      }
      return '<div class="rec-row">' +
        '<span class="dot" style="background:'+catColor(item.category)+'"></span>' +
        '<span class="rec-info"><span class="rec-name">'+escapeHtml(item.name)+'</span>'+(sub?'<span class="rec-sub">'+sub+'</span>':'')+'</span>' +
        '<span class="rec-amt num">'+fmtYen(item.amount)+'</span>' +
        (done ? '<span class="chip settled">登録済み</span>' : '<button type="button" class="rec-add" data-addrecurring="'+item.id+'">追加する</button>') +
      '</div>';
    }).join("");
    return '<div class="card"><div class="label">今月の固定費</div><div class="rec-list">'+rows+'</div></div>';
  }
  function openSheetFromRecurring(item){
    openSheet(item.scope, {
      category: item.category,
      amount: String(item.amount),
      memo: item.name,
      paidBy: item.scope==="shared" ? item.paidBy : undefined,
      splitPercentA: item.scope==="shared" ? ((typeof item.splitPercentA==="number") ? item.splitPercentA : 50) : undefined,
      recurringId: item.id,
      recurringMonth: state.monthCursor
    });
  }

  function computeSettlement(){
    var unsettled = state.sharedTx.filter(function(e){ return !e.settled; });
    var netA = 0;
    unsettled.forEach(function(e){
      var sp = (typeof e.splitPercentA==="number") ? e.splitPercentA : 50;
      var shouldA = (e.amount||0) * sp/100;
      var paidA = e.paidBy==="personA" ? (e.amount||0) : 0;
      netA += (paidA - shouldA);
    });
    return { netA: netA, count: unsettled.length };
  }

  function renderMain(){
    var who = state.who;
    var otherWho = who==="personA" ? "personB" : "personA";

    var monthNav =
      '<div class="monthnav">' +
        '<button id="prevM">‹</button>' +
        '<span class="label">'+monthLabel(state.monthCursor)+'</span>' +
        '<button id="nextM">›</button>' +
      '</div>';

    var tabs =
      '<div class="tabs">' +
        '<button data-tab="personal" class="'+(state.tab==="personal"?"active":"")+'">個人</button>' +
        '<button data-tab="shared" class="'+(state.tab==="shared"?"active":"")+'">共有</button>' +
      '</div>';

    var sMonthAll = state.sharedTx.filter(function(e){ return inMonth(e.date, state.monthCursor); });

    var body = "";
    if(state.tab === "personal"){
      var pMonth = state.personalTx.filter(function(e){ return inMonth(e.date, state.monthCursor); });
      var pTotal = pMonth.reduce(function(a,e){ return a + (e.amount||0); }, 0);
      var brk = computeCategoryBreakdown(pMonth);
      var income = personIncome(who);
      var myShareShared = sMonthAll.reduce(function(sum,e){
        var sp = (typeof e.splitPercentA==="number") ? e.splitPercentA : 50;
        var mine = who==="personA" ? sp : (100-sp);
        return sum + (e.amount||0) * mine/100;
      }, 0);
      var remaining = income - pTotal - myShareShared;
      var incomeBlockHtml;
      if(state.editingIncome){
        incomeBlockHtml = '<div class="income-block"><div class="income-line"><span class="income-label">今月の収入</span></div><div class="income-edit-row"><input id="incomeInput" class="num" type="number" inputmode="numeric" value="'+(income||"")+'" placeholder="0"><button class="primary-btn" id="incomeSave" style="width:auto; padding:9px 16px;">保存</button></div></div>';
      } else {
        incomeBlockHtml = '<div class="income-block">' +
          '<div class="income-line"><span class="income-label">今月の収入</span><span><span class="num income-val">'+fmtYen(income)+'</span> <button class="link-btn" id="editIncomeBtn">編集</button></span></div>' +
          '<div class="remain-line'+(remaining<0?" negative":"")+'"><span class="income-label">残り（共有分の自分負担を含む）</span><span class="num">'+fmtYenSigned(remaining)+'</span></div>' +
        '</div>';
      }
      body =
        '<div class="card summary-card">' +
          '<div class="label">'+personName(who)+'さんの今月の支出</div>' +
          '<div class="total num">'+fmtYen(pTotal)+'</div>' +
          renderCatList(brk.rows, brk.total) +
          incomeBlockHtml +
        '</div>' +
        renderRecurringCard("personal", pMonth) +
        renderHistorySection(pMonth, "personal");
    } else {
      var sMonth = sMonthAll;
      var sTotal = sMonth.reduce(function(a,e){ return a + (e.amount||0); }, 0);
      var brkS = computeCategoryBreakdown(sMonth);
      var settle = computeSettlement();
      var settleSentence, settleAmt;
      if(Math.abs(settle.netA) < 1){
        settleSentence = "現在、精算の必要はありません";
        settleAmt = fmtYen(0);
      } else if(settle.netA > 0){
        settleSentence = personName("personB") + "さんが " + personName("personA") + "さんに支払う";
        settleAmt = fmtYen(settle.netA);
      } else {
        settleSentence = personName("personA") + "さんが " + personName("personB") + "さんに支払う";
        settleAmt = fmtYen(-settle.netA);
      }
      body =
        '<div class="card settle-card">' +
          '<div class="sentence">未精算 '+settle.count+'件</div>' +
          '<div class="amount-row">' +
            '<div><div class="sentence" style="margin-bottom:2px;">'+settleSentence+'</div><div class="total num">'+settleAmt+'</div></div>' +
            '<button class="settle-btn'+(state.settleConfirm?" confirm":"")+'" id="settleBtn" '+(settle.count===0?"disabled":"")+'>'+(state.settleConfirm?"本当に精算する":"精算する")+'</button>' +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="label">今月の共有支出合計</div>' +
          '<div class="total num small">'+fmtYen(sTotal)+'</div>' +
          renderCatList(brkS.rows, brkS.total) +
        '</div>' +
        renderRecurringCard("shared", sMonth) +
        renderHistorySection(sMonth, "shared");
    }

    root.innerHTML =
      '<div class="topbar">' +
        '<div class="brand"><span class="mark">'+ICON_WALLET+'</span><span class="name">ふたりの家計簿</span></div>' +
        '<div class="who-pill" id="whoPill"><span class="dot" style="background:'+personColorHex(who)+'">'+ICON_PERSON+'</span><strong>'+personName(who)+'</strong>として利用中</div>' +
      '</div>' +
      monthNav +
      tabs +
      '<div class="toolbar-row">' +
        (sampleApi && sampleImageLimits ? '<button class="link-btn" id="receiptScanBtn">レシートを読み取る</button>' : "") +
        '<button class="link-btn" id="recurringMgrBtn">固定費を管理</button>' +
        '<button class="link-btn" id="csvImportBtn">CSVから取り込む</button>' +
      '</div>' +
      body +
      '<button class="fab" id="fabAdd">＋</button>' +
      (localMode ? '<footer class="hint">ローカル保存モード — このブラウザのみに保存されます</footer>' : '');

    document.getElementById("prevM").addEventListener("click", function(){ state.monthCursor = shiftMonth(state.monthCursor,-1); state.trendMonth = null; render(); });
    document.getElementById("nextM").addEventListener("click", function(){ state.monthCursor = shiftMonth(state.monthCursor, 1); state.trendMonth = null; render(); });
    root.querySelectorAll("[data-tab]").forEach(function(b){
      b.addEventListener("click", function(){ state.tab = b.getAttribute("data-tab"); state.settleConfirm=false; render(); });
    });
    document.getElementById("whoPill").addEventListener("click", function(){
      state.who = null;
      try{ localStorage.removeItem("kakeibo_who"); }catch(e){}
      if(state.unsubPersonal) state.unsubPersonal();
      if(state.unsubShared) state.unsubShared();
      if(state.unsubRecurringPersonal) state.unsubRecurringPersonal();
      if(state.unsubRecurringShared) state.unsubRecurringShared();
      render();
    });
    document.getElementById("fabAdd").addEventListener("click", function(){ openSheet(state.tab); });
    document.getElementById("csvImportBtn").addEventListener("click", openImport);
    document.getElementById("recurringMgrBtn").addEventListener("click", openRecurringManager);
    var receiptBtn = document.getElementById("receiptScanBtn");
    if(receiptBtn) receiptBtn.addEventListener("click", openReceiptScan);

    var editIncomeBtn = document.getElementById("editIncomeBtn");
    if(editIncomeBtn) editIncomeBtn.addEventListener("click", function(){ state.editingIncome = true; render(); });
    var incomeSaveBtn = document.getElementById("incomeSave");
    if(incomeSaveBtn){
      incomeSaveBtn.addEventListener("click", async function(){
        var v = parseInt(document.getElementById("incomeInput").value, 10);
        if(isNaN(v) || v<0) v = 0;
        var patch = {};
        patch[who==="personA" ? "personAIncome" : "personBIncome"] = v;
        await Store.updateProfile(patch);
        state.editingIncome = false;
        render();
      });
    }

    root.querySelectorAll("[data-view]").forEach(function(b){
      b.addEventListener("click", function(){ state.viewMode = b.getAttribute("data-view"); state.selectedDay = null; state.trendMonth = null; render(); });
    });
    root.querySelectorAll("[data-trend-month]").forEach(function(b){
      b.addEventListener("click", function(){ state.trendMonth = parseInt(b.getAttribute("data-trend-month"),10); render(); });
    });
    root.querySelectorAll("[data-day]").forEach(function(b){
      b.addEventListener("click", function(){
        var d = b.getAttribute("data-day");
        state.selectedDay = (state.selectedDay===d) ? null : d;
        render();
      });
    });

    var settleBtn = document.getElementById("settleBtn");
    if(settleBtn){
      settleBtn.addEventListener("click", async function(){
        if(!state.settleConfirm){ state.settleConfirm = true; render(); return; }
        var unsettled = state.sharedTx.filter(function(e){ return !e.settled; });
        for(var i=0;i<unsettled.length;i++){
          await Store.updateExpense(unsettled[i].id, { settled:true, settledAt:new Date().toISOString() });
        }
        state.settleConfirm = false;
        render();
      });
    }

    root.querySelectorAll("[data-receipt]").forEach(function(img){
      img.addEventListener("click", function(){ openLightbox(img.getAttribute("data-receipt")); });
    });
    root.querySelectorAll("[data-addrecurring]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id = btn.getAttribute("data-addrecurring");
        var list = state.tab==="personal" ? state.recurringPersonal : state.recurringShared;
        var item = list.find(function(r){ return r.id===id; });
        if(item) openSheetFromRecurring(item);
      });
    });
    root.querySelectorAll("[data-del]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        var id = btn.getAttribute("data-del");
        if(state.deleteConfirmId !== id){
          state.deleteConfirmId = id;
          render();
          setTimeout(function(){ if(state.deleteConfirmId===id){ state.deleteConfirmId=null; render(); } }, 2500);
          return;
        }
        state.deleteConfirmId = null;
        await Store.deleteExpense(id);
      });
    });
  }

  // ---------------- add-expense sheet ----------------
