"use strict";

  var recurringMgrState = null;

  function openRecurringManager(){
    recurringMgrState = { showForm:false, form:null };
    renderRecurringManager();
  }
  function closeRecurringManager(){
    var scrim = document.getElementById("recScrim");
    if(scrim) scrim.remove();
    recurringMgrState = null;
  }
  function resetRecForm(){
    recurringMgrState.form = { name:"", amount:"", category:CATS[0].k, scope:"personal", paidBy:state.who, splitPercentA:50 };
  }
  function recRowsHtml(list, scope){
    if(!list.length) return '<div class="empty-note">まだ登録がありません。</div>';
    return '<div class="rec-list">' + list.map(function(item){
      var sub = scope==="shared" ? (personName(item.paidBy)+"が支払い") : "";
      return '<div class="rec-mgr-row">' +
        '<span class="dot" style="background:'+catColor(item.category)+'"></span>' +
        '<span class="rec-info"><span class="rec-name">'+escapeHtml(item.name)+'</span><span class="rec-meta">'+item.category+(sub?(" ・ "+sub):"")+'</span></span>' +
        '<span class="rec-amt num">'+fmtYen(item.amount)+'</span>' +
        '<button type="button" class="del" data-delrec="'+item.id+'">✕</button>' +
      '</div>';
    }).join("") + '</div>';
  }
  function renderRecurringManager(){
    var old = document.getElementById("recScrim");
    if(old) old.remove();
    var s = recurringMgrState;
    var html = '<h3>固定費の管理</h3>' +
      '<p class="imp-lead">家賃やサブスクなど毎月かかる支出をテンプレートとして登録すると、ダッシュボードからワンタップで今月分を追加できます。</p>';

    if(s.showForm){
      var f = s.form;
      var isShared = f.scope === "shared";
      var catButtons = CATS.map(function(c){ return '<button type="button" class="'+(f.category===c.k?"on":"")+'" data-rcat="'+c.k+'"><span class="dot" style="background:'+c.c+'"></span>'+c.k+'</button>'; }).join("");
      html +=
        '<div class="field"><label>名前</label><input id="rName" type="text" placeholder="例: 家賃、Netflix" value="'+escapeHtml(f.name)+'" maxlength="30"></div>' +
        '<div class="field"><label>金額</label><input id="rAmount" class="amt num" type="number" inputmode="numeric" placeholder="0" value="'+f.amount+'"></div>' +
        '<div class="field"><label>カテゴリ</label><div class="catgrid">'+catButtons+'</div></div>' +
        '<div class="field"><label>個人 / 共有</label><div class="chiprow">' +
          '<button type="button" data-rscope="personal" class="'+(!isShared?"on":"")+'">個人（自分の分）</button>' +
          '<button type="button" data-rscope="shared" class="'+(isShared?"on":"")+'">共有</button>' +
        '</div></div>' +
        (isShared ?
          ('<div class="field"><label>支払った人</label><div class="chiprow">' +
            '<button type="button" data-rpaidby="personA" class="'+(f.paidBy==="personA"?"on":"")+'">'+personName("personA")+'</button>' +
            '<button type="button" data-rpaidby="personB" class="'+(f.paidBy==="personB"?"on":"")+'">'+personName("personB")+'</button>' +
          '</div></div>' +
          '<div class="field"><label>負担割合</label><div class="chiprow">' +
            '<button type="button" data-rsplit="50" class="'+(f.splitPercentA===50?"on":"")+'">均等 50/50</button>' +
            '<button type="button" data-rsplit="100" class="'+(f.splitPercentA===100?"on":"")+'">'+personName("personA")+'全額</button>' +
            '<button type="button" data-rsplit="0" class="'+(f.splitPercentA===0?"on":"")+'">'+personName("personB")+'全額</button>' +
          '</div></div>') : "") +
        '<button class="primary-btn" id="rSave">登録する</button>' +
        '<button class="ghost-btn" id="rCancelForm">キャンセル</button>';
    } else {
      html +=
        '<div class="section-title">'+personName(state.who)+'さんの個人固定費</div>' +
        recRowsHtml(state.recurringPersonal, "personal") +
        '<div class="section-title" style="margin-top:16px;">共有の固定費</div>' +
        recRowsHtml(state.recurringShared, "shared") +
        '<button class="primary-btn" id="rAddNew" style="margin-top:16px;">＋ 固定費を追加</button>' +
        '<button class="ghost-btn" id="rClose">閉じる</button>';
    }

    document.body.insertAdjacentHTML("beforeend", '<div class="scrim" id="recScrim"><div class="sheet">'+html+'</div></div>');
    wireRecurringManager();
  }
  function wireRecurringManager(){
    var s = recurringMgrState;
    document.getElementById("recScrim").addEventListener("click", function(e){ if(e.target.id==="recScrim") closeRecurringManager(); });

    if(!s.showForm){
      var closeBtn = document.getElementById("rClose");
      if(closeBtn) closeBtn.addEventListener("click", closeRecurringManager);
      var addBtn = document.getElementById("rAddNew");
      if(addBtn) addBtn.addEventListener("click", function(){ resetRecForm(); recurringMgrState.showForm = true; renderRecurringManager(); });
      document.querySelectorAll("[data-delrec]").forEach(function(btn){
        btn.addEventListener("click", async function(){
          await Store.deleteRecurring(btn.getAttribute("data-delrec"));
          renderRecurringManager();
        });
      });
    } else {
      var f = s.form;
      document.getElementById("rName").addEventListener("input", function(e){ f.name = e.target.value; });
      document.getElementById("rAmount").addEventListener("input", function(e){ f.amount = e.target.value; });
      document.querySelectorAll("[data-rcat]").forEach(function(b){
        b.addEventListener("click", function(){ f.category = b.getAttribute("data-rcat"); renderRecurringManager(); });
      });
      document.querySelectorAll("[data-rscope]").forEach(function(b){
        b.addEventListener("click", function(){ f.scope = b.getAttribute("data-rscope"); renderRecurringManager(); });
      });
      document.querySelectorAll("[data-rpaidby]").forEach(function(b){
        b.addEventListener("click", function(){ f.paidBy = b.getAttribute("data-rpaidby"); renderRecurringManager(); });
      });
      document.querySelectorAll("[data-rsplit]").forEach(function(b){
        b.addEventListener("click", function(){ f.splitPercentA = parseInt(b.getAttribute("data-rsplit"),10); renderRecurringManager(); });
      });
      document.getElementById("rCancelForm").addEventListener("click", function(){ recurringMgrState.showForm = false; renderRecurringManager(); });
      document.getElementById("rSave").addEventListener("click", async function(){
        var amt = parseInt(f.amount,10);
        if(!f.name.trim() || !amt || amt<=0) return;
        var data = { name:f.name.trim(), amount:amt, category:f.category, scope:f.scope, createdAt:new Date().toISOString() };
        if(f.scope==="personal") data.owner = state.who;
        else { data.paidBy = f.paidBy; data.splitPercentA = f.splitPercentA; }
        await Store.addRecurring(data);
        recurringMgrState.showForm = false;
        renderRecurringManager();
      });
    }
  }

  // ---------------- subscriptions ----------------
