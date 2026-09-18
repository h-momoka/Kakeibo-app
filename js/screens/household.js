"use strict";

  // Small account panel (invite code + logout), opened from the "who" pill
  // in the dashboard header when running in authMode. Replaces the old
  // "switch who" behavior, which would otherwise let one signed-in person
  // silently act as the other — see dashboard.js's whoPill handler.
  var accountPanelState = { inviteCode: null, partnerJoined: false, loaded: false };

  function accountPanelHtml(){
    var s = accountPanelState;
    return '<h3>アカウント</h3>' +
      '<p class="imp-lead">'+escapeHtml((sessionUser && sessionUser.email) || "")+' でログイン中（'+personName(state.who)+'）</p>' +
      (s.loaded ?
        ('<div class="field"><label>'+(s.partnerJoined ? "招待コード" : "パートナーを招待")+'</label>' +
          '<div class="chiprow"><button type="button" id="acctCopyInvite">'+escapeHtml(s.inviteCode||"")+'</button></div>' +
          '<p class="imp-lead">'+(s.partnerJoined ? "パートナーは参加済みです。" : "このコードをパートナーに伝え、「招待コードで参加」から登録してもらってください。") +'</p>' +
        '</div>')
        : '<p class="imp-lead">読み込み中…</p>') +
      '<button class="ghost-btn" id="acctLogout">ログアウト</button>' +
      '<button class="ghost-btn" id="acctClose">閉じる</button>';
  }

  function renderAccountPanel(){
    var old = document.getElementById("acctScrim");
    if(old) old.remove();
    document.body.insertAdjacentHTML("beforeend", '<div class="scrim" id="acctScrim"><div class="sheet">'+accountPanelHtml()+'</div></div>');
    document.getElementById("acctScrim").addEventListener("click", function(e){ if(e.target.id==="acctScrim") closeAccountPanel(); });
    document.getElementById("acctClose").addEventListener("click", closeAccountPanel);
    document.getElementById("acctLogout").addEventListener("click", async function(){
      try{ await apiFetch("/api/auth/logout", { method:"POST" }); }catch(e){}
      location.reload();
    });
    var copyBtn = document.getElementById("acctCopyInvite");
    if(copyBtn) copyBtn.addEventListener("click", function(){
      if(navigator.clipboard) navigator.clipboard.writeText(accountPanelState.inviteCode).catch(function(){});
    });
  }
  function closeAccountPanel(){
    var scrim = document.getElementById("acctScrim");
    if(scrim) scrim.remove();
  }
  async function openAccountPanel(){
    accountPanelState = { inviteCode:null, partnerJoined:false, loaded:false };
    renderAccountPanel();
    try{
      var info = await apiFetch("/api/household/invite-code");
      accountPanelState = { inviteCode: info.inviteCode, partnerJoined: info.partnerJoined, loaded: true };
      if(document.getElementById("acctScrim")) renderAccountPanel();
    }catch(e){}
  }
