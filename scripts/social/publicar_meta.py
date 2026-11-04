#!/usr/bin/env python3
"""Publica o post do dia no Instagram e na Página do Facebook pela Graph API da Meta.

Uso:
  python3 publicar_meta.py --dry-run            # mostra o que seria publicado hoje
  python3 publicar_meta.py --dia 3 --dry-run     # idem, para o dia 3 do calendário
  python3 publicar_meta.py                       # publica de verdade (precisa das variáveis abaixo)

Variáveis de ambiente (nunca gravar no repositório):
  META_ACCESS_TOKEN   token de usuário do sistema (Business Manager) ou token de página de longa duração
  META_IG_USER_ID     id da conta profissional do Instagram
  META_PAGE_ID        id da Página do Facebook ligada à conta do Instagram
  SOCIAL_BASE_URL     URL pública onde as imagens/vídeos estão hospedados,
                      ex.: https://vendra74.github.io/WaterApp/social
  SOCIAL_CALENDARIO   caminho do calendario.json (padrão: docs/social/calendario.json deste repositório)
  SOCIAL_LOG          arquivo .jsonl onde registrar o que foi publicado (padrão: ao lado do calendário)

A Meta busca a mídia por URL pública na hora de publicar. As imagens e os vídeos ficam em docs/social/ deste
repositório, servidos pelo GitHub Pages em https://vendra74.github.io/WaterApp/social/ (SOCIAL_BASE_URL).
O calendário e as imagens são gerados em /mnt/project-files/cuidar/social/ e copiados para cá a cada lote.
"""
import argparse, datetime, json, os, sys, time, urllib.parse, urllib.request

GRAPH = "https://graph.facebook.com/v22.0"


def call(method, path, **params):
    tok = os.environ["META_ACCESS_TOKEN"]
    params["access_token"] = tok
    data = urllib.parse.urlencode(params).encode()
    url = f"{GRAPH}/{path}"
    if method == "GET":
        url += "?" + data.decode(); data = None
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise SystemExit(f"Graph API {e.code} em {path}: {body}")


def post_for_day(cal, dia=None, data=None):
    for p in cal["posts"]:
        if dia is not None and p["dia"] == dia:
            return p
        if dia is None and p["data"] == data:
            return p
    return None


def legenda(cal, p):
    perfil = cal["perfil"]
    return p["legenda"].replace("{cta}", perfil["cta_padrao"]).replace("{hashtags}", perfil["hashtags_base"])


def esperar_container(cid):
    for _ in range(60):  # até ~10 min
        st = call("GET", cid, fields="status_code,status")
        if st.get("status_code") == "FINISHED":
            return
        if st.get("status_code") == "ERROR":
            raise SystemExit(f"Container {cid} com erro: {st}")
        time.sleep(10)
    raise SystemExit(f"Container {cid} não ficou pronto a tempo")


def publicar_instagram(p, texto, base):
    ig = os.environ["META_IG_USER_ID"]
    n = f"{p['dia']:02d}"
    if p["formato"] == "reel":
        video = p.get("video") or f"reels/cartela-reel-{n}.mp4"
        c = call("POST", f"{ig}/media", media_type="REELS", video_url=f"{base}/{video}",
                 cover_url=f"{base}/imagens/dia-{n}-story.png", caption=texto, share_to_feed="true")
    else:
        c = call("POST", f"{ig}/media", image_url=f"{base}/imagens/dia-{n}-feed.png", caption=texto)
    esperar_container(c["id"])
    r = call("POST", f"{ig}/media_publish", creation_id=c["id"])
    return r["id"]


def publicar_facebook(p, texto, base):
    page = os.environ["META_PAGE_ID"]
    n = f"{p['dia']:02d}"
    if p["formato"] == "reel":
        video = p.get("video") or f"reels/cartela-reel-{n}.mp4"
        r = call("POST", f"{page}/videos", file_url=f"{base}/{video}", description=texto)
    else:
        r = call("POST", f"{page}/photos", url=f"{base}/imagens/dia-{n}-feed.png", message=texto)
    return r.get("post_id") or r.get("id")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dia", type=int)
    ap.add_argument("--data", help="YYYY-MM-DD (padrão: hoje em America/Sao_Paulo)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--so", choices=["instagram", "facebook"], help="publicar só numa rede")
    a = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    candidatos = [os.environ.get("SOCIAL_CALENDARIO"),
                  os.path.join(here, "..", "..", "docs", "social", "calendario.json"),
                  os.path.join(here, "..", "calendario.json")]
    cal_path = next(c for c in candidatos if c and os.path.exists(c))
    cal = json.load(open(cal_path, encoding="utf-8"))
    if a.dia is None and a.data is None:
        try:
            from zoneinfo import ZoneInfo
            a.data = datetime.datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()
        except Exception:
            a.data = datetime.date.today().isoformat()
    p = post_for_day(cal, a.dia, a.data)
    if not p:
        print(f"Nenhum post no calendário para {a.dia or a.data}. Nada a publicar.")
        return 0
    texto = legenda(cal, p)
    print(f"Dia {p['dia']} ({p['data']}) · {p['formato']} · {p['titulo']}\n---\n{texto}\n---")
    if a.dry_run:
        print("(dry-run: nada publicado)")
        return 0
    base = os.environ["SOCIAL_BASE_URL"].rstrip("/")
    log = {}
    if a.so in (None, "instagram"):
        log["instagram"] = publicar_instagram(p, texto, base)
    if a.so in (None, "facebook"):
        log["facebook"] = publicar_facebook(p, texto, base)
    print("Publicado:", json.dumps(log))
    hist = os.environ.get("SOCIAL_LOG") or os.path.join(os.path.dirname(cal_path), "publicados.jsonl")
    with open(hist, "a", encoding="utf-8") as f:
        f.write(json.dumps({"quando": datetime.datetime.now().isoformat(timespec="seconds"), "dia": p["dia"], **log}, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
