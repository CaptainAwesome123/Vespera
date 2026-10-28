'use strict';
function start(data) {
  if (data && data.p) { player.p.set(...data.p); player.yaw = data.yaw; player.pitch = data.pitch; player.fly = data.fly; }
  build();
  $('enter').disabled = false;
  $('loading').textContent = isTouch ? 'Links ziehen zum Gehen, rechts zum Umsehen.' : 'Klicke, um die Maus zu fangen. Esc gibt sie frei.';
  requestAnimationFrame(t => { last = t; frame(t); });
}
window.claude?.hot?.snapshot?.(() => ({ p: player.p.toArray(), yaw: player.yaw, pitch: player.pitch, fly: player.fly }));

const fontsReady = (document.fonts && document.fonts.load)
  ? Promise.race([Promise.all([document.fonts.load('84px Limelight'), document.fonts.load('18px "Josefin Sans"')]), new Promise(r => setTimeout(r, 2500))])
  : Promise.resolve();
fontsReady.catch(() => {}).then(() => {
  const go = () => window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
  setTimeout(go, 30);
});
