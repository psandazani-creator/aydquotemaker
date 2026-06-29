from PIL import Image, ImageDraw, ImageFont
import os

# Create logos directory if it doesn't exist
public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
os.makedirs(public_dir, exist_ok=True)

# Gold color (matching the theme)
GOLD = '#D4AF37'
BLACK_BG = '#0A0A0A'

def create_logo(size):
    """Create a logo with capital A on top and AydQuoteMaker below"""
    
    # Create image with black background
    img = Image.new('RGB', (size, size), BLACK_BG)
    draw = ImageDraw.Draw(img)
    
    # Try to use a nice font, fall back to default if not available
    try:
        # For large "A"
        font_a = ImageFont.truetype("arial.ttf", int(size * 0.35))
        # For text below
        font_text = ImageFont.truetype("arial.ttf", int(size * 0.15))
    except:
        # Fallback to default font
        font_a = ImageFont.load_default()
        font_text = ImageFont.load_default()
    
    # Draw capital "A"
    a_bbox = draw.textbbox((0, 0), "A", font=font_a)
    a_width = a_bbox[2] - a_bbox[0]
    a_height = a_bbox[3] - a_bbox[1]
    a_x = (size - a_width) / 2
    a_y = (size * 0.25) - (a_height / 2)
    
    draw.text((a_x, a_y), "A", fill=GOLD, font=font_a)
    
    # Draw "AydQuoteMaker"
    text_bbox = draw.textbbox((0, 0), "AydQuoteMaker", font=font_text)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    text_x = (size - text_width) / 2
    text_y = (size * 0.65) - (text_height / 2)
    
    draw.text((text_x, text_y), "AydQuoteMaker", fill=GOLD, font=font_text)
    
    return img

# Create 192x192 logo
logo_192 = create_logo(192)
logo_192_path = os.path.join(public_dir, 'logo192.png')
logo_192.save(logo_192_path)
print(f"✓ Created {logo_192_path}")

# Create 512x512 logo
logo_512 = create_logo(512)
logo_512_path = os.path.join(public_dir, 'logo512.png')
logo_512.save(logo_512_path)
print(f"✓ Created {logo_512_path}")

# Create favicon (simple version)
favicon = create_logo(64)
favicon_path = os.path.join(public_dir, 'favicon.ico')
favicon.save(favicon_path)
print(f"✓ Created {favicon_path}")

print("\n✓ All logos created successfully!")
