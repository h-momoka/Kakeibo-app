"use strict";

  // Signed-out gate for the public app (authMode). Shown instead of the old
  // renderSetup()/renderWhoAmI() flow until a session cookie exists; once
  // signed in, onSignedIn() (in app.js) takes over and the rest of the app
  // behaves exactly as before.
  var authScreenState = { mode: "login", error: "", loading: false };

  function renderAuthGate(){
    var s = authScreenState;
    var isSignup = s.mode === "signup";
    var isJoin = s.mode === "join";
    root.innerHTML =
      '<div class="onboard">' +
        '<div class="hero-mark">'+ICON_WALLET+'</div>' +
        '<div><h1>ふたりの家計簿</h1><p class="lead">' +
          (isSignup ? "新しく世帯を作成します。あとでパートナーを招待コードで招待できます。" :
           isJoin ? "パートナーから受け取った招待コードで参加します。" :
           "ログインしてください。") +
        '</p></div>' +
        '<div class="chiprow">' +
          '<button type="button" data-mode="login" class="'+(s.mode==="login"?"on":"")+'">ログイン</button>' +
          '<button type="button" data-mode="signup" class="'+(s.mode==="signup"?"on":"")+'">新規登録</button>' +
          '<button type="button" data-mode="join" class="'+(s.mode==="join"?"on":"")+'">招待コードで参加</button>' +
        '</div>' +
        '<div class="field"><label>メールアドレス</label><input id="authEmail" type="email" autocomplete="username" placeholder="you@example.com"></div>' +
        '<div class="field"><label>パスワード</label><input id="authPassword" type="password" autocomplete="'+((isSignup||isJoin)?"new-password":"current-password")+'" placeholder="8文字以上"></div>' +
        (isJoin ? '<div class="field"><label>招待コード</label><input id="authInviteCode" type="text" placeholder="例: AB12CD34"></div>' : '') +
        (s.error ? '<p class="imp-lead" style="color:var(--warn); margin-top:-4px;">'+escapeHtml(s.error)+'</p>' : '') +
        '<button class="primary-btn" id="authGo" '+(s.loading?"disabled":"")+'>' +
          (s.loading ? "送信しています…" : (isSignup ? "世帯を作成" : isJoin ? "参加する" : "ログイン")) +
        '</button>' +
      '</div>';

    root.querySelectorAll("[data-mode]").forEach(function(b){
      b.addEventListener("click", function(){
        authScreenState = { mode: b.getAttribute("data-mode"), error: "", loading: false };
        renderAuthGate();
      });
    });
    document.getElementById("authGo").addEventListener("click", submitAuthGate);
    root.querySelectorAll("#authEmail, #authPassword, #authInviteCode").forEach(function(el){
      el.addEventListener("keydown", function(e){ if(e.key === "Enter") submitAuthGate(); });
    });
  }

  function authErrorMessage(code){
    switch(code){
      case "invalid_credentials": return "メールアドレスまたはパスワードが違います。";
      case "email_taken": return "このメールアドレスは既に使われています。";
      case "invite_code_not_found": return "招待コードが見つかりません。もう一度確認してください。";
      case "household_full": return "この世帯には既にもう一人参加しています。";
      case "invalid_input": return "入力内容をご確認ください（パスワードは8文字以上）。";
      case "network_error": return "通信エラーが発生しました。もう一度お試しください。";
      default: return "エラーが発生しました。もう一度お試しください。";
    }
  }

  async function submitAuthGate(){
    var s = authScreenState;
    var emailEl = document.getElementById("authEmail");
    var passwordEl = document.getElementById("authPassword");
    var inviteEl = document.getElementById("authInviteCode");
    var email = emailEl ? emailEl.value.trim() : "";
    var password = passwordEl ? passwordEl.value : "";
    var inviteCode = (s.mode==="join" && inviteEl) ? inviteEl.value.trim() : null;

    if(!email || !password || (s.mode==="join" && !inviteCode)){
      s.error = "すべての項目を入力してください。";
      renderAuthGate();
      return;
    }
    s.loading = true; s.error = "";
    renderAuthGate();
    try{
      var path = s.mode==="login" ? "/api/auth/login" : s.mode==="signup" ? "/api/auth/signup" : "/api/auth/join";
      var body = s.mode==="join" ? { email:email, password:password, inviteCode:inviteCode } : { email:email, password:password };
      sessionUser = await apiFetch(path, { method:"POST", body: body });
      onSignedIn();
    }catch(err){
      s.loading = false;
      s.error = authErrorMessage(err && err.code);
      renderAuthGate();
    }
  }
