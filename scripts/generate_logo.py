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

def create_icon_image(fg_color, bg_color, is_mono=False):
    # Base canvas (4x supersampling: 2048x2048)
    img = Image.new('RGBA', (2048, 2048), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    
    # Notebook page frame: x=(432, 1712), y=(256, 1792), rx=96
    frame_color = fg_color
    frame_width = 64
    draw.rounded_rectangle((432, 256, 1712, 1792), radius=96, outline=frame_color, width=frame_width)
    
    # Spiral loops: width=144, height=64, rx=32
    # x1 = 352, x2 = 496
    # Centers y: 448, 720, 992, 1264, 1536
    for cy in [448, 720, 992, 1264, 1536]:
        draw.rounded_rectangle((352, cy - 32, 496, cy + 32), radius=32, fill=frame_color)
        
    # Cards (opacity 15%)
    r, g, b, a = fg_color
    card_opacity_color = (r, g, b, int(255 * 0.15))
    
    # Column 1 Cards (Todo)
    draw.rounded_rectangle((528, 448, 848, 728), radius=32, fill=card_opacity_color)
    draw.rounded_rectangle((528, 792, 848, 1072), radius=32, fill=card_opacity_color)
    
    # Column 2 Card (Active Orange Card)
    diag_color = fg_color if is_mono else ORANGE
    card_layer = Image.new('RGBA', (2048, 2048), TRANSPARENT)
    card_draw = ImageDraw.Draw(card_layer)
    card_draw.rounded_rectangle((912, 600, 1232, 1040), radius=32, fill=diag_color)
    
    # Cutout of paper airplane (centered at 1072, 820)
    airplane_mask = Image.new('L', (2048, 2048), 255)
    airplane_layer = Image.new('L', (2048, 2048), 0)
    airplane_layer_draw = ImageDraw.Draw(airplane_layer)
    
    # Airplane coordinates (pointing up)
    nose = (1072, 740)
    r_wing = (1136, 876)
    tail = (1072, 844)
    l_wing = (1008, 876)
    airplane_layer_draw.polygon([nose, r_wing, tail, l_wing], fill=255)
    
    # Rotate by 60 degrees clockwise (-60 in PIL)
    rotated_airplane = airplane_layer.rotate(-60, resample=Image.Resampling.BICUBIC, center=(1072, 820))
    airplane_mask.paste(0, (0, 0), rotated_airplane)
    
    # Apply cutout mask
    masked_card = Image.new('RGBA', (2048, 2048), TRANSPARENT)
    masked_card.paste(card_layer, (0, 0), airplane_mask)
    img.alpha_composite(masked_card)
    
    # Column 3 Card (Done)
    draw.rounded_rectangle((1296, 880, 1616, 1200), radius=32, fill=card_opacity_color)
    
    # Checkmark inside Column 3 Card (opacity 40%)
    checkmark_color = (r, g, b, int(255 * 0.4))
    draw.line([(1408, 1040), (1440, 1072), (1504, 1008)], fill=checkmark_color, width=24, joint="round")
    
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
    diag_fill = fg_hex if is_mono else orange_hex
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <!-- Card Cutout Mask for Paper Airplane -->
    <mask id="airplane-mask" maskUnits="userSpaceOnUse">
      <rect x="228" y="150" width="80" height="110" rx="8" fill="white" />
      <g transform="translate(268, 205) rotate(60)">
        <path d="M 0,-20 L 16,14 L 0,6 L -16,14 Z" fill="black" />
      </g>
    </mask>
  </defs>
  
  <!-- Spiral Notebook Page Frame -->
  <rect x="108" y="64" width="320" height="384" rx="24" stroke="{fg_hex}" stroke-width="16" />
  
  <!-- Spiral Loops on Left Edge -->
  <rect x="88" y="104" width="36" height="16" rx="8" fill="{fg_hex}" />
  <rect x="88" y="172" width="36" height="16" rx="8" fill="{fg_hex}" />
  <rect x="88" y="240" width="36" height="16" rx="8" fill="{fg_hex}" />
  <rect x="88" y="308" width="36" height="16" rx="8" fill="{fg_hex}" />
  <rect x="88" y="376" width="36" height="16" rx="8" fill="{fg_hex}" />
  
  <!-- Column 1 (Todo) Cards -->
  <rect x="132" y="112" width="80" height="70" rx="8" fill="{fg_hex}" opacity="0.15" />
  <rect x="132" y="198" width="80" height="70" rx="8" fill="{fg_hex}" opacity="0.15" />
  
  <!-- Column 2 (In Progress) Active Orange Card with cutout -->
  <rect x="228" y="150" width="80" height="110" rx="8" fill="{diag_fill}" mask="url(#airplane-mask)" />
  
  <!-- Column 3 (Done) Completed Card with checkmark -->
  <rect x="324" y="220" width="80" height="80" rx="8" fill="{fg_hex}" opacity="0.15" />
  <path d="M 352,260 L 360,268 L 376,252" stroke="{fg_hex}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />
</svg>
"""

def generate_full_logo_svg(fg_hex, orange_hex, is_mono=False):
    diag_fill = fg_hex if is_mono else orange_hex
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 512" fill="none">
  <defs>
    <!-- Card Cutout Mask for Paper Airplane -->
    <mask id="airplane-mask" maskUnits="userSpaceOnUse">
      <rect x="228" y="150" width="80" height="110" rx="8" fill="white" />
      <g transform="translate(268, 205) rotate(60)">
        <path d="M 0,-20 L 16,14 L 0,6 L -16,14 Z" fill="black" />
      </g>
    </mask>
  </defs>
  
  <!-- Embedded Icon component -->
  <g transform="translate(64, 64) scale(0.75)">
    <!-- Spiral Notebook Page Frame -->
    <rect x="108" y="64" width="320" height="384" rx="24" stroke="{fg_hex}" stroke-width="16" />
    
    <!-- Spiral Loops on Left Edge -->
    <rect x="88" y="104" width="36" height="16" rx="8" fill="{fg_hex}" />
    <rect x="88" y="172" width="36" height="16" rx="8" fill="{fg_hex}" />
    <rect x="88" y="240" width="36" height="16" rx="8" fill="{fg_hex}" />
    <rect x="88" y="308" width="36" height="16" rx="8" fill="{fg_hex}" />
    <rect x="88" y="376" width="36" height="16" rx="8" fill="{fg_hex}" />
    
    <!-- Column 1 (Todo) Cards -->
    <rect x="132" y="112" width="80" height="70" rx="8" fill="{fg_hex}" opacity="0.15" />
    <rect x="132" y="198" width="80" height="70" rx="8" fill="{fg_hex}" opacity="0.15" />
    
    <!-- Column 2 (In Progress) Active Orange Card with cutout -->
    <rect x="228" y="150" width="80" height="110" rx="8" fill="{diag_fill}" mask="url(#airplane-mask)" />
    
    <!-- Column 3 (Done) Completed Card with checkmark -->
    <rect x="324" y="220" width="80" height="80" rx="8" fill="{fg_hex}" opacity="0.15" />
    <path d="M 352,260 L 360,268 L 376,252" stroke="{fg_hex}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />
  </g>
  
  <!-- Typography -->
  <text x="512" y="256" font-family="'Inter', 'Prompt', 'Kanit', -apple-system, sans-serif" font-weight="900" font-size="240" dominant-baseline="central">
    <tspan fill="{fg_hex}">Nex</tspan><tspan fill="{diag_fill}">Kan</tspan>
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
    with open(os.path.join(PUBLIC_DIR, "favicon.svg"), "w") as f:
        f.write(generate_icon_svg(HEX_SLATE_LIGHT, HEX_ORANGE))
        
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
    
    logo_png_res = icon_light.resize((512, 512), Image.Resampling.LANCZOS)
    logo_png_res.save(os.path.join(PUBLIC_DIR, "logo.png"), "PNG", optimize=True)
    
    full_light = create_full_logo_image(SLATE_LIGHT, TRANSPARENT)
    full_dark = create_full_logo_image(SLATE_DARK, TRANSPARENT)
    full_mono_black = create_full_logo_image(BLACK, TRANSPARENT, is_mono=True)
    full_mono_white = create_full_logo_image(WHITE, TRANSPARENT, is_mono=True)
    
    full_light.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-light.png"), "PNG", optimize=True)
    full_dark.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-dark.png"), "PNG", optimize=True)
    full_mono_black.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-mono-black.png"), "PNG", optimize=True)
    full_mono_white.resize((1920, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, "logo-full-mono-white.png"), "PNG", optimize=True)
    
    print("Generating favicon-ready sizes...")
    sizes = [16, 32, 48, 96, 180, 192, 512]
    png_icons = {s: icon_light.resize((s, s), Image.Resampling.LANCZOS) for s in sizes}
    
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
