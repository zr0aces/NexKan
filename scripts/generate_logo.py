import os
import math
from PIL import Image, ImageDraw, ImageFont

# Define path configurations
WORKSPACE_DIR = "/home/san/workspace/NexKan"
PUBLIC_DIR = os.path.join(WORKSPACE_DIR, "frontend/public")
os.makedirs(PUBLIC_DIR, exist_ok=True)

# Define Colors (RGBA)
ORANGE = (255, 107, 0, 255)       # Premium Orange #FF6B00
SLATE_LIGHT = (15, 23, 42, 255)    # Slate-900 for Light Mode #0F172A
SLATE_DARK = (241, 245, 249, 255)  # Slate-100 for Dark Mode #F1F5F9
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

def draw_gradient_rounded_rect(img, bbox, radius, start_color, end_color):
    x0, y0, x1, y1 = bbox
    w = x1 - x0
    h = y1 - y0
    # Create gradient image
    grad_img = Image.new('RGBA', (w, h))
    for y in range(h):
        ratio = y / (h - 1) if h > 1 else 0
        r = int(start_color[0] + (end_color[0] - start_color[0]) * ratio)
        g = int(start_color[1] + (end_color[1] - start_color[1]) * ratio)
        b = int(start_color[2] + (end_color[2] - start_color[2]) * ratio)
        a = int(start_color[3] + (end_color[3] - start_color[3]) * ratio)
        for x in range(w):
            grad_img.putpixel((x, y), (r, g, b, a))
            
    # Create mask for rounded rect
    mask = Image.new('L', (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    
    # Paste gradient onto main image using mask
    img.paste(grad_img, (x0, y0), mask)

def create_icon_image(fg_color, bg_color, is_mono=False):
    # Base canvas (4x supersampling: 2048x2048)
    img = Image.new('RGBA', (2048, 2048), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    
    r, g, b, a = fg_color
    
    # Page Frame background fill:
    # Light Mode: solid white page frame
    # Dark Mode: solid slate-800 page frame (30, 41, 59, 255)
    if is_mono:
        page_fill = WHITE if fg_color == BLACK else BLACK
    else:
        page_fill = WHITE if fg_color == SLATE_LIGHT else (30, 41, 59, 255)
        
    # 1. Page Frame: x=(432, 1712), y=(256, 1792), rx=96, stroke_width=64
    draw.rounded_rectangle((432, 256, 1712, 1792), radius=96, fill=page_fill, outline=fg_color, width=64)
    
    # 2. Spiral Loops and Punch Holes
    # Loop centers at cy: 448, 720, 992, 1264, 1536
    for cy in [448, 720, 992, 1264, 1536]:
        # Draw ring loop capsule (x from 336 to 496, y from cy-24 to cy+24, rx=24)
        draw.rounded_rectangle((336, cy - 24, 496, cy + 24), radius=24, fill=fg_color)
        # Punch hole circle at cx=496, cy=cy, r=16 (opacity 0.4)
        hole_color = (r, g, b, int(255 * 0.4))
        draw.ellipse((496 - 16, cy - 16, 496 + 16, cy + 16), fill=hole_color)
        
    # 3. Standard Cards
    card_fill = (r, g, b, int(255 * 0.2))
    card_stroke = (r, g, b, int(255 * 0.35))
    
    # Column 1 (Todo) Cards
    draw.rounded_rectangle((544, 416, 848, 672), radius=32, fill=card_fill, outline=card_stroke, width=8)
    draw.rounded_rectangle((544, 736, 848, 992), radius=32, fill=card_fill, outline=card_stroke, width=8)
    draw.rounded_rectangle((544, 1056, 848, 1312), radius=32, fill=card_fill, outline=card_stroke, width=8)
    
    # Column 2 Standard Card
    draw.rounded_rectangle((896, 1120, 1200, 1376), radius=32, fill=card_fill, outline=card_stroke, width=8)
    
    # Column 3 Standard Cards
    draw.rounded_rectangle((1264, 416, 1568, 672), radius=32, fill=card_fill, outline=card_stroke, width=8)
    draw.rounded_rectangle((1264, 736, 1568, 1056), radius=32, fill=card_fill, outline=card_stroke, width=8)
    draw.rounded_rectangle((1264, 1120, 1568, 1376), radius=32, fill=card_fill, outline=card_stroke, width=8)
    
    # Checkmark inside Column 3 Card 2 (completed checkmark badge)
    # Circle at cx=1416, cy=896, r=56, fill=#10B981 (16, 185, 129)
    draw.ellipse((1416 - 56, 896 - 56, 1416 + 56, 896 + 56), fill=(16, 185, 129, 255))
    # Checkmark path at 4x: [(1388, 896), (1408, 916), (1444, 876)]
    draw.line([(1388, 896), (1408, 916), (1444, 876)], fill=(255, 255, 255, 255), width=16, joint="round")
    
    # 4. Active Orange Card with Cutout Paper Airplane
    card_layer = Image.new('RGBA', (2048, 2048), TRANSPARENT)
    if is_mono:
        card_draw = ImageDraw.Draw(card_layer)
        card_draw.rounded_rectangle((896, 576, 1216, 1056), radius=40, fill=fg_color)
    else:
        draw_gradient_rounded_rect(card_layer, (896, 576, 1216, 1056), radius=40,
                                   start_color=(255, 158, 0, 255), end_color=(255, 61, 0, 255))
                                   
    # Mask for airplane cutout
    airplane_mask = Image.new('L', (2048, 2048), 255)
    
    # Draw airplane on temporary 512x512 layer centered at (256, 256)
    plane_temp = Image.new('L', (512, 512), 0)
    plane_temp_draw = ImageDraw.Draw(plane_temp)
    # Airplane coordinates: M 0,-88 L 72,56 L 0,20 L -72,56 Z
    plane_temp_draw.polygon([(256, 256 - 88), (256 + 72, 256 + 56), (256, 256 + 20), (256 - 72, 256 + 56)], fill=255)
    # White crease line in mask (which means black crease in plane_temp)
    plane_temp_draw.line([(256, 256 - 88), (256, 256 + 20)], fill=0, width=8)
    
    # Rotate by 45 degrees clockwise (-45 in PIL)
    rotated_plane = plane_temp.rotate(-45, resample=Image.Resampling.BICUBIC, center=(256, 256))
    
    # Paste plane onto mask at (1056, 816) (which is x=800, y=560 in top-left)
    airplane_mask.paste(0, (800, 560), rotated_plane)
    
    # Combine masked active card
    masked_card = Image.new('RGBA', (2048, 2048), TRANSPARENT)
    masked_card.paste(card_layer, (0, 0), airplane_mask)
    img.alpha_composite(masked_card)
    
    if bg_color != TRANSPARENT:
        bg = Image.new('RGBA', (2048, 2048), bg_color)
        bg.alpha_composite(img)
        return bg
        
    return img

def create_full_logo_image(fg_color, bg_color, is_mono=False):
    # Canvas size: 7680x2048 (4x of 1920x512)
    img = Image.new('RGBA', (7680, 2048), TRANSPARENT)
    
    # Create the 2048x2048 icon and resize to 1536x1536
    icon = create_icon_image(fg_color, TRANSPARENT, is_mono=is_mono)
    icon_resized = icon.resize((1536, 1536), Image.Resampling.LANCZOS)
    
    # Paste icon at (256, 256)
    img.paste(icon_resized, (256, 256), icon_resized)
    
    # Draw Text
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype(FONT_PATH, 960)
    except IOError:
        font = ImageFont.load_default()
        print("Warning: DejaVuSans-Bold font not found. Using default font.")
        
    # Measure "Nex" to position "Kan" correctly
    nex_width = draw.textlength("Nex", font=font)
    
    # Draw "Nex" at (2048, 1024)
    draw.text((2048, 1024), "Nex", fill=fg_color, font=font, anchor="lm")
    
    # Draw "Kan" at (2048 + nex_width, 1024)
    kan_color = fg_color if is_mono else ORANGE
    draw.text((2048 + nex_width, 1024), "Kan", fill=kan_color, font=font, anchor="lm")
    
    # If background is specified, composite onto background
    if bg_color != TRANSPARENT:
        bg = Image.new('RGBA', (7680, 2048), bg_color)
        bg.alpha_composite(img)
        return bg
        
    return img

def generate_icon_svg(fg_hex, orange_hex, is_mono=False):
    diag_fill = fg_hex if is_mono else "url(#brand-grad)"
    
    if is_mono:
        page_fill = HEX_WHITE if fg_hex == HEX_BLACK else HEX_BLACK
    else:
        page_fill = HEX_WHITE if fg_hex == HEX_SLATE_LIGHT else "#1E293B"
        
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <!-- Card Cutout Mask for Paper Airplane -->
    <mask id="airplane-mask" maskUnits="userSpaceOnUse">
      <!-- White card base -->
      <rect x="224" y="144" width="80" height="120" rx="10" fill="white" />
      <!-- Black cutout for paper airplane -->
      <g transform="translate(264, 204) rotate(45)">
        <path d="M 0,-22 L 18,14 L 0,5 L -18,14 Z" fill="black" />
        <line x1="0" y1="-22" x2="0" y2="5" stroke="white" stroke-width="2" stroke-linecap="round" />
      </g>
    </mask>
    
    <!-- Gradient for active card -->
    <linearGradient id="brand-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF9E00" />
      <stop offset="100%" stop-color="#FF3D00" />
    </linearGradient>
  </defs>
  
  <!-- Spiral Notebook Page Frame (with solid background fill for visibility/depth) -->
  <rect x="108" y="64" width="320" height="384" rx="24" fill="{page_fill}" stroke="{fg_hex}" stroke-width="16" />
  
  <!-- Spiral Loops on Left Edge (Modern curves) -->
  <path d="M 124,106 C 88,106 88,118 124,118" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
  <path d="M 124,174 C 88,174 88,186 124,186" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
  <path d="M 124,242 C 88,242 88,254 124,254" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
  <path d="M 124,310 C 88,310 88,322 124,322" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
  <path d="M 124,378 C 88,378 88,390 124,390" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
  
  <!-- Punch Holes (to complete the spiral binder look) -->
  <circle cx="124" cy="112" r="4" fill="{fg_hex}" opacity="0.4" />
  <circle cx="124" cy="180" r="4" fill="{fg_hex}" opacity="0.4" />
  <circle cx="124" cy="248" r="4" fill="{fg_hex}" opacity="0.4" />
  <circle cx="124" cy="316" r="4" fill="{fg_hex}" opacity="0.4" />
  <circle cx="124" cy="384" r="4" fill="{fg_hex}" opacity="0.4" />
  
  <!-- Column 1 (Todo) Cards -->
  <rect x="136" y="104" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
  <rect x="136" y="184" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
  <rect x="136" y="264" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
  
  <!-- Column 2 (In Progress) Cards -->
  <!-- Standard card in Column 2 -->
  <rect x="224" y="280" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
  <!-- Active Orange Card with cutout -->
  <rect x="224" y="144" width="80" height="120" rx="10" fill="{diag_fill}" mask="url(#airplane-mask)" />
  
  <!-- Column 3 (Done) Cards -->
  <rect x="316" y="104" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
  <rect x="316" y="280" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
  
  <!-- Completed Card with checkmark badge -->
  <g>
    <rect x="316" y="184" width="76" height="80" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
    <circle cx="354" cy="224" r="14" fill="#10B981" />
    <path d="M 347,224 L 352,229 L 361,219" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>
"""

def generate_full_logo_svg(fg_hex, orange_hex, is_mono=False):
    diag_fill = fg_hex if is_mono else "url(#brand-grad)"
    
    if is_mono:
        page_fill = HEX_WHITE if fg_hex == HEX_BLACK else HEX_BLACK
    else:
        page_fill = HEX_WHITE if fg_hex == HEX_SLATE_LIGHT else "#1E293B"
        
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 512" fill="none">
  <defs>
    <!-- Card Cutout Mask for Paper Airplane -->
    <mask id="airplane-mask" maskUnits="userSpaceOnUse">
      <rect x="224" y="144" width="80" height="120" rx="10" fill="white" />
      <g transform="translate(264, 204) rotate(45)">
        <path d="M 0,-22 L 18,14 L 0,5 L -18,14 Z" fill="black" />
        <line x1="0" y1="-22" x2="0" y2="5" stroke="white" stroke-width="2" stroke-linecap="round" />
      </g>
    </mask>
    
    <!-- Gradient for active card -->
    <linearGradient id="brand-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF9E00" />
      <stop offset="100%" stop-color="#FF3D00" />
    </linearGradient>
  </defs>
  
  <!-- Embedded Icon component -->
  <g transform="translate(64, 64) scale(0.75)">
    <!-- Spiral Notebook Page Frame -->
    <rect x="108" y="64" width="320" height="384" rx="24" fill="{page_fill}" stroke="{fg_hex}" stroke-width="16" />
    
    <!-- Spiral Loops on Left Edge (Modern curves) -->
    <path d="M 124,106 C 88,106 88,118 124,118" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
    <path d="M 124,174 C 88,174 88,186 124,186" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
    <path d="M 124,242 C 88,242 88,254 124,254" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
    <path d="M 124,310 C 88,310 88,322 124,322" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
    <path d="M 124,378 C 88,378 88,390 124,390" stroke="{fg_hex}" stroke-width="8" stroke-linecap="round" />
    
    <!-- Punch Holes -->
    <circle cx="124" cy="112" r="4" fill="{fg_hex}" opacity="0.4" />
    <circle cx="124" cy="180" r="4" fill="{fg_hex}" opacity="0.4" />
    <circle cx="124" cy="248" r="4" fill="{fg_hex}" opacity="0.4" />
    <circle cx="124" cy="316" r="4" fill="{fg_hex}" opacity="0.4" />
    <circle cx="124" cy="384" r="4" fill="{fg_hex}" opacity="0.4" />
    
    <!-- Column 1 (Todo) Cards -->
    <rect x="136" y="104" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
    <rect x="136" y="184" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
    <rect x="136" y="264" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
    
    <!-- Column 2 (In Progress) Cards -->
    <rect x="224" y="280" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
    <rect x="224" y="144" width="80" height="120" rx="10" fill="{diag_fill}" mask="url(#airplane-mask)" />
    
    <!-- Column 3 (Done) Cards -->
    <rect x="316" y="104" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
    <rect x="316" y="280" width="76" height="64" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
    
    <!-- Completed Card with checkmark badge -->
    <g>
      <rect x="316" y="184" width="76" height="80" rx="8" fill="{fg_hex}" fill-opacity="0.2" stroke="{fg_hex}" stroke-width="2" stroke-opacity="0.35" />
      <circle cx="354" cy="224" r="14" fill="#10B981" />
      <path d="M 347,224 L 352,229 L 361,219" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  </g>
  
  <!-- Typography -->
  <text x="512" y="256" font-family="'Inter', 'Prompt', 'Kanit', -apple-system, sans-serif" font-weight="900" font-size="240" dominant-baseline="central">
    <tspan fill="{fg_hex}">Nex</tspan><tspan fill="{is_mono and fg_hex or orange_hex}">Kan</tspan>
  </text>
</svg>
"""

def save_image_sizes(img, base_name):
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save(os.path.join(PUBLIC_DIR, f"{base_name}.png"), "PNG", optimize=True)

def main():
    print("Generating vector SVG assets...")
    
    with open(os.path.join(PUBLIC_DIR, "logo-icon-light.svg"), "w") as f:
        f.write(generate_icon_svg(HEX_SLATE_LIGHT, HEX_ORANGE))
    with open(os.path.join(PUBLIC_DIR, "logo-icon-dark.svg"), "w") as f:
        f.write(generate_icon_svg(HEX_SLATE_DARK, HEX_ORANGE))
    with open(os.path.join(PUBLIC_DIR, "logo-icon-mono-black.svg"), "w") as f:
        f.write(generate_icon_svg(HEX_BLACK, HEX_BLACK, is_mono=True))
    with open(os.path.join(PUBLIC_DIR, "logo-icon-mono-white.svg"), "w") as f:
        f.write(generate_icon_svg(HEX_WHITE, HEX_WHITE, is_mono=True))
    # Favicon SVG uses the dark theme as default
    with open(os.path.join(PUBLIC_DIR, "favicon.svg"), "w") as f:
        f.write(generate_icon_svg(HEX_SLATE_DARK, HEX_ORANGE))
        
    with open(os.path.join(PUBLIC_DIR, "logo-full-light.svg"), "w") as f:
        f.write(generate_full_logo_svg(HEX_SLATE_LIGHT, HEX_ORANGE))
    with open(os.path.join(PUBLIC_DIR, "logo-full-dark.svg"), "w") as f:
        f.write(generate_full_logo_svg(HEX_SLATE_DARK, HEX_ORANGE))
    with open(os.path.join(PUBLIC_DIR, "logo-full-mono-black.svg"), "w") as f:
        f.write(generate_full_logo_svg(HEX_BLACK, HEX_BLACK, is_mono=True))
    with open(os.path.join(PUBLIC_DIR, "logo-full-mono-white.svg"), "w") as f:
        f.write(generate_full_logo_svg(HEX_WHITE, HEX_WHITE, is_mono=True))
        
    print("Generating raster PNG assets (this might take a few seconds)...")
    
    icon_light = create_icon_image(SLATE_LIGHT, TRANSPARENT)
    icon_dark = create_icon_image(SLATE_DARK, TRANSPARENT)
    icon_mono_black = create_icon_image(BLACK, TRANSPARENT, is_mono=True)
    icon_mono_white = create_icon_image(WHITE, TRANSPARENT, is_mono=True)
    
    save_image_sizes(icon_light, "logo-icon-light")
    save_image_sizes(icon_dark, "logo-icon-dark")
    save_image_sizes(icon_mono_black, "logo-icon-mono-black")
    save_image_sizes(icon_mono_white, "logo-icon-mono-white")
    
    # logo.png uses icon_dark (dark version is primary brand logo)
    logo_png_res = icon_dark.resize((512, 512), Image.Resampling.LANCZOS)
    logo_png_res.save(os.path.join(PUBLIC_DIR, "logo.png"), "PNG", optimize=True)
    
    full_light = create_full_logo_image(SLATE_LIGHT, TRANSPARENT)
    full_dark = create_full_logo_image(SLATE_DARK, TRANSPARENT)
    full_mono_black = create_full_logo_image(BLACK, TRANSPARENT, is_mono=True)
    full_mono_white = create_full_logo_image(WHITE, TRANSPARENT, is_mono=True)
    
    full_light.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-light.png"), "PNG", optimize=True)
    full_dark.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-dark.png"), "PNG", optimize=True)
    full_mono_black.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-mono-black.png"), "PNG", optimize=True)
    full_mono_white.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-mono-white.png"), "PNG", optimize=True)
    
    print("Generating favicon-ready sizes from the dark version...")
    sizes = [16, 32, 48, 96, 180, 192, 512]
    # Use icon_dark as primary source for favicons and web manifests
    png_icons = {s: icon_dark.resize((s, s), Image.Resampling.LANCZOS) for s in sizes}
    
    png_icons[16].save(os.path.join(PUBLIC_DIR, "favicon-16x16.png"), "PNG", optimize=True)
    png_icons[32].save(os.path.join(PUBLIC_DIR, "favicon-32x32.png"), "PNG", optimize=True)
    png_icons[96].save(os.path.join(PUBLIC_DIR, "favicon-96x96.png"), "PNG", optimize=True)
    png_icons[180].save(os.path.join(PUBLIC_DIR, "apple-touch-icon.png"), "PNG", optimize=True)
    png_icons[192].save(os.path.join(PUBLIC_DIR, "web-app-manifest-192x192.png"), "PNG", optimize=True)
    png_icons[512].save(os.path.join(PUBLIC_DIR, "web-app-manifest-512x512.png"), "PNG", optimize=True)
    
    png_icons[16].save(
        os.path.join(PUBLIC_DIR, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[png_icons[32], png_icons[48]]
    )
    
    print("All branding assets generated successfully!")

if __name__ == "__main__":
    main()
