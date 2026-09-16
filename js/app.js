"use strict";

  var root = document.getElementById("app");

  function render(){
    if(!state.profile){
      renderSetup();
      return;
    }
    if(!state.who){
      renderWhoAmI();
      return;
    }
    renderMain();
  }

  function subscribeAll(){
    if(state.unsubPersonal) state.unsubPersonal();
    if(state.unsubShared) state.unsubShared();
    if(state.unsubRecurringPersonal) state.unsubRecurringPersonal();
    if(state.unsubRecurringShared) state.unsubRecurringShared();
    state.unsubPersonal = Store.watchExpenses("personal", state.who, function(list){
      state.personalTx = list;
      if(state.who && state.tab!=="__loading__") render();
    });
    state.unsubShared = Store.watchExpenses("shared", null, function(list){
      state.sharedTx = list;
      if(state.who) render();
    });
    state.unsubRecurringPersonal = Store.watchRecurring("personal", state.who, function(list){
      state.recurringPersonal = list;
      if(recurringMgrState) renderRecurringManager();
      else if(state.who && !sheetState && !importState) render();
    });
    state.unsubRecurringShared = Store.watchRecurring("shared", null, function(list){
      state.recurringShared = list;
      if(recurringMgrState) renderRecurringManager();
      else if(state.who && !sheetState && !importState) render();
    });
  }

  // ---------------- boot ----------------
  async function boot(initData){
    loadLocal();

    if(window.claude && window.claude.use){
      try{ dbApi = await window.claude.use("db"); }catch(e){ dbApi = null; }
      try{ assetsApi = await window.claude.use("assets"); }catch(e){ assetsApi = null; }
      try{ sampleApi = await window.claude.use("sample"); }catch(e){ sampleApi = null; }
      if(sampleApi){
        try{ sampleImageLimits = (await sampleApi.limits()).images || null; }catch(e){ sampleImageLimits = null; }
      }
    }
    localMode = !dbApi;

    // debug-only stand-ins so the receipt-scan review screen can be designed/QA'd
    // without a live sample/assets grant — never active outside ?demo=1 local preview.
    if(localMode && location.search.indexOf("demo=1")>-1){
      sampleImageLimits = { maxCount:1, maxInputBytes:10000000, mediaTypes:["image/jpeg","image/png"] };
      sampleApi = {
        limits: async function(){ return { images: sampleImageLimits }; },
        json: async function(){
          await new Promise(function(r){ setTimeout(r, 500); });
          return { merchant:"サンプルスーパー", date: todayStr(), items:[
            {name:"卵 Mパック", price:248, category:"食費"},
            {name:"食パン", price:158, category:"食費"},
            {name:"ビール 6本", price:980, category:"食費"},
            {name:"洗剤", price:398, category:"日用品"},
            {name:"雑誌", price:690, category:"娯楽"}
          ]};
        }
      };
    }

    // optional local demo seed for design QA only (?demo=1), never used with a real db
    if(localMode && location.search.indexOf("demo=1")>-1 && !localData.profile){
      localData.profile = { personAName:"もも", personBName:"ゆう" };
      var d = new Date(); var ym = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      localData.expenses = [
        {id:uid(), scope:"personal", owner:"personA", category:"食費", amount:1280, memo:"コンビニ", date:ym+"-03"},
        {id:uid(), scope:"personal", owner:"personA", category:"娯楽", amount:3200, memo:"映画", date:ym+"-05"},
        {id:uid(), scope:"personal", owner:"personA", category:"日用品", amount:890, memo:"", date:ym+"-07"},
        {id:uid(), scope:"shared", paidBy:"personA", category:"住居費", amount:78000, memo:"家賃", date:ym+"-01", splitPercentA:50, settled:false},
        {id:uid(), scope:"shared", paidBy:"personB", category:"食費", amount:6400, memo:"スーパー", date:ym+"-04", splitPercentA:50, settled:false},
        {id:uid(), scope:"shared", paidBy:"personA", category:"光熱費", amount:9200, memo:"", date:ym+"-02", splitPercentA:60, settled:false}
      ];
      localData.recurring = [
        {id:uid(), scope:"personal", owner:"personA", category:"娯楽", amount:1490, name:"Netflix"},
        {id:uid(), scope:"shared", paidBy:"personA", category:"住居費", amount:78000, name:"家賃", splitPercentA:50},
        {id:uid(), scope:"shared", paidBy:"personB", category:"通信費", amount:5200, name:"インターネット", splitPercentA:50}
      ];
      saveLocal();
      try{ localStorage.setItem("kakeibo_who","personA"); }catch(e){}
    }

    state.profile = await Store.getProfile();
    applyPersonColors();
    Store.watchProfile(function(p){ state.profile = p; applyPersonColors(); if(!sheetState && !importState && !recurringMgrState) render(); });
    Store.watchMerchantMap(function(m){ state.merchantMap = m || {}; });

    try{ state.who = localStorage.getItem("kakeibo_who"); }catch(e){ state.who = null; }
    if(state.who && state.profile){ subscribeAll(); }

    render();
    return { who: state.who, tab: state.tab, monthCursor: state.monthCursor };
  }

  function start(initData){
    boot(initData);
  }

  if(window.claude && window.claude.hot){
    window.claude.hot.snapshot(function(){ return { who: state.who, tab: state.tab, monthCursor: state.monthCursor }; });
    window.claude.hot.ready ? window.claude.hot.ready(start) : start(window.claude.hot.data || {});
  } else {
    start({});
  }
