"use strict";


  // Small inline-SVG glyphs used in place of emoji/kanji-initial placeholders,
  // so the brand mark and person avatars render as crisp vector icons that
  // pick up the surrounding element's `color` (via currentColor / stroke).
  var ICON_WALLET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 7.2A2.2 2.2 0 0 1 6.2 5H17a1 1 0 0 1 1 1v2"/>' +
    '<path d="M4 7.2v10.3A2.5 2.5 0 0 0 6.5 20H18a1 1 0 0 0 1-1v-3.3"/>' +
    '<rect x="13.2" y="10.8" width="6.8" height="5" rx="1.3"/>' +
    '<circle cx="15.9" cy="13.3" r="0.65" fill="currentColor" stroke="none"/>' +
  '</svg>';
  var ICON_PERSON = '<svg viewBox="0 0 24 24" fill="currentColor">' +
    '<circle cx="12" cy="8.2" r="4"/>' +
    '<path d="M4.2 20c0-4.6 3.6-7.4 7.8-7.4s7.8 2.8 7.8 7.4a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1z"/>' +
  '</svg>';

  // Palette validated with the data-viz skill's validate_palette.js (mode
  // light, surface #FFFFFF): lightness band / chroma floor / adjacent-pair
  // CVD separation (worst 10.3 ΔE, protan) / normal-vision floor (worst 16.2
  // ΔE) all PASS; only contrast on 交通費's amber WARNs (2.86:1), acceptable
  // since color always ships paired with the category's text label here.
  // (A separate palette re-stepped for the dark alternate theme's surface
  // lives in DARK_CATS_C below, applied when data-theme="dark".)
  var CATS = [
    {k:"食費", c:"#159A6E"},
    {k:"日用品", c:"#6740C2"},
    {k:"住居費", c:"#A6661C"},
    {k:"光熱費", c:"#12876F"},
    {k:"通信費", c:"#C93F27"},
    {k:"交通費", c:"#D6871D"},
    {k:"交際費", c:"#98449E"},
    {k:"娯楽", c:"#B14F1E"},
    {k:"医療", c:"#35629E"},
    {k:"衣服・美容", c:"#71861D"},
    {k:"教育", c:"#A03A68"},
    {k:"その他", c:"#2C7FC4"}
  ];
  var DARK_CATS_C = ["#C65D2B","#4381D2","#D9462D","#2A85CF","#C35484","#758C0C","#8660EC","#009969","#B056B7","#BB6A00","#009A79","#B86B00"];
  if(typeof document !== "undefined" && document.documentElement.getAttribute("data-theme")==="dark"){
    CATS.forEach(function(c,i){ c.c = DARK_CATS_C[i]; });
  }
  function catColor(name){ var f=CATS.find(function(c){return c.k===name;}); return f?f.c:"#8A8D99"; }

  var PERSON_COLOR = { personA:"var(--accent-a)", personB:"var(--accent-b)" };
  var DEFAULT_PERSON_COLOR = { personA:"#184B6C", personB:"#63390F" };

  // ---- small color helpers for the user-customizable name colors ----
  function hex2rgb(hex){
    hex = String(hex||"").replace("#","");
    if(hex.length===3) hex = hex.split("").map(function(c){return c+c;}).join("");
    var n = parseInt(hex,16) || 0;
    return [(n>>16)&255, (n>>8)&255, n&255];
  }
  function rgb2hex(r,g,b){
    return "#" + [r,g,b].map(function(v){
      v = Math.max(0, Math.min(255, Math.round(v)));
      var h = v.toString(16);
      return h.length===1 ? "0"+h : h;
    }).join("").toUpperCase();
  }
  function mixHex(hexA, hexB, t){
    var a = hex2rgb(hexA), b = hex2rgb(hexB);
    return rgb2hex(a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t);
  }
  function hex2hsl(hex){
    var rgb = hex2rgb(hex).map(function(v){ return v/255; });
    var r=rgb[0], g=rgb[1], b=rgb[2];
    var max=Math.max(r,g,b), min=Math.min(r,g,b), h, s, l=(max+min)/2;
    if(max===min){ h=0; s=0; }
    else {
      var d = max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      if(max===r) h = (g-b)/d + (g<b?6:0);
      else if(max===g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h/=6;
    }
    return [h*360, s, l];
  }
  function hsl2hex(h,s,l){
    h = ((h%360)+360)%360/360;
    var r,g,b;
    if(s===0){ r=g=b=l; }
    else {
      var q = l<0.5 ? l*(1+s) : l+s-l*s;
      var p = 2*l-q;
      var hue2rgb = function(p,q,t){
        if(t<0) t+=1; if(t>1) t-=1;
        if(t<1/6) return p+(q-p)*6*t;
        if(t<1/2) return q;
        if(t<2/3) return p+(q-p)*(2/3-t)*6;
        return p;
      };
      r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3);
    }
    return rgb2hex(r*255, g*255, b*255);
  }
  // From one user-picked hex (the flat swatch shown at registration, used
  // as-is for the name's solid dot/badge), derive a text-safe variant for
  // each theme's surface: a deeper, more saturated step for the light
  // surface and a brighter step for the dark one — same relationship as
  // this app's own default accent pairs — plus each one's very tinted
  // "soft" background.
  function deriveAccentVars(baseHex){
    var hsl = hex2hsl(baseHex);
    var h = hsl[0], s = Math.max(hsl[1], 0.35);
    var lightVariant = hsl2hex(h, Math.min(s, 0.75), 0.38);
    var darkVariant = hsl2hex(h, Math.min(s*1.05, 0.85), 0.68);
    return {
      light: lightVariant,
      lightSoft: mixHex(lightVariant, "#FFFFFF", 0.86),
      dark: darkVariant,
      darkSoft: mixHex(darkVariant, "#000000", 0.78)
    };
  }
  function personColorHex(who){
    var p = state.profile || {};
    return (p[who+"Color"]) || DEFAULT_PERSON_COLOR[who];
  }
  // Push the profile's custom name colors (if any) onto the page as CSS
  // custom properties; the stylesheet's var(--accent-a-custom, #default)
  // falls back to the built-in palette when nothing custom is set, and the
  // dark-mode blocks reference the separate *-custom-dark properties so the
  // right variant applies automatically under prefers-color-scheme.
  function applyPersonColors(){
    var p = state.profile || {};
    ["personA","personB"].forEach(function(who){
      var slot = who==="personA" ? "a" : "b";
      var custom = p[who+"Color"];
      var st = document.documentElement.style;
      if(custom){
        var d = deriveAccentVars(custom);
        st.setProperty("--accent-"+slot+"-custom", d.light);
        st.setProperty("--accent-"+slot+"-soft-custom", d.lightSoft);
        st.setProperty("--accent-"+slot+"-custom-dark", d.dark);
        st.setProperty("--accent-"+slot+"-soft-custom-dark", d.darkSoft);
      } else {
        st.removeProperty("--accent-"+slot+"-custom");
        st.removeProperty("--accent-"+slot+"-soft-custom");
        st.removeProperty("--accent-"+slot+"-custom-dark");
        st.removeProperty("--accent-"+slot+"-soft-custom-dark");
      }
    });
  }

  // built-in merchant keyword -> category guesses (used when no learned mapping exists yet)
  var MERCHANT_KEYWORDS = {
    "食費": ["セブン-イレブン","セブンイレブン","ファミリーマート","ローソン","イオン","西友","ライフ","マルエツ","成城石井","スーパー","カフェ","スターバックス","ドトール","マクドナルド","吉野家","すき家","松屋","餃子の王将","ケンタッキー","モスバーガー","デリバリー","出前館","Uber Eats"],
    "日用品": ["ドラッグ","マツモトキヨシ","ウエルシア","ダイソー","無印良品","ホームセンター","コーナン","カインズ","ニトリ"],
    "住居費": ["家賃","不動産","管理費","賃貸"],
    "光熱費": ["電力","でんき","ガス","東京電力","東京ガス","関西電力","中部電力","水道局"],
    "通信費": ["ドコモ","NTT","ソフトバンク","au ","楽天モバイル","携帯","インターネット","プロバイダ","Wi-Fi"],
    "交通費": ["ENEOS","出光","JR","メトロ","地下鉄","タクシー","ガソリン","Suica","PASMO","高速道路","駐車場"],
    "交際費": ["飲み会","居酒屋"],
    "娯楽": ["Netflix","Spotify","Amazonプライム","DAZN","映画","カラオケ","Steam","App Store","Google Play"],
    "医療": ["薬局","医院","クリニック","病院","歯科"],
    "衣服・美容": ["ユニクロ","GU ","美容室","ZOZO","理容","サロン"],
    "教育": ["書店","紀伊国屋","スクール","学費","予備校"]
  };
  function guessCategory(memoText, merchantMap){
    var text = (memoText||"");
    if(merchantMap){
      for(var key in merchantMap){
        if(key && text.indexOf(key) > -1) return merchantMap[key];
      }
    }
    for(var cat in MERCHANT_KEYWORDS){
      var kws = MERCHANT_KEYWORDS[cat];
      for(var i=0;i<kws.length;i++){
        if(text.indexOf(kws[i]) > -1) return cat;
      }
    }
    return null;
  }

  // ---------------- storage facade ----------------
  // Three possible backends, tried in this order by boot() in app.js:
  //  1. "artifact"  — running inside a Claude Artifact preview (window.claude.use),
  //                   unchanged from the original single-file version.
  //  2. "demo"      — ?demo=1 local design-QA preview, localStorage only, no login.
  //  3. "backend"   — the real public app: a Node/Express + PostgreSQL server
  //                   reached over fetch(), with a signed-in household account.
  var dbApi = null;
  var assetsApi = null;
  var sampleApi = null;
  var sampleImageLimits = null;
  var localMode = false;     // true for "demo" (kept for the existing localMode banners/checks)
  var authMode = false;      // true for "backend"
  var sessionUser = null;    // {id, email, personKey, household:{id, inviteCode}} once signed in
  var LOCAL_KEY = "kakeibo_local_v1";
  var localData = { profile: null, expenses: [], merchantMap: {}, recurring: [] };
  var localListeners = [];
  var localMapListeners = [];
  var localRecurringListeners = [];

  function loadLocal(){
    try{
      var raw = localStorage.getItem(LOCAL_KEY);
      localData = raw ? JSON.parse(raw) : { profile:null, expenses:[], merchantMap:{}, recurring:[] };
      if(!localData.merchantMap) localData.merchantMap = {};
      if(!localData.recurring) localData.recurring = [];
    }catch(e){ localData = { profile:null, expenses:[], merchantMap:{}, recurring:[] }; }
  }
  function saveLocal(){
    try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(localData)); }catch(e){}
  }
  function notifyLocal(){ localListeners.forEach(function(fn){ fn(); }); }

  function uid(){ return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,8); }

  // ---- backend (fetch) helpers ----
  // A 401 here always means "the session cookie is gone" (expired / logged
  // out elsewhere) — bounce straight back to the auth screen rather than
  // showing a confusing error state.
  async function apiFetch(path, opts){
    opts = opts || {};
    var headers = Object.assign({}, opts.headers);
    var body = opts.body;
    if(body && typeof FormData !== "undefined" && body instanceof FormData){
      // let the browser set the multipart boundary itself
    } else if(body !== undefined){
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    var res;
    try{
      res = await fetch(path, { method: opts.method||"GET", headers: headers, body: body, credentials: "same-origin" });
    }catch(networkErr){
      var offlineErr = new Error("network_error");
      offlineErr.code = "network_error";
      throw offlineErr;
    }
    if(res.status === 401 && path !== "/api/auth/me"){
      sessionUser = null;
      authMode = true;
      if(typeof onSessionExpired === "function") onSessionExpired();
    }
    if(!res.ok){
      var payload = {};
      try{ payload = await res.json(); }catch(e){}
      var err = new Error(payload.message || ("HTTP "+res.status));
      err.code = payload.code;
      err.status = res.status;
      throw err;
    }
    if(res.status === 204) return null;
    var ct = res.headers.get("content-type") || "";
    if(ct.indexOf("application/json") > -1) return res.json();
    return null;
  }
  function fileFormData(file){
    var fd = new FormData();
    fd.append("image", file);
    return fd;
  }
  function qs(params){
    var parts = [];
    for(var k in params){ if(params[k]!==undefined && params[k]!==null) parts.push(encodeURIComponent(k)+"="+encodeURIComponent(params[k])); }
    return parts.length ? ("?"+parts.join("&")) : "";
  }

  // Lightweight polling pub/sub: each watchXxx() registers a "tick" function
  // (a fetch-then-callback) into one of these lists, and Store's mutating
  // methods (addExpense, etc.) call refreshAll() right after a successful
  // write so the tab that made the change updates immediately, instead of
  // waiting for the next interval. The interval itself is what picks up
  // changes made by the other person's device.
  var expenseWatchers = [];
  var recurringWatchers = [];
  var merchantMapWatchers = [];
  var profileWatchers = [];
  function refreshAll(list){ list.forEach(function(tick){ tick(); }); }
  function pollWatch(list, fetcher, cb, emptyValue, intervalMs){
    var stopped = false;
    function tick(){
      if(stopped) return;
      fetcher().then(function(data){ if(!stopped) cb(data); }).catch(function(){ if(!stopped) cb(emptyValue); });
    }
    tick();
    var timer = setInterval(tick, intervalMs || 20000);
    var onFocus = function(){ tick(); };
    window.addEventListener("focus", onFocus);
    list.push(tick);
    return function(){
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      var i = list.indexOf(tick);
      if(i>-1) list.splice(i,1);
    };
  }

  var Store = {
    async getProfile(){
      if(dbApi){
        try{
          var snap = await dbApi.doc("settings/profile").get();
          return snap.exists ? snap.data() : null;
        }catch(e){ return null; }
      }
      if(authMode) return apiFetch("/api/profile");
      return localData.profile;
    },
    watchProfile(cb){
      if(dbApi){
        return dbApi.doc("settings/profile").onSnapshot(function(snap){
          cb(snap.exists ? snap.data() : null);
        }, function(){ cb(null); });
      }
      if(authMode){
        return pollWatch(profileWatchers, function(){ return apiFetch("/api/profile"); }, cb, null, 20000);
      }
      var fn = function(){ cb(localData.profile); };
      fn();
      localListeners.push(fn);
      return function(){ localListeners = localListeners.filter(function(l){ return l!==fn; }); };
    },
    async setProfile(data){
      if(dbApi){ await dbApi.doc("settings/profile").set(data); return; }
      if(authMode){ await apiFetch("/api/profile", { method:"PUT", body:data }); refreshAll(profileWatchers); return; }
      localData.profile = data; saveLocal(); notifyLocal();
    },
    async updateProfile(patch){
      if(dbApi){
        try{ await dbApi.doc("settings/profile").update(patch); }
        catch(e){ await dbApi.doc("settings/profile").set(patch); }
        return;
      }
      if(authMode){ await apiFetch("/api/profile", { method:"PATCH", body:patch }); refreshAll(profileWatchers); return; }
      localData.profile = Object.assign({}, localData.profile, patch);
      saveLocal(); notifyLocal();
    },
    watchExpenses(scope, owner, cb){
      if(dbApi){
        var q = dbApi.collection("expenses").where("scope","==",scope);
        if(owner) q = q.where("owner","==",owner);
        q = q.orderBy("date","desc").limit(500);
        return q.onSnapshot(function(snap){
          cb(snap.docs.map(function(d){ var o=d.data()||{}; o.id=d.id; return o; }));
        }, function(){ cb([]); });
      }
      if(authMode){
        return pollWatch(expenseWatchers, function(){
          return apiFetch("/api/expenses"+qs({scope:scope, owner:owner||undefined}));
        }, cb, [], 15000);
      }
      var fn = function(){
        var list = localData.expenses.filter(function(e){
          return e.scope===scope && (!owner || e.owner===owner);
        });
        list.sort(function(a,b){ return (b.date||"").localeCompare(a.date||""); });
        cb(list);
      };
      fn();
      localListeners.push(fn);
      return function(){ localListeners = localListeners.filter(function(l){ return l!==fn; }); };
    },
    async addExpense(data){
      if(dbApi){ await dbApi.collection("expenses").add(data); return; }
      if(authMode){ await apiFetch("/api/expenses", { method:"POST", body:data }); refreshAll(expenseWatchers); return; }
      data.id = uid(); localData.expenses.push(data); saveLocal(); notifyLocal();
    },
    async updateExpense(id, patch){
      if(dbApi){ await dbApi.doc("expenses/"+id).update(patch); return; }
      if(authMode){ await apiFetch("/api/expenses/"+id, { method:"PATCH", body:patch }); refreshAll(expenseWatchers); return; }
      var it = localData.expenses.find(function(e){ return e.id===id; });
      if(it) Object.assign(it, patch);
      saveLocal(); notifyLocal();
    },
    async deleteExpense(id){
      if(dbApi){ await dbApi.doc("expenses/"+id).delete(); return; }
      if(authMode){ await apiFetch("/api/expenses/"+id, { method:"DELETE" }); refreshAll(expenseWatchers); return; }
      localData.expenses = localData.expenses.filter(function(e){ return e.id!==id; }); saveLocal(); notifyLocal();
    },
    watchMerchantMap(cb){
      if(dbApi){
        return dbApi.doc("settings/merchantMap").onSnapshot(function(snap){
          cb(snap.exists ? (snap.data()||{}) : {});
        }, function(){ cb({}); });
      }
      if(authMode){
        return pollWatch(merchantMapWatchers, function(){ return apiFetch("/api/merchant-map"); }, cb, {}, 30000);
      }
      var fn = function(){ cb(localData.merchantMap||{}); };
      fn();
      localMapListeners.push(fn);
      return function(){ localMapListeners = localMapListeners.filter(function(l){ return l!==fn; }); };
    },
    async learnMerchants(pairs){
      // pairs: {merchantText: category, ...} merged into the shared map
      if(!pairs || !Object.keys(pairs).length) return;
      if(dbApi){
        try{ await dbApi.doc("settings/merchantMap").update(pairs); }
        catch(e){ await dbApi.doc("settings/merchantMap").set(pairs); }
        return;
      }
      if(authMode){ await apiFetch("/api/merchant-map", { method:"POST", body:{pairs:pairs} }); refreshAll(merchantMapWatchers); return; }
      Object.assign(localData.merchantMap, pairs);
      saveLocal();
      localMapListeners.forEach(function(fn){ fn(); });
    },
    watchRecurring(scope, owner, cb){
      if(dbApi){
        var q = dbApi.collection("recurring").where("scope","==",scope);
        if(owner) q = q.where("owner","==",owner);
        return q.onSnapshot(function(snap){
          cb(snap.docs.map(function(d){ var o=d.data()||{}; o.id=d.id; return o; }));
        }, function(){ cb([]); });
      }
      if(authMode){
        return pollWatch(recurringWatchers, function(){
          return apiFetch("/api/recurring"+qs({scope:scope, owner:owner||undefined}));
        }, cb, [], 20000);
      }
      var fn = function(){
        var list = localData.recurring.filter(function(r){
          return r.scope===scope && (!owner || r.owner===owner);
        });
        cb(list);
      };
      fn();
      localRecurringListeners.push(fn);
      return function(){ localRecurringListeners = localRecurringListeners.filter(function(l){ return l!==fn; }); };
    },
    async addRecurring(data){
      if(dbApi){ await dbApi.collection("recurring").add(data); return; }
      if(authMode){ await apiFetch("/api/recurring", { method:"POST", body:data }); refreshAll(recurringWatchers); return; }
      data.id = uid(); localData.recurring.push(data); saveLocal(); localRecurringListeners.forEach(function(fn){ fn(); });
    },
    async updateRecurring(id, patch){
      if(dbApi){ await dbApi.doc("recurring/"+id).update(patch); return; }
      if(authMode){ await apiFetch("/api/recurring/"+id, { method:"PATCH", body:patch }); refreshAll(recurringWatchers); return; }
      var it = localData.recurring.find(function(r){ return r.id===id; });
      if(it) Object.assign(it, patch);
      saveLocal(); localRecurringListeners.forEach(function(fn){ fn(); });
    },
    async deleteRecurring(id){
      if(dbApi){ await dbApi.doc("recurring/"+id).delete(); return; }
      if(authMode){ await apiFetch("/api/recurring/"+id, { method:"DELETE" }); refreshAll(recurringWatchers); return; }
      localData.recurring = localData.recurring.filter(function(r){ return r.id!==id; }); saveLocal(); localRecurringListeners.forEach(function(fn){ fn(); });
    }
  };

  // assetsApi / sampleApi for backend mode: same call shapes as the Artifact
  // sandbox versions (assetsApi.upload(file) -> {id}; sampleApi.json(prompt,
  // {images,modelTier}) -> {merchant,date,items} or throws {code}), so
  // js/screens/receipt.js needs no changes at all.
  function makeBackendAssetsApi(){
    return {
      upload: function(file){ return apiFetch("/api/receipts", { method:"POST", body:fileFormData(file) }); }
    };
  }
  function makeBackendSampleApi(){
    return {
      json: function(prompt, opts){ return apiFetch("/api/receipts/scan", { method:"POST", body:fileFormData(opts.images) }); }
    };
  }

  // ---------------- app state ----------------
  var state = {
    profile: null,
    who: null,           // "personA" | "personB"
    tab: "personal",      // "personal" | "shared"
    monthCursor: (function(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); })(),
    personalTx: [],
    sharedTx: [],
    unsubPersonal: null,
    unsubShared: null,
    unsubRecurringPersonal: null,
    unsubRecurringShared: null,
    settleConfirm: false,
    deleteConfirmId: null,
    merchantMap: {},
    recurringPersonal: [],
    recurringShared: [],
    editingIncome: false,
    incomeDraft: "",
    viewMode: "calendar",
    selectedDay: null,
    trendMonth: null
  };

  function fmtYen(n){
    n = Math.round(n||0);
    return "¥" + n.toLocaleString("ja-JP");
  }
  function fmtYenSigned(n){
    n = Math.round(n||0);
    if(n < 0) return "－¥" + Math.abs(n).toLocaleString("ja-JP");
    return "¥" + n.toLocaleString("ja-JP");
  }
  function personIncome(who){
    if(!state.profile) return 0;
    return (who==="personA" ? state.profile.personAIncome : state.profile.personBIncome) || 0;
  }
  function monthLabel(ym){
    var p = ym.split("-"); return p[0] + "年" + parseInt(p[1],10) + "月";
  }
  function shiftMonth(ym, delta){
    var p = ym.split("-"); var d = new Date(parseInt(p[0],10), parseInt(p[1],10)-1+delta, 1);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  }
  function inMonth(dateStr, ym){ return (dateStr||"").indexOf(ym)===0; }
  function todayStr(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

  function personName(who){
    if(!state.profile) return who==="personA" ? "Aさん" : "Bさん";
    return who==="personA" ? (state.profile.personAName||"Aさん") : (state.profile.personBName||"Bさん");
  }

  // ---------------- rendering ----------------
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function fmtYenCompact(n){
    if(n >= 10000) return (Math.round(n/1000)/10) + "万";
    return n.toLocaleString("ja-JP");
  }
  function lastNMonths(ym, n){
    var arr = [];
    for(var i=n-1; i>=0; i--) arr.push(shiftMonth(ym, -i));
    return arr;
  }
  function pad2(n){ n = String(n); return n.length<2 ? "0"+n : n; }
