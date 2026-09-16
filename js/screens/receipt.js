"use strict";

  var receiptState = null;

  function openReceiptScan(){
    receiptState = { step:"source", owner: state.who, file:null, errorMsg:"" };
    renderReceiptSheet();
  }
  function closeReceiptScan(){
    var scrim = document.getElementById("rcpScrim");
    if(scrim) scrim.remove();
    receiptState = null;
  }
  function renderReceiptSheet(){
    var old = document.getElementById("rcpScrim");
    if(old) old.remove();
    var s = receiptState;
    var html = s.step==="review" ? receiptReviewHtml() : receiptSourceHtml();
    document.body.insertAdjacentHTML("beforeend", '<div class="scrim" id="rcpScrim"><div class="sheet">'+html+'</div></div>');
    wireReceiptSheet();
  }
  function receiptSourceHtml(){
    var s = receiptState;
    var analyzing = s.step === "analyzing";
    var accept = (sampleImageLimits && sampleImageLimits.mediaTypes) ? sampleImageLimits.mediaTypes.join(",") : "image/*";
    return '<h3>レシートを読み取る</h3>' +
      '<p class="imp-lead">レシート全体が写るように撮影・選択してください。買った商品ごとに自動で項目分けし、あとで個人/共有を振り分けられます。</p>' +
      '<div class="field"><label>誰の支払い？（あとから商品ごとに変更できます）</label><div class="chiprow">' +
        '<button type="button" data-rcpowner="personA" class="'+(s.owner==="personA"?"on":"")+'">'+personName("personA")+'</button>' +
        '<button type="button" data-rcpowner="personB" class="'+(s.owner==="personB"?"on":"")+'">'+personName("personB")+'</button>' +
      '</div></div>' +
      '<div class="field"><label>レシート写真</label><label class="file-drop">' +
        (analyzing ? "解析しています…" : (s.file ? ('<strong>'+escapeHtml(s.file.name)+'</strong> を選択しました') : '<strong>写真を選ぶ</strong>（カメラも起動できます）')) +
        (analyzing ? '' : '<input type="file" id="rcpFile" accept="'+accept+'" capture="environment">') +
      '</label></div>' +
      (s.errorMsg ? '<p class="imp-lead" style="color:var(--warn); margin-top:-4px;">'+escapeHtml(s.errorMsg)+'</p>' : '') +
      '<button class="primary-btn" id="rcpNext" '+((s.file && !analyzing) ? "" : "disabled")+'>'+(analyzing?"解析しています…":"読み取る")+'</button>' +
      '<button class="ghost-btn" id="rcpCancel" '+(analyzing?"disabled":"")+'>キャンセル</button>';
  }
  function receiptReviewHtml(){
    var s = receiptState;
    var includedCount = s.rows.filter(function(r){ return r.include; }).length;
    var rowsHtml = s.rows.map(function(r, idx){
      var isShared = r.scope === "shared";
      return '<div class="imp-row'+(r.include?"":" excluded")+'" data-rcprow="'+idx+'">' +
        '<div class="imp-top">' +
          '<input type="checkbox" class="imp-check" '+(r.include?"checked":"")+'>' +
          '<div class="imp-info"><div class="imp-memo">'+escapeHtml(r.memo||"(商品名不明)")+'</div><div class="imp-date">'+s.date+'</div></div>' +
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
      '<div class="imp-summary">'+(s.merchant?escapeHtml(s.merchant)+" ・ ":"")+s.rows.length+'件の商品を検出しました。カテゴリと個人/共有を確認してください。</div>' +
      '<div class="imp-toolbar"><button type="button" id="rcpAllPersonal">すべて個人にする</button><button type="button" id="rcpAllShared">すべて共有にする</button></div>' +
      '<div class="imp-list">' + (rowsHtml || '<div class="empty-note">商品を読み取れませんでした。</div>') + '</div>' +
      '<button class="primary-btn" id="rcpConfirm" '+(includedCount===0?"disabled":"")+'>'+includedCount+'件を取り込む</button>' +
      '<button class="ghost-btn" id="rcpBack">戻る</button>';
  }
  function receiptErrorMessage(code){
    switch(code){
      case "not_granted": return "レシートの解析が許可されませんでした。手動で入力してください。";
      case "images_unavailable": return "この環境では写真を送れません。手動で入力してください。";
      case "image_rejected": return "この写真は読み取れませんでした。別の写真でお試しください。";
      case "rate_limited": return "混み合っています。少し時間をおいてもう一度お試しください。";
      case "invalid_json": return "うまく読み取れませんでした。別の写真や明るい場所でお試しください。";
      default: return "読み取りに失敗しました。もう一度お試しください。";
    }
  }
  async function runReceiptAnalysis(){
    receiptState.step = "analyzing";
    receiptState.errorMsg = "";
    renderReceiptSheet();
    var uploadPromise = assetsApi ? assetsApi.upload(receiptState.file).catch(function(){ return null; }) : Promise.resolve(null);
    var catList = CATS.map(function(c){ return c.k; }).join("、");
    var prompt = "これは買い物のレシートの写真です。写っている商品を一つずつ読み取り、次のJSON形式だけで答えてください。小計・消費税・合計・お預かり・お釣り・ポイント・割引の行は商品として含めないでください。金額は税込みの円の整数にしてください。\n" +
      '{"merchant": "店名（読み取れなければnull）", "date": "YYYY-MM-DD形式（読み取れなければnull）", "items": [{"name":"商品名", "price": 整数, "category": "次の中から最も近いものを一つだけ選ぶ: '+catList+'"}]}' +
      "\nJSON以外の文章は出力しないでください。";
    try{
      var result = await sampleApi.json(prompt, { images: receiptState.file, modelTier: "default" });
      var uploadRes = await uploadPromise;
      var items = Array.isArray(result && result.items) ? result.items : [];
      var validCats = CATS.map(function(c){ return c.k; });
      var rows = items.map(function(it, i){
        var cat = validCats.indexOf(it && it.category) > -1 ? it.category : null;
        var price = Math.round(Number(it && it.price));
        return {
          key: "rcp-"+i,
          memo: String((it && it.name) || "").slice(0,60),
          amount: (isFinite(price) && price>0) ? price : 0,
          category: cat || "その他",
          unknownCat: !cat,
          scope: "personal",
          owner: receiptState.owner,
          paidBy: receiptState.owner,
          split: 50,
          include: true
        };
      }).filter(function(r){ return r.amount > 0; });
      receiptState.merchant = (result && result.merchant) || "";
      receiptState.date = (result && typeof result.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) ? result.date : todayStr();
      receiptState.receiptAssetId = uploadRes ? uploadRes.id : null;
      receiptState.rows = rows;
      if(!rows.length){
        receiptState.step = "source";
        receiptState.errorMsg = "商品を読み取れませんでした。別の写真でお試しください。";
        renderReceiptSheet();
        return;
      }
      receiptState.step = "review";
      renderReceiptSheet();
    }catch(err){
      receiptState.step = "source";
      receiptState.errorMsg = receiptErrorMessage(err && err.code);
      renderReceiptSheet();
    }
  }
  async function confirmReceiptImport(){
    var rows = receiptState.rows.filter(function(r){ return r.include; });
    var learn = {};
    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      var data = { amount:r.amount, category:r.category, memo:r.memo, date:receiptState.date, scope:r.scope, createdAt:new Date().toISOString() };
      if(receiptState.receiptAssetId) data.receiptAssetId = receiptState.receiptAssetId;
      if(r.scope==="personal") data.owner = r.owner;
      else { data.paidBy = r.paidBy; data.splitPercentA = r.split; data.settled = false; }
      await Store.addExpense(data);
      if(r.memo) learn[r.memo] = r.category;
    }
    await Store.learnMerchants(learn);
    closeReceiptScan();
    render();
  }
  function wireReceiptSheet(){
    var s = receiptState;
    document.getElementById("rcpScrim").addEventListener("click", function(e){ if(e.target.id==="rcpScrim") closeReceiptScan(); });

    if(s.step === "source" || s.step === "analyzing"){
      document.querySelectorAll("[data-rcpowner]").forEach(function(b){
        b.addEventListener("click", function(){ receiptState.owner = b.getAttribute("data-rcpowner"); renderReceiptSheet(); });
      });
      var fileInput = document.getElementById("rcpFile");
      if(fileInput){
        fileInput.addEventListener("change", function(e){
          var f = e.target.files && e.target.files[0];
          if(!f) return;
          receiptState.file = f;
          receiptState.errorMsg = "";
          renderReceiptSheet();
        });
      }
      var cancelBtn = document.getElementById("rcpCancel");
      if(cancelBtn) cancelBtn.addEventListener("click", closeReceiptScan);
      var nextBtn = document.getElementById("rcpNext");
      if(nextBtn) nextBtn.addEventListener("click", runReceiptAnalysis);
    } else if(s.step === "review"){
      document.getElementById("rcpAllPersonal").addEventListener("click", function(){ s.rows.forEach(function(r){ r.scope="personal"; }); renderReceiptSheet(); });
      document.getElementById("rcpAllShared").addEventListener("click", function(){ s.rows.forEach(function(r){ r.scope="shared"; }); renderReceiptSheet(); });
      document.querySelectorAll("[data-rcprow]").forEach(function(el){
        var idx = parseInt(el.getAttribute("data-rcprow"),10);
        var row = s.rows[idx];
        var chk = el.querySelector(".imp-check");
        if(chk) chk.addEventListener("change", function(){ row.include = chk.checked; renderReceiptSheet(); });
        var catSel = el.querySelector(".imp-cat");
        if(catSel) catSel.addEventListener("change", function(){ row.category = catSel.value; row.unknownCat = false; });
        el.querySelectorAll("[data-scope]").forEach(function(b){
          b.addEventListener("click", function(){ row.scope = b.getAttribute("data-scope"); renderReceiptSheet(); });
        });
        var splitSel = el.querySelector(".split-sel");
        if(splitSel) splitSel.addEventListener("change", function(){ row.split = parseInt(splitSel.value,10); });
      });
      var confirmBtn = document.getElementById("rcpConfirm");
      if(confirmBtn) confirmBtn.addEventListener("click", confirmReceiptImport);
      var backBtn = document.getElementById("rcpBack");
      if(backBtn) backBtn.addEventListener("click", function(){ receiptState.step = "source"; renderReceiptSheet(); });
    }
  }

  // ---------------- recurring (fixed cost) manager ----------------
