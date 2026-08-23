from PIL import Image, ImageDraw, ImageFont

FONTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BRANCO = (255, 255, 255)
VERDE = (22, 163, 74)
ESCURO = (15, 23, 42)

def criar(tamanho, caminho):
    img = Image.new("RGB", (tamanho, tamanho), ESCURO)
    d = ImageDraw.Draw(img)
    margem = int(tamanho * 0.06)

    d.rounded_rectangle(
        [margem, margem, tamanho - margem, tamanho - margem],
        radius=int(tamanho * 0.2),
        fill=ESCURO,
        outline=VERDE,
        width=max(2, int(tamanho * 0.02)),
    )

    fonte = ImageFont.truetype(FONTE, int(tamanho * 0.4))
    texto_p, texto_o = "P", "O"
    largura_p = d.textlength(texto_p, font=fonte)
    largura_o = d.textlength(texto_o, font=fonte)
    espaco = int(tamanho * 0.03)
    total = largura_p + espaco + largura_o
    x_inicial = (tamanho - total) / 2

    bbox = d.textbbox((0, 0), "PO", font=fonte)
    y = tamanho / 2 - (bbox[3] - bbox[1]) / 2 - bbox[1]

    d.text((x_inicial, y), texto_p, font=fonte, fill=BRANCO)
    d.text((x_inicial + largura_p + espaco, y), texto_o, font=fonte, fill=VERDE)

    img.save(caminho, "PNG")
    print(f"ok: {caminho}")

criar(192, "icons/icon-192.png")
criar(512, "icons/icon-512.png")
