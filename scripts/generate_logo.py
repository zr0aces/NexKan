import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Define path configurations
WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_DIR = os.path.join(WORKSPACE_DIR, "frontend/public")
os.makedirs(PUBLIC_DIR, exist_ok=True)

# Define Colors (RGBA)
BRAND_ORANGE_TOP = (255, 166, 0, 255)    # Amber/Orange #FFA600
BRAND_ORANGE_MID = (255, 107, 0, 255)    # Brand Orange #FF6B00
BRAND_ORANGE_BOT = (230, 57, 0, 255)     # Deep Red-Orange #E63900
SLATE_LIGHT = (15, 23, 42, 255)          # Slate-900 for Light Mode #0F172A
SLATE_DARK = (241, 245, 249, 255)        # Slate-100 for Dark Mode #F1F5F9
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# Hex Colors for SVGs
HEX_ORANGE = "#FF6B00"
HEX_SLATE_LIGHT = "#0F172A"
HEX_SLATE_DARK = "#F1F5F9"
HEX_BLACK = "#000000"
HEX_WHITE = "#FFFFFF"

# Font configurations
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def create_gradient_array(width, height, top_color, bot_color):
    """Fast vectorized gradient generator using numpy."""
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    for y in range(height):
        ratio = y / (height - 1) if height > 1 else 0
        arr[y, :, 0] = int(top_color[0] * (1 - ratio) + bot_color[0] * ratio)
        arr[y, :, 1] = int(top_color[1] * (1 - ratio) + bot_color[1] * ratio)
        arr[y, :, 2] = int(top_color[2] * (1 - ratio) + bot_color[2] * ratio)
        arr[y, :, 3] = int(top_color[3] * (1 - ratio) + bot_color[3] * ratio)
    return Image.fromarray(arr, 'RGBA')

def create_icon_image(variant="dark"):
    """
    Generate 2048x2048 (4x supersampling) icon image.
    variant: 'dark', 'light', 'mono_black', 'mono_white'
    """
    scale = 4
    canvas_size = 512 * scale
    img = Image.new('RGBA', (canvas_size, canvas_size), TRANSPARENT)

    # Gradient or solid color for the frame
    if variant in ("dark", "light"):
        frame_color_img = create_gradient_array(canvas_size, canvas_size, BRAND_ORANGE_TOP, BRAND_ORANGE_BOT)
    elif variant == "mono_black":
        frame_color_img = Image.new('RGBA', (canvas_size, canvas_size), BLACK)
    else: # mono_white
        frame_color_img = Image.new('RGBA', (canvas_size, canvas_size), WHITE)

    # Frame & dividers mask
    mask = Image.new('L', (canvas_size, canvas_size), 0)
    mask_draw = ImageDraw.Draw(mask)

    # Hexagon outer vertices (scaled)
    pts = [
        (256 * scale, 62 * scale),
        (422 * scale, 167 * scale),
        (422 * scale, 355 * scale),
        (256 * scale, 450 * scale),
        (90 * scale, 355 * scale),
        (90 * scale, 167 * scale),
    ]

    stroke_width = 28 * scale
    for i in range(len(pts)):
        p1 = pts[i]
        p2 = pts[(i + 1) % len(pts)]
        mask_draw.line([p1, p2], fill=255, width=stroke_width)
    for p in pts:
        r = (stroke_width // 2)
        mask_draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)

    # Vertical Column Dividers (detached from shield)
    v_w = 8 * scale
    mask_draw.line([(204 * scale, 160 * scale), (204 * scale, 390 * scale)], fill=255, width=v_w)
    mask_draw.line([(308 * scale, 160 * scale), (308 * scale, 390 * scale)], fill=255, width=v_w)
    for pt in [(204, 160), (204, 390), (308, 160), (308, 390)]:
        r = v_w // 2
        mask_draw.ellipse([pt[0] * scale - r, pt[1] * scale - r, pt[0] * scale + r, pt[1] * scale + r], fill=255)

    # Horizontal Column Header Dividers (detached from shield and dividers)
    h_w = 8 * scale
    h_lines = [
        ((116, 188), (196, 188)),
        ((216, 188), (296, 188)),
        ((316, 188), (396, 188)),
    ]
    for p1, p2 in h_lines:
        mask_draw.line([(p1[0] * scale, p1[1] * scale), (p2[0] * scale, p2[1] * scale)], fill=255, width=h_w)
        r = h_w // 2
        mask_draw.ellipse([p1[0] * scale - r, p1[1] * scale - r, p1[0] * scale + r, p1[1] * scale + r], fill=255)
        mask_draw.ellipse([p2[0] * scale - r, p2[1] * scale - r, p2[0] * scale + r, p2[1] * scale + r], fill=255)

    # Apply frame mask
    img.paste(frame_color_img, (0, 0), mask)

    # Draw 4 Kanban Cards
    draw = ImageDraw.Draw(img)
    cards = [
        (126 * scale, 212 * scale, (126 + 58) * scale, (212 + 52) * scale),
        (227 * scale, 212 * scale, (227 + 58) * scale, (212 + 52) * scale),
        (328 * scale, 212 * scale, (328 + 58) * scale, (212 + 52) * scale),
        (227 * scale, 282 * scale, (227 + 58) * scale, (282 + 52) * scale),
    ]

    if variant in ("dark", "light", "mono_white"):
        card_fill = WHITE
    else: # mono_black
        card_fill = BLACK

    for card in cards:
        draw.rounded_rectangle(card, radius=8 * scale, fill=card_fill)

    return img

def create_full_logo_image(variant="dark"):
    """Canvas size: 7680x2048 (4x of 1920x512)"""
    scale = 4
    canvas_w = 1920 * scale
    canvas_h = 512 * scale
    img = Image.new('RGBA', (canvas_w, canvas_h), TRANSPARENT)

    # Create icon and place on left
    icon = create_icon_image(variant=variant)
    icon_resized = icon.resize((canvas_h, canvas_h), Image.Resampling.LANCZOS)
    img.paste(icon_resized, (24 * scale, 0), icon_resized)

    # Draw Typography
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype(FONT_PATH, 240 * scale)
    except IOError:
        font = ImageFont.load_default()
        print("Warning: font not found. Using default font.")

    if variant == "dark":
        nex_color = SLATE_DARK
        kan_color = BRAND_ORANGE_MID
    elif variant == "light":
        nex_color = SLATE_LIGHT
        kan_color = BRAND_ORANGE_MID
    elif variant == "mono_black":
        nex_color = BLACK
        kan_color = BLACK
    else: # mono_white
        nex_color = WHITE
        kan_color = WHITE

    text_x = 520 * scale
    text_y = 256 * scale

    nex_width = draw.textlength("Nex", font=font)
    draw.text((text_x, text_y), "Nex", fill=nex_color, font=font, anchor="lm")
    draw.text((text_x + nex_width, text_y), "Kan", fill=kan_color, font=font, anchor="lm")

    return img

def generate_icon_svg(variant="dark"):
    if variant in ("dark", "light"):
        frame_stroke = "url(#brand-grad)"
        card_fill = "#FFFFFF"
        card_stroke_attr = 'stroke="#E2E8F0" stroke-width="2"' if variant == "light" else ""
    elif variant == "mono_black":
        frame_stroke = HEX_BLACK
        card_fill = HEX_BLACK
        card_stroke_attr = ""
    else: # mono_white
        frame_stroke = HEX_WHITE
        card_fill = HEX_WHITE
        card_stroke_attr = ""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="brand-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFA600" />
      <stop offset="50%" stop-color="#FF6B00" />
      <stop offset="100%" stop-color="#E63900" />
    </linearGradient>
  </defs>

  <!-- Outer Hexagonal Frame -->
  <path
    d="M 256,56 L 440,168 L 440,360 L 256,472 L 72,360 L 72,168 Z"
    stroke="{frame_stroke}"
    stroke-width="28"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Vertical Column Dividers (detached from shield) -->
  <line
    x1="204"
    y1="160"
    x2="204"
    y2="390"
    stroke="{frame_stroke}"
    stroke-width="8"
    stroke-linecap="round"
  />
  <line
    x1="308"
    y1="160"
    x2="308"
    y2="390"
    stroke="{frame_stroke}"
    stroke-width="8"
    stroke-linecap="round"
  />

  <!-- Horizontal Column Header Dividers (detached from shield and dividers) -->
  <line
    x1="116"
    y1="188"
    x2="196"
    y2="188"
    stroke="{frame_stroke}"
    stroke-width="8"
    stroke-linecap="round"
  />
  <line
    x1="216"
    y1="188"
    x2="296"
    y2="188"
    stroke="{frame_stroke}"
    stroke-width="8"
    stroke-linecap="round"
  />
  <line
    x1="316"
    y1="188"
    x2="396"
    y2="188"
    stroke="{frame_stroke}"
    stroke-width="8"
    stroke-linecap="round"
  />

  <!-- 4 Kanban Cards -->
  <rect x="126" y="212" width="58" height="52" rx="8" fill="{card_fill}" {card_stroke_attr}/>
  <rect x="227" y="212" width="58" height="52" rx="8" fill="{card_fill}" {card_stroke_attr}/>
  <rect x="328" y="212" width="58" height="52" rx="8" fill="{card_fill}" {card_stroke_attr}/>
  <rect x="227" y="282" width="58" height="52" rx="8" fill="{card_fill}" {card_stroke_attr}/>
</svg>
"""

def generate_full_logo_svg(variant="dark"):
    if variant == "dark":
        frame_stroke = "url(#brand-grad)"
        card_fill = "#FFFFFF"
        nex_fill = HEX_SLATE_DARK
        kan_fill = HEX_ORANGE
    elif variant == "light":
        frame_stroke = "url(#brand-grad)"
        card_fill = "#FFFFFF"
        nex_fill = HEX_SLATE_LIGHT
        kan_fill = HEX_ORANGE
    elif variant == "mono_black":
        frame_stroke = HEX_BLACK
        card_fill = HEX_BLACK
        nex_fill = HEX_BLACK
        kan_fill = HEX_BLACK
    else: # mono_white
        frame_stroke = HEX_WHITE
        card_fill = HEX_WHITE
        nex_fill = HEX_WHITE
        kan_fill = HEX_WHITE

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 512" fill="none">
  <defs>
    <linearGradient id="brand-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFA600" />
      <stop offset="50%" stop-color="#FF6B00" />
      <stop offset="100%" stop-color="#E63900" />
    </linearGradient>
  </defs>

  <!-- Icon Symbol on Left -->
  <g transform="translate(48, 16) scale(0.9375)">
    <!-- Outer Hexagonal Frame -->
    <path
      d="M 256,56 L 440,168 L 440,360 L 256,472 L 72,360 L 72,168 Z"
      stroke="{frame_stroke}"
      stroke-width="28"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Vertical Column Dividers (detached from shield) -->
    <line
      x1="204"
      y1="160"
      x2="204"
      y2="390"
      stroke="{frame_stroke}"
      stroke-width="8"
      stroke-linecap="round"
    />
    <line
      x1="308"
      y1="160"
      x2="308"
      y2="390"
      stroke="{frame_stroke}"
      stroke-width="8"
      stroke-linecap="round"
    />

    <!-- Horizontal Column Header Dividers (detached from shield and dividers) -->
    <line
      x1="116"
      y1="188"
      x2="196"
      y2="188"
      stroke="{frame_stroke}"
      stroke-width="8"
      stroke-linecap="round"
    />
    <line
      x1="216"
      y1="188"
      x2="296"
      y2="188"
      stroke="{frame_stroke}"
      stroke-width="8"
      stroke-linecap="round"
    />
    <line
      x1="316"
      y1="188"
      x2="396"
      y2="188"
      stroke="{frame_stroke}"
      stroke-width="8"
      stroke-linecap="round"
    />

    <!-- 4 Kanban Cards -->
    <rect x="126" y="212" width="58" height="52" rx="8" fill="{card_fill}" />
    <rect x="227" y="212" width="58" height="52" rx="8" fill="{card_fill}" />
    <rect x="328" y="212" width="58" height="52" rx="8" fill="{card_fill}" />
    <rect x="227" y="282" width="58" height="52" rx="8" fill="{card_fill}" />
  </g>

  <!-- Typography -->
  <text x="560" y="266" font-family="'Inter', 'Prompt', 'Kanit', -apple-system, sans-serif" font-weight="900" font-size="240" dominant-baseline="central">
    <tspan fill="{nex_fill}">Nex</tspan><tspan fill="{kan_fill}">Kan</tspan>
  </text>
</svg>
"""

def update_nexkan_png_with_white_cards():
    """Update frontend/public/nexkan.png so that square card icons are pure white with anti-aliasing preserved."""
    target_path = os.path.join(PUBLIC_DIR, "nexkan.png")
    if not os.path.exists(target_path):
        print(f"Warning: {target_path} not found.")
        return

    img = Image.open(target_path).convert('RGBA')
    arr = np.array(img)
    arr_modified = arr.copy()

    # Bounding boxes of the 4 cards in 248x248 image
    card_bboxes = [
        (62, 103, 90, 128),
        (109, 103, 137, 128),
        (157, 103, 185, 128),
        (109, 137, 137, 162)
    ]

    for x1, y1, x2, y2 in card_bboxes:
        region = arr_modified[y1:y2 + 1, x1:x2 + 1]
        for r in range(region.shape[0]):
            for c in range(region.shape[1]):
                px = region[r, c]
                if (px[:3] > 40).any():
                    brightness = min(1.0, max(px[0], px[1], px[2]) / 230.0)
                    val = int(255 * brightness)
                    region[r, c] = [val, val, val, 255]

    Image.fromarray(arr_modified).save(target_path, "PNG", optimize=True)
    print(f"Updated {target_path} with white cards!")

def main():
    print("1. Generating Vector SVG Assets...")
    with open(os.path.join(PUBLIC_DIR, "logo-icon-light.svg"), "w") as f:
        f.write(generate_icon_svg("light"))
    with open(os.path.join(PUBLIC_DIR, "logo-icon-dark.svg"), "w") as f:
        f.write(generate_icon_svg("dark"))
    with open(os.path.join(PUBLIC_DIR, "logo-icon-mono-black.svg"), "w") as f:
        f.write(generate_icon_svg("mono_black"))
    with open(os.path.join(PUBLIC_DIR, "logo-icon-mono-white.svg"), "w") as f:
        f.write(generate_icon_svg("mono_white"))
    with open(os.path.join(PUBLIC_DIR, "favicon.svg"), "w") as f:
        f.write(generate_icon_svg("dark"))

    with open(os.path.join(PUBLIC_DIR, "logo-full-light.svg"), "w") as f:
        f.write(generate_full_logo_svg("light"))
    with open(os.path.join(PUBLIC_DIR, "logo-full-dark.svg"), "w") as f:
        f.write(generate_full_logo_svg("dark"))
    with open(os.path.join(PUBLIC_DIR, "logo-full-mono-black.svg"), "w") as f:
        f.write(generate_full_logo_svg("mono_black"))
    with open(os.path.join(PUBLIC_DIR, "logo-full-mono-white.svg"), "w") as f:
        f.write(generate_full_logo_svg("mono_white"))

    print("2. Generating Raster PNG Assets...")
    icon_light = create_icon_image("light")
    icon_dark = create_icon_image("dark")
    icon_mono_black = create_icon_image("mono_black")
    icon_mono_white = create_icon_image("mono_white")

    icon_light.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-icon-light.png"), "PNG", optimize=True)
    icon_dark.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-icon-dark.png"), "PNG", optimize=True)
    icon_mono_black.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-icon-mono-black.png"), "PNG", optimize=True)
    icon_mono_white.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-icon-mono-white.png"), "PNG", optimize=True)

    # Primary brand logo.png (512x512)
    icon_dark.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo.png"), "PNG", optimize=True)

    full_light = create_full_logo_image("light")
    full_dark = create_full_logo_image("dark")
    full_mono_black = create_full_logo_image("mono_black")
    full_mono_white = create_full_logo_image("mono_white")

    full_light.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-light.png"), "PNG", optimize=True)
    full_dark.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-dark.png"), "PNG", optimize=True)
    full_mono_black.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-mono-black.png"), "PNG", optimize=True)
    full_mono_white.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-mono-white.png"), "PNG", optimize=True)

    print("3. Generating Favicon & Web App Icons...")
    sizes = [16, 32, 48, 96, 180, 192, 512]
    png_icons = {s: icon_dark.resize((s, s), Image.Resampling.LANCZOS) for s in sizes}

    png_icons[16].save(os.path.join(PUBLIC_DIR, "favicon-16x16.png"), "PNG", optimize=True)
    png_icons[32].save(os.path.join(PUBLIC_DIR, "favicon-32x32.png"), "PNG", optimize=True)
    png_icons[96].save(os.path.join(PUBLIC_DIR, "favicon-96x96.png"), "PNG", optimize=True)
    png_icons[180].save(os.path.join(PUBLIC_DIR, "apple-touch-icon.png"), "PNG", optimize=True)
    png_icons[192].save(os.path.join(PUBLIC_DIR, "web-app-manifest-192x192.png"), "PNG", optimize=True)
    png_icons[512].save(os.path.join(PUBLIC_DIR, "web-app-manifest-512x512.png"), "PNG", optimize=True)

    # Save multi-resolution favicon.ico
    ico_16 = png_icons[16]
    ico_32 = png_icons[32]
    ico_48 = png_icons[48]
    ico_16.save(
        os.path.join(PUBLIC_DIR, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[ico_32, ico_48]
    )

    print("4. Updating frontend/public/nexkan.png with white square icons...")
    update_nexkan_png_with_white_cards()

    print("All branding assets generated successfully!")

if __name__ == "__main__":
    main()

