# Conteúdo das redes sociais (Instagram e Facebook)

Imagens e vídeos dos posts diários do Cuidar, servidos pelo GitHub Pages em
`https://vendra74.github.io/WaterApp/social/` para a API de publicação da Meta buscar.

- `calendario.json`: os posts (data, legenda, formato). Fonte editada em `/mnt/project-files/cuidar/social/` e copiada para cá a cada lote.
- `imagens/dia-NN-feed.jpg` (1080×1080) e `imagens/dia-NN-story.jpg` (1080×1920); JPEG porque a API do Instagram só aceita esse formato.
- `reels/cartela-reel-NN.mp4`: vídeo de reserva dos reels; um `reels/reel-NN.mp4` gravado no aparelho, quando existir, é indicado no calendário pelo campo `video`.
- O script que publica está em `scripts/social/publicar_meta.py` (`--dry-run` mostra o post do dia sem publicar).

Nada aqui é código do app; a pasta `docs/` é só o site público.
