"use strict";

  function renderWhoAmI(){
    root.innerHTML =
      '<div class="onboard">' +
        '<div class="hero-mark">'+ICON_WALLET+'</div>' +
        '<div><h1>あなたはどちら？</h1><p class="lead">この端末でのあなたを選んでください。あとから右上でいつでも切り替えられます。</p></div>' +
        '<div class="who-grid">' +
          '<button class="who-card" data-who="personA"><span class="big-dot" style="background:'+personColorHex("personA")+'">'+ICON_PERSON+'</span>'+ (state.profile.personAName||"Aさん") +'</button>' +
          '<button class="who-card" data-who="personB"><span class="big-dot" style="background:'+personColorHex("personB")+'">'+ICON_PERSON+'</span>'+ (state.profile.personBName||"Bさん") +'</button>' +
        '</div>' +
      '</div>';
    root.querySelectorAll(".who-card").forEach(function(btn){
      btn.addEventListener("click", function(){
        state.who = btn.getAttribute("data-who");
        try{ localStorage.setItem("kakeibo_who", state.who); }catch(e){}
        subscribeAll();
        render();
      });
    });
  }

