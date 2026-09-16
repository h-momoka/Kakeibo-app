"use strict";

  var sheetState = null;

  function openSheet(mode, prefill){
    prefill = prefill || {};
    sheetState = {
      mode: mode,
      amount: prefill.amount || "",
      category: prefill.category || CATS[0].k,
      memo: prefill.memo || "",
      date: todayStr(),
      paidBy: prefill.paidBy || state.who,
      splitPercentA: (typeof prefill.splitPercentA === "number") ? prefill.splitPercentA : 50,
      recurringId: prefill.recurringId || null,
      recurringMonth: prefill.recurringMonth || null,
      receiptAssetId: null,
      receiptUploading: false,
      receiptError: ""
    };
    renderSheet();
  }
  function closeSheet(){
    var scrim = document.getElementById("scrim");
    if(scrim) scrim.remove();
    sheetState = null;
  }

  function renderSheet(){
    var old = document.getElementById("scrim");
    if(old) old.remove();
    var s = sheetState;
    var isShared = s.mode === "shared";

    var catButtons = CATS.map(function(c){
      return '<button type="button" class="'+(s.category===c.k?"on":"")+'" data-cat="'+c.k+'"><span class="dot" style="background:'+c.c+'"></span>'+c.k+'</button>';
    }).join("");

    var sharedFields = "";
    if(isShared){
      sharedFields =
        '<div class="field"><label>支払った人</label><div class="chiprow">' +
          '<button type="button" data-paidby="personA" class="'+(s.paidBy==="personA"?"on":"")+'">'+personName("personA")+'</button>' +
          '<button type="button" data-paidby="personB" class="'+(s.paidBy==="personB"?"on":"")+'">'+personName("personB")+'</button>' +
        '</div></div>' +
        '<div class="field"><label>負担割合</label>' +
          '<div class="chiprow">' +
            '<button type="button" data-split="50" class="'+(s.splitPercentA===50?"on":"")+'">均等 50/50</button>' +
            '<button type="button" data-split="100" class="'+(s.splitPercentA===100?"on":"")+'">'+personName("personA")+'全額</button>' +
            '<button type="button" data-split="0" class="'+(s.splitPercentA===0?"on":"")+'">'+personName("personB")+'全額</button>' +
          '</div>' +
          '<div class="split-row"><input type="range" min="0" max="100" step="5" id="splitRange" value="'+s.splitPercentA+'"></div>' +
          '<div class="split-readout"><span>'+personName("personA")+' '+s.splitPercentA+'%</span><span>'+personName("personB")+' '+(100-s.splitPercentA)+'%</span></div>' +
        '</div>';
    }

    var receiptField = "";
    if(assetsApi){
      var receiptInner;
      if(s.receiptAssetId){
        receiptInner = '<div class="receipt-preview"><img src="/_blob/'+s.receiptAssetId+'" alt="レシート"><button type="button" class="link-btn" id="fReceiptRemove">削除</button></div>';
      } else if(s.receiptUploading){
        receiptInner = '<div class="file-drop">アップロード中…</div>';
      } else {
        receiptInner = '<label class="file-drop" id="fReceiptDrop"><strong>写真を選択</strong>（カメラも起動できます）<input type="file" id="fReceiptInput" accept="image/*" capture="environment"></label>';
      }
      receiptField = '<div class="field"><label>レシート写真（任意）</label>' + receiptInner +
        (s.receiptError ? '<div class="imp-lead" style="color:var(--warn); margin:0;">'+escapeHtml(s.receiptError)+'</div>' : '') +
      '</div>';
    }

    var html =
      '<div class="scrim" id="scrim">' +
        '<div class="sheet">' +
          '<h3>'+(isShared?"共有の支出を追加":"個人の支出を追加")+(s.recurringId?'（固定費）':'')+'</h3>' +
          '<div class="field"><label>金額</label><input class="amt num" id="fAmount" type="number" inputmode="numeric" placeholder="0" value="'+s.amount+'"></div>' +
          '<div class="field"><label>カテゴリ</label><div class="catgrid">'+catButtons+'</div></div>' +
          '<div class="field"><label>日付</label><input id="fDate" type="date" value="'+s.date+'"></div>' +
          '<div class="field"><label>メモ（任意）</label><input id="fMemo" type="text" placeholder="例: スーパーで食材" value="'+escapeHtml(s.memo)+'" maxlength="60"></div>' +
          sharedFields +
          receiptField +
          '<button class="primary-btn" id="fSave">追加する</button>' +
          '<button class="ghost-btn" id="fCancel">キャンセル</button>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML("beforeend", html);

    document.getElementById("fAmount").addEventListener("input", function(e){ sheetState.amount = e.target.value; });
    document.getElementById("fDate").addEventListener("input", function(e){ sheetState.date = e.target.value; });
    document.getElementById("fMemo").addEventListener("input", function(e){ sheetState.memo = e.target.value; });
    document.querySelectorAll("[data-cat]").forEach(function(b){
      b.addEventListener("click", function(){ sheetState.category = b.getAttribute("data-cat"); renderSheet(); focusAmount(); });
    });
    if(isShared){
      document.querySelectorAll("[data-paidby]").forEach(function(b){
        b.addEventListener("click", function(){ sheetState.paidBy = b.getAttribute("data-paidby"); renderSheet(); focusAmount(); });
      });
      document.querySelectorAll("[data-split]").forEach(function(b){
        b.addEventListener("click", function(){ sheetState.splitPercentA = parseInt(b.getAttribute("data-split"),10); renderSheet(); focusAmount(); });
      });
      var range = document.getElementById("splitRange");
      if(range) range.addEventListener("input", function(e){ sheetState.splitPercentA = parseInt(e.target.value,10); renderSheet(); });
    }
    document.getElementById("fCancel").addEventListener("click", closeSheet);
    document.getElementById("scrim").addEventListener("click", function(e){ if(e.target.id==="scrim") closeSheet(); });
    if(assetsApi){
      var receiptInput = document.getElementById("fReceiptInput");
      if(receiptInput){
        receiptInput.addEventListener("change", async function(e){
          var f = e.target.files && e.target.files[0];
          if(!f) return;
          sheetState.receiptUploading = true; sheetState.receiptError = ""; renderSheet();
          try{
            var res = await assetsApi.upload(f);
            sheetState.receiptAssetId = res.id;
          }catch(err){
            sheetState.receiptError = "アップロードに失敗しました。もう一度お試しください。";
          }
          sheetState.receiptUploading = false;
          renderSheet();
        });
      }
      var receiptRemove = document.getElementById("fReceiptRemove");
      if(receiptRemove){
        receiptRemove.addEventListener("click", function(){ sheetState.receiptAssetId = null; renderSheet(); });
      }
    }
    document.getElementById("fSave").addEventListener("click", async function(){
      var amt = parseInt(sheetState.amount, 10);
      if(!amt || amt<=0) return;
      var data = {
        amount: amt,
        category: sheetState.category,
        memo: sheetState.memo || "",
        date: sheetState.date || todayStr(),
        scope: sheetState.mode,
        createdAt: new Date().toISOString()
      };
      if(sheetState.mode === "personal"){
        data.owner = state.who;
      } else {
        data.paidBy = sheetState.paidBy || state.who;
        data.splitPercentA = sheetState.splitPercentA;
        data.settled = false;
      }
      if(sheetState.recurringId){
        data.recurringId = sheetState.recurringId;
        data.recurringMonth = sheetState.recurringMonth;
      }
      if(sheetState.receiptAssetId){
        data.receiptAssetId = sheetState.receiptAssetId;
      }
      await Store.addExpense(data);
      closeSheet();
    });
  }
  function focusAmount(){ var el = document.getElementById("fAmount"); if(el) el.focus(); }

  // ---------------- csv import ----------------
