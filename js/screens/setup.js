"use strict";

  function renderSetup(){
    root.innerHTML =
      '<div class="onboard">' +
        '<div class="hero-mark">'+ICON_WALLET+'</div>' +
        '<div>' +
          '<h1>ふたりの家計簿をはじめる</h1>' +
          '<p class="lead">自分の支出は自分で管理し、二人分の支出は自動で按分・精算できる家計簿です。まずはお二人の名前を登録してください。</p>' +
        '</div>' +
        '<div class="field"><label>あなたの名前</label><div class="field-with-color">' +
          '<input id="setupA" type="text" placeholder="例: もも" maxlength="12">' +
          '<input id="setupAColor" class="color-swatch-input" type="color" value="'+DEFAULT_PERSON_COLOR.personA+'" title="表示色">' +
        '</div></div>' +
        '<div class="field"><label>パートナーの名前</label><div class="field-with-color">' +
          '<input id="setupB" type="text" placeholder="例: ゆう" maxlength="12">' +
          '<input id="setupBColor" class="color-swatch-input" type="color" value="'+DEFAULT_PERSON_COLOR.personB+'" title="表示色">' +
        '</div></div>' +
        '<button class="primary-btn" id="setupGo">はじめる</button>' +
        (localMode ? '<div class="banner">現在ローカル保存モードです。このブラウザにのみ保存され、共有はされません。</div>' : '<div class="banner">二人のデータは共有され、どちらの端末からでも編集・閲覧できます。</div>') +
      '</div>';

    document.getElementById("setupGo").addEventListener("click", async function(){
      var a = document.getElementById("setupA").value.trim();
      var b = document.getElementById("setupB").value.trim();
      if(!a || !b) return;
      var colorA = document.getElementById("setupAColor").value;
      var colorB = document.getElementById("setupBColor").value;
      await Store.setProfile({ personAName:a, personBName:b, personAColor:colorA, personBColor:colorB, createdAt: new Date().toISOString() });
      applyPersonColors();
    });
  }

