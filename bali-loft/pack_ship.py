#!/usr/bin/env python3
"""Build the phone package: a small HTML shell plus <=12KB script chunks.

iPhone browsers (including the Cursor in-app web view) can leave fetch()
unresolved, so the loader injects classic <script src> tags instead, with a
timeout and one retry. The game and voice files stay separate modules that
are assembled in the page and started as inline module scripts.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAX_CHUNK = 12000
# Keep the loader's closing tag before a ~15KB cut, even after the host
# appends its beacon (about 400 bytes) past our script.
SCRIPT_END_LIMIT = 15280

LOADER = """<script>
(function(){
var B=document.getElementById("boot"),done=0,bad=0,base=new URL(".",location).href;
function say(t){if(B&&!bad)B.textContent=t}
function one(u,slot,bag,left){return new Promise(function(ok,no){
var s=document.createElement("script"),fin=0,tm=setTimeout(die,12e3);
function die(){if(fin)return;fin=1;clearTimeout(tm);try{s.remove()}catch(e){}
if(bag[slot]!=null)return ok();left>1?one(u.split("?")[0]+"?r="+left,slot,bag,left-1).then(ok,no):no(0)}
s.onload=function(){if(fin)return;bag[slot]!=null?(fin=1,clearTimeout(tm),ok()):die()};s.onerror=die;s.src=u;document.head.appendChild(s)})}
function cat(p,n,bag){var i=0;function w(){var k=i++;return k<n?one(base+p+("0"+k).slice(-2)+".js",k,bag,3).then(function(){say("Загрузка острова "+(++done)+"/__T__"),w()}):Promise.resolve()}
return Promise.all([w(),w()])}
function mod(code,flag){return new Promise(function(ok,no){var s=document.createElement("script");s.type="module";s.textContent=code+";window."+flag+"=1;";var c=0,t=setInterval(function(){if(window[flag]){clearInterval(t);ok()}else if(++c>200){clearInterval(t);no(0)}},200);s.onerror=function(){clearInterval(t);no(0)};document.body.appendChild(s)})}
say("Загрузка острова 0/__T__");
cat("c",__G__,self.__g=[]).then(function(){say("Запуск острова…");return mod(self.__g.join(""),"__islandBooted")}).then(function(){return cat("v",__V__,self.__v=[])}).then(function(){return mod(self.__v.join(""),"__voiceBooted")}).catch(function(){bad=1;B&&(B.style.zIndex="80",B.textContent="Не удалось загрузить остров. Обновите страницу.")});
})();
</script>
"""


def module_body(html: str) -> str:
    start = html.find('<script type="module" crossorigin>')
    if start < 0:
        raise SystemExit("game module script not found")
    start = html.find(">", start) + 1
    end = html.find("</script>", start)
    if end < 0:
        raise SystemExit("game module script is not closed")
    return html[start:end]


def js_string(text: str) -> str:
    payload = json.dumps(text, ensure_ascii=False)
    return payload.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def wrap(var: str, index: int, text: str) -> bytes:
    js = f"(self.{var}=self.{var}||[])[{index}]={js_string(text)};"
    return js.encode("utf-8")


def split_source(text: str, var: str) -> list[bytes]:
    chunks = []
    i = 0
    n = len(text)
    while i < n:
        lo, hi = i + 1, n
        best = None
        while lo <= hi:
            mid = (lo + hi) // 2
            blob = wrap(var, len(chunks), text[i:mid])
            if len(blob) <= MAX_CHUNK:
                best = mid
                lo = mid + 1
            else:
                hi = mid - 1
        if best is None:
            raise SystemExit(f"cannot fit a chunk of {var} at {i}")
        chunks.append(wrap(var, len(chunks), text[i:best]))
        i = best
    return chunks


def shell_html(html: str, loader: str) -> str:
    page = re.sub(
        r'<script type="module" crossorigin>.*?</script>',
        "",
        html,
        count=1,
        flags=re.S,
    )
    page = re.sub(
        r'\s*<script type="module" src="\./voice\.js"></script>\s*',
        "",
        page,
        count=1,
    )
    page = page.replace('<link rel="manifest" href="./manifest.webmanifest" />', "")
    page = page.replace('<link rel="manifest" href="./manifest.webmanifest"/>', "")
    styles = []

    def hold(match):
        styles.append(match.group(0))
        return f"__STYLE{len(styles) - 1}__"

    page = re.sub(r"<style\b[^>]*>.*?</style>", hold, page, flags=re.S)
    page = re.sub(r"\s+", " ", page)
    page = re.sub(r">\s+<", "><", page)
    page = re.sub(r"\s+>", ">", page)
    page = re.sub(r"\s+/", "/", page)
    for n, style in enumerate(styles):
        css_open = style.find(">") + 1
        css_close = style.rfind("</style>")
        css = re.sub(r"\s+", " ", style[css_open:css_close]).strip()
        css = css.replace(")and(", ") and (")
        style = style[:css_open] + css + style[css_close:]
        page = page.replace(f"__STYLE{n}__", style)
    page = page.replace("</body>", loader + "</body>")
    return page


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/island3d-ios4")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    voice = (ROOT / "voice.js").read_text(encoding="utf-8")
    game = module_body(html)
    game_chunks = split_source(game, "__g")
    voice_chunks = split_source(voice, "__v")
    total = len(game_chunks) + len(voice_chunks)
    if len(game_chunks) > 99 or len(voice_chunks) > 99:
        raise SystemExit("too many chunks for two-digit names")
    loader = (
        LOADER.replace("__T__", str(total))
        .replace("__G__", str(len(game_chunks)))
        .replace("__V__", str(len(voice_chunks)))
    )
    if "fetch(" in loader:
        raise SystemExit("loader must not call fetch")
    page = shell_html(html, loader)
    script_at = page.rfind("<script>")
    script_end = page.find("</script>", script_at) + len("</script>")
    raw = page.encode("utf-8")
    # script_end is a character offset; the shell is mostly ASCII before the
    # Russian strings, so measure in bytes from the encoded prefix.
    script_end_bytes = len(page[:script_end].encode("utf-8"))
    print(f"shell {len(raw)} bytes, script ends at {script_end_bytes}, chunks {len(game_chunks)}+{len(voice_chunks)}")
    if script_end_bytes > SCRIPT_END_LIMIT:
        raise SystemExit(f"loader ends at {script_end_bytes}, past {SCRIPT_END_LIMIT}")
    for blob in game_chunks + voice_chunks:
        if len(blob) > MAX_CHUNK:
            raise SystemExit("chunk exceeds 12KB")
    loader_js = loader.replace("<script>", "").replace("</script>", "")
    Path("/tmp/loader-check.js").write_text(loader_js, encoding="utf-8")
    subprocess.run(["node", "--check", "/tmp/loader-check.js"], check=True)
    Path("/tmp/round-g.js").write_text(
        "var self={};\n" + b"\n".join(game_chunks).decode("utf-8") + "\nprocess.stdout.write(self.__g.join(''))",
        encoding="utf-8",
    )
    joined_game = subprocess.check_output(["node", "/tmp/round-g.js"]).decode("utf-8")
    if joined_game != game:
        raise SystemExit(f"game roundtrip mismatch {len(joined_game)} vs {len(game)}")
    Path("/tmp/round-v.js").write_text(
        "var self={};\n" + b"\n".join(voice_chunks).decode("utf-8") + "\nprocess.stdout.write(self.__v.join(''))",
        encoding="utf-8",
    )
    joined_voice = subprocess.check_output(["node", "/tmp/round-v.js"]).decode("utf-8")
    if joined_voice != voice:
        raise SystemExit("voice roundtrip mismatch")
    check = Path("/tmp/game-check.js")
    check.write_text(game, encoding="utf-8")
    subprocess.run(["node", "--check", str(check)], check=True)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    (out / "index.html").write_bytes(raw)
    for i, blob in enumerate(game_chunks):
        (out / f"c{i:02d}.js").write_bytes(blob)
    for i, blob in enumerate(voice_chunks):
        (out / f"v{i:02d}.js").write_bytes(blob)
    print(f"wrote {out} ({1 + total} files)")


if __name__ == "__main__":
    main()
