"use strict";

  var importState = null;
  var DATE_KEYS = ["日付","利用日","ご利用日","取引日","支払日","年月日"];
  var DESC_KEYS = ["店名","摘要","内容","商品名","利用先","加盟店","但し書き"];
  var AMT_KEYS = ["金額"];

  function splitCsvLine(line){
    var result = []; var cur = ""; var inQuotes = false;
    for(var i=0;i<line.length;i++){
      var ch = line[i];
      if(inQuotes){
        if(ch === '"'){ if(line[i+1] === '"'){ cur += '"'; i++; } else { inQuotes = false; } }
        else cur += ch;
      } else {
        if(ch === '"') inQuotes = true;
        else if(ch === ",") { result.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    result.push(cur);
    return result.map(function(c){ return c.trim(); });
  }
  function parseCSVText(text){
    var lines = String(text||"").split(/\r\n|\r|\n/).filter(function(l){ return l.trim().length>0; });
    return lines.map(splitCsvLine);
  }
  function tryHeaderDetect(headerCells){
    var dateIdx=-1, descIdx=-1, amtIdx=-1;
    (headerCells||[]).forEach(function(h,i){
      var hh = (h||"").replace(/\s/g,"");
      if(dateIdx<0 && DATE_KEYS.some(function(k){ return hh.indexOf(k)>-1; })) dateIdx=i;
      if(descIdx<0 && DESC_KEYS.some(function(k){ return hh.indexOf(k)>-1; })) descIdx=i;
      if(amtIdx<0 && AMT_KEYS.some(function(k){ return hh.indexOf(k)>-1; })) amtIdx=i;
    });
    return { dateIdx:dateIdx, descIdx:descIdx, amtIdx:amtIdx };
  }
  function looksLikeDate(s){
    s = (s||"").trim();
    return /^\d{4}[\/\-.年]\d{1,2}[\/\-.月]\d{1,2}日?$/.test(s) || /^\d{1,2}[\/\-]\d{1,2}$/.test(s);
  }
  function looksLikeAmount(s){
    var t = (s||"").replace(/[¥,\s]/g,"");
    return t.length>0 && /^-?\d+$/.test(t);
  }
  function heuristicDetect(dataRows){
    if(!dataRows.length) return { dateIdx:-1, descIdx:-1, amtIdx:-1 };
    var colCount = dataRows[0].length;
    var scores = [];
    for(var c=0;c<colCount;c++){
      var dateHits=0, amtHits=0, total=0;
      for(var r=0;r<Math.min(dataRows.length,20);r++){
        var v = dataRows[r][c];
        if(v===undefined) continue;
        total++;
        if(looksLikeDate(v)) dateHits++;
        if(looksLikeAmount(v)) amtHits++;
      }
      scores.push({ c:c, dateScore: total?dateHits/total:0, amtScore: total?amtHits/total:0 });
    }
    var byDate = scores.slice().sort(function(a,b){ return b.dateScore-a.dateScore; })[0];
    var dateIdx = (byDate && byDate.dateScore>0.5) ? byDate.c : -1;
    var remaining = scores.filter(function(s){ return s.c!==dateIdx; });
    var byAmt = remaining.slice().sort(function(a,b){ return b.amtScore-a.amtScore; })[0];
    var amtIdx = (byAmt && byAmt.amtScore>0.5) ? byAmt.c : -1;
    var descIdx = -1;
    for(var i=0;i<colCount;i++){ if(i!==dateIdx && i!==amtIdx){ descIdx=i; break; } }
    return { dateIdx:dateIdx, descIdx:descIdx, amtIdx:amtIdx };
  }
  function normalizeDate(raw, fallbackYear){
    var s = (raw||"").trim();
    var m = s.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?$/);
    if(m) return m[1]+"-"+pad2(m[2])+"-"+pad2(m[3]);
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if(m){ var y = fallbackYear || (new Date()).getFullYear(); return y+"-"+pad2(m[1])+"-"+pad2(m[2]); }
    return null;
  }
  function normalizeAmount(raw){
    var t = (raw||"").replace(/[¥,\s]/g,"");
    if(!/^-?\d+$/.test(t)) return null;
    return parseInt(t,10);
  }
  function readFileSmart(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){
        var buf = reader.result, text;
        try{ text = new TextDecoder("utf-8", {fatal:true}).decode(buf); }
        catch(e){
          try{ text = new TextDecoder("shift_jis").decode(buf); }
          catch(e2){ text = new TextDecoder("utf-8").decode(buf); }
        }
        resolve(text);
      };
      reader.onerror = function(){ reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }

  function openImport(){
    importState = { step:"source", cardOwner: state.who, rawText:"", fileName:"" };
    renderImportSheet();
  }
  function closeImport(){
    var scrim = document.getElementById("impScrim");
    if(scrim) scrim.remove();
    importState = null;
  }
  function renderImportSheet(){
    var old = document.getElementById("impScrim");
    if(old) old.remove();
    var s = importState;
    var html = s.step==="source" ? importSourceHtml() : (s.step==="colmap" ? importColmapHtml() : importReviewHtml());
    document.body.insertAdjacentHTML("beforeend", '<div class="scrim" id="impScrim"><div class="sheet">'+html+'</div></div>');
    wireImportStep();
  }

  function importSourceHtml(){
    var s = importState;
    return '<h3>CSVから取り込む</h3>' +
      '<p class="imp-lead">カード会社のサイトからダウンロードした利用明細CSVを読み込みます。カテゴリは自動で推測し、あとから修正できます。</p>' +
      '<div class="field"><label>このカードは主に誰の利用？</label><div class="chiprow">' +
        '<button type="button" data-owner="personA" class="'+(s.cardOwner==="personA"?"on":"")+'">'+personName("personA")+'</button>' +
        '<button type="button" data-owner="personB" class="'+(s.cardOwner==="personB"?"on":"")+'">'+personName("personB")+'</button>' +
      '</div></div>' +
      '<div class="field"><label>CSVファイル</label><label class="file-drop">' +
        (s.fileName ? ('<strong>'+escapeHtml(s.fileName)+'</strong> を読み込みました') : '<strong>ファイルを選択</strong>、またはこの下に貼り付け') +
        '<input type="file" id="impFile" accept=".csv,text/csv"></label></div>' +
      '<div class="field"><label>またはCSVの中身を貼り付け</label><textarea id="impPaste" rows="5" placeholder="利用日,利用店名,利用金額&#10;2026/09/03,セブン-イレブン,890">'+escapeHtml(s.rawText)+'</textarea></div>' +
      '<button class="primary-btn" id="impNext" '+((s.rawText||"").trim() ? "" : "disabled")+'>次へ</button>' +
      '<button class="ghost-btn" id="impCancel">キャンセル</button>';
  }
  function importColmapHtml(){
    var s = importState;
    var sample = s.dataRows[0] || [];
    var colCount = sample.length;
    function options(selected){
      var out = "";
      for(var i=0;i<colCount;i++) out += '<option value="'+i+'" '+(selected===i?"selected":"")+'>列'+(i+1)+': '+escapeHtml((sample[i]||"").slice(0,12))+'</option>';
      return out;
    }
    return '<h3>列を選んでください</h3>' +
      '<p class="imp-lead">自動判定できなかったため、どの列が日付・利用先・金額か選んでください。</p>' +
      '<div class="imp-colmap">' +
        '<div class="field"><label>日付</label><select id="map_dateIdx">'+options(s.mapping.dateIdx)+'</select></div>' +
        '<div class="field"><label>利用先</label><select id="map_descIdx">'+options(s.mapping.descIdx)+'</select></div>' +
        '<div class="field"><label>金額</label><select id="map_amtIdx">'+options(s.mapping.amtIdx)+'</select></div>' +
      '</div>' +
      '<button class="primary-btn" id="impNext">この内容で取り込む</button>' +
      '<button class="ghost-btn" id="impBack">戻る</button>';
  }
  function importReviewHtml(){
    var s = importState;
    var includedCount = s.rows.filter(function(r){ return r.include; }).length;
    var rowsHtml = s.rows.map(function(r, idx){
      var isShared = r.scope === "shared";
      return '<div class="imp-row'+(r.include?"":" excluded")+'" data-improw="'+idx+'">' +
        '<div class="imp-top">' +
          '<input type="checkbox" class="imp-check" '+(r.include?"checked":"")+'>' +
          '<div class="imp-info"><div class="imp-memo">'+escapeHtml(r.memo||"(内容不明)")+'</div><div class="imp-date">'+r.date+'</div></div>' +
          '<div class="imp-amt num">'+fmtYen(r.amount)+'</div>' +
        '</div>' +
        '<div class="imp-controls">' +
          '<select class="imp-cat'+(r.unknownCat?" unknown":"")+'">' + CATS.map(function(c){ return '<option value="'+c.k+'" '+(r.category===c.k?"selected":"")+'>'+c.k+'</option>'; }).join("") + '</select>' +
          '<div class="scope-toggle"><button type="button" data-scope="personal" class="'+(!isShared?"on":"")+'">個人</button><button type="button" data-scope="shared" class="'+(isShared?"on":"")+'">共有</button></div>' +
          (isShared ? ('<select class="split-sel"><option value="50" '+(r.split===50?"selected":"")+'>均等50/50</option><option value="100" '+(r.split===100?"selected":"")+'>'+personName("personA")+'全額</option><option value="0" '+(r.split===0?"selected":"")+'>'+personName("personB")+'全額</option></select>') : "") +
        '</div>' +
      '</div>';
    }).join("");
    return '<h3>取り込む内容を確認</h3>' +
      '<div class="imp-summary">'+s.rows.length+'件を検出しました'+(s.skipped ? '（入金・返金など '+s.skipped+'件は自動的に除外）' : '')+'。カテゴリと個人/共有を確認してください。</div>' +
      '<div class="imp-toolbar"><button type="button" id="impAllPersonal">すべて個人にする</button><button type="button" id="impAllShared">すべて共有にする</button></div>' +
      '<div class="imp-list">' + (rowsHtml || '<div class="empty-note">取り込める行が見つかりませんでした。</div>') + '</div>' +
      '<button class="primary-btn" id="impConfirm" '+(includedCount===0?"disabled":"")+'>'+includedCount+'件を取り込む</button>' +
      '<button class="ghost-btn" id="impBack2">戻る</button>';
  }

  function proceedFromSource(){
    var allRows = parseCSVText(importState.rawText);
    if(!allRows.length) return;
    var header = allRows[0];
    var headerGuess = tryHeaderDetect(header);
    var hasHeader = headerGuess.dateIdx>-1 || headerGuess.descIdx>-1 || headerGuess.amtIdx>-1;
    var dataRows = hasHeader ? allRows.slice(1) : allRows;
    if(!dataRows.length) dataRows = allRows;
    var mapping = headerGuess;
    if(mapping.dateIdx<0 || mapping.descIdx<0 || mapping.amtIdx<0){
      var h = heuristicDetect(dataRows);
      if(mapping.dateIdx<0) mapping.dateIdx = h.dateIdx;
      if(mapping.descIdx<0) mapping.descIdx = h.descIdx;
      if(mapping.amtIdx<0) mapping.amtIdx = h.amtIdx;
    }
    importState.dataRows = dataRows;
    importState.mapping = mapping;
    if(mapping.dateIdx<0 || mapping.descIdx<0 || mapping.amtIdx<0 || mapping.dateIdx===mapping.amtIdx || mapping.descIdx===mapping.amtIdx){
      importState.step = "colmap";
      renderImportSheet();
    } else {
      finalizeRows();
    }
  }
  function finalizeRows(){
    var s = importState, m = s.mapping;
    var rows = [], skipped = 0;
    var fallbackYear = (new Date()).getFullYear();
    s.dataRows.forEach(function(cells, i){
      var amt = normalizeAmount(cells[m.amtIdx]);
      if(amt===null || amt<=0){ skipped++; return; }
      var date = normalizeDate(cells[m.dateIdx], fallbackYear) || todayStr();
      var memo = (cells[m.descIdx]||"").trim();
      var known = guessCategory(memo, state.merchantMap);
      rows.push({
        key:"imp-"+i, date:date, memo:memo, amount:amt,
        category: known || "その他", unknownCat: !known,
        scope:"personal", owner:s.cardOwner, paidBy:s.cardOwner, split:50, include:true
      });
    });
    rows.sort(function(a,b){ return (b.date||"").localeCompare(a.date||""); });
    s.rows = rows; s.skipped = skipped; s.step = "review";
    renderImportSheet();
  }
  async function doConfirmImport(){
    var rows = importState.rows.filter(function(r){ return r.include; });
    var learn = {};
    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      var data = { amount:r.amount, category:r.category, memo:r.memo, date:r.date, scope:r.scope, createdAt:new Date().toISOString() };
      if(r.scope==="personal") data.owner = r.owner;
      else { data.paidBy = r.paidBy; data.splitPercentA = r.split; data.settled = false; }
      await Store.addExpense(data);
      if(r.memo) learn[r.memo] = r.category;
    }
    await Store.learnMerchants(learn);
    closeImport();
    render();
  }

  function wireImportStep(){
    var s = importState;
    var cancelBtn = document.getElementById("impCancel");
    if(cancelBtn) cancelBtn.addEventListener("click", closeImport);
    document.getElementById("impScrim").addEventListener("click", function(e){ if(e.target.id==="impScrim") closeImport(); });

    if(s.step === "source"){
      document.querySelectorAll("[data-owner]").forEach(function(b){
        b.addEventListener("click", function(){ importState.cardOwner = b.getAttribute("data-owner"); renderImportSheet(); });
      });
      document.getElementById("impFile").addEventListener("change", async function(e){
        var f = e.target.files && e.target.files[0];
        if(!f) return;
        try{
          var text = await readFileSmart(f);
          importState.rawText = text; importState.fileName = f.name;
          renderImportSheet();
        }catch(err){ /* fall back to manual paste */ }
      });
      var paste = document.getElementById("impPaste");
      paste.addEventListener("input", function(e){
        importState.rawText = e.target.value; importState.fileName = "";
        var btn = document.getElementById("impNext"); if(btn) btn.disabled = !e.target.value.trim();
      });
      document.getElementById("impNext").addEventListener("click", proceedFromSource);
    } else if(s.step === "colmap"){
      ["dateIdx","descIdx","amtIdx"].forEach(function(key){
        var sel = document.getElementById("map_"+key);
        if(sel) sel.addEventListener("change", function(){ importState.mapping[key] = parseInt(sel.value,10); });
      });
      document.getElementById("impNext").addEventListener("click", finalizeRows);
      var back = document.getElementById("impBack");
      if(back) back.addEventListener("click", function(){ importState.step="source"; renderImportSheet(); });
    } else if(s.step === "review"){
      document.getElementById("impAllPersonal").addEventListener("click", function(){ importState.rows.forEach(function(r){ r.scope="personal"; }); renderImportSheet(); });
      document.getElementById("impAllShared").addEventListener("click", function(){ importState.rows.forEach(function(r){ r.scope="shared"; }); renderImportSheet(); });
      document.querySelectorAll("[data-improw]").forEach(function(el){
        var idx = parseInt(el.getAttribute("data-improw"),10);
        var row = importState.rows[idx];
        var chk = el.querySelector(".imp-check");
        if(chk) chk.addEventListener("change", function(){ row.include = chk.checked; renderImportSheet(); });
        var catSel = el.querySelector(".imp-cat");
        if(catSel) catSel.addEventListener("change", function(){ row.category = catSel.value; row.unknownCat=false; });
        el.querySelectorAll("[data-scope]").forEach(function(b){
          b.addEventListener("click", function(){ row.scope = b.getAttribute("data-scope"); renderImportSheet(); });
        });
        var splitSel = el.querySelector(".split-sel");
        if(splitSel) splitSel.addEventListener("change", function(){ row.split = parseInt(splitSel.value,10); });
      });
      var confirmBtn = document.getElementById("impConfirm");
      if(confirmBtn) confirmBtn.addEventListener("click", doConfirmImport);
      var back2 = document.getElementById("impBack2");
      if(back2) back2.addEventListener("click", function(){ importState.step="source"; renderImportSheet(); });
    }
  }

  // ---------------- receipt scan (itemized) ----------------
