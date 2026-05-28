import { initWebGL } from './animation';
import { initUI } from './ui';

// Active modes
type ModeType = 'alphanumeric' | 'passphrase' | 'pin';

/**
 * Bootstrap on document ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize WebGL background layer
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  if (canvas) {
    initWebGL(canvas);
  }

  // 2. Initialize UI Bindings
  initUI();

  // 3. Kick off Gemini Image Pipeline
  triggerImageGenerationPipeline();

  // 4. Bind Regenerate Visuals action
  const regenBtn = document.getElementById('btn-regenerate-visuals');
  if (regenBtn) {
    regenBtn.addEventListener('click', () => {
      triggerImageGenerationPipeline();
    });
  }
});

/**
 * Orchestrates image loading, shimmers, Gemini fetch sequences, and SVG fallbacks
 */
function triggerImageGenerationPipeline(): void {
  const modes: ModeType[] = ['alphanumeric', 'passphrase', 'pin'];
  const apiKey = localStorage.getItem('VAULTAURA_GEMINI_KEY') || "";

  modes.forEach(mode => {
    // 1. Show shimmer, hide fallback & img containers
    setVisualLoadingState(mode, true);

    if (apiKey) {
      // API key present: dispatch asynchronous browser fetch
      fetchGeminiImage(mode, apiKey)
        .then(imageUrl => {
          if (imageUrl) {
            renderLoadedImage(mode, imageUrl);
          } else {
            // Null return represents a caught fallback condition
            renderFallbackSVG(mode);
          }
        })
        .catch(err => {
          console.warn(`Gemini generation error for ${mode}, deploying vector fallback.`, err);
          renderFallbackSVG(mode);
        });
    } else {
      // No key: immediately transition to vector fallbacks (silent degradation)
      // We wrap in a tiny timeout to simulate a luxurious loading cycle
      setTimeout(() => {
        renderFallbackSVG(mode);
      }, 600);
    }
  });
}

/**
 * Controls card shimmers and visibility states
 */
function setVisualLoadingState(mode: ModeType, isLoading: boolean): void {
  const shimmer = document.getElementById(`shimmer-${mode}`);
  const fallback = document.getElementById(`fallback-${mode}`);
  const img = document.getElementById(`img-${mode}`) as HTMLImageElement;

  if (!shimmer || !fallback || !img) return;

  if (isLoading) {
    shimmer.classList.remove('hidden');
    fallback.classList.add('hidden');
    img.classList.add('hidden');
    img.classList.remove('image-loaded');
  } else {
    shimmer.classList.add('hidden');
  }
}

/**
 * Renders the fetched Gemini image into its viewport card
 */
function renderLoadedImage(mode: ModeType, url: string): void {
  const img = document.getElementById(`img-${mode}`) as HTMLImageElement;
  const fallback = document.getElementById(`fallback-${mode}`);
  if (!img) return;

  img.src = url;
  img.onload = () => {
    setVisualLoadingState(mode, false);
    if (fallback) fallback.classList.add('hidden');
    img.classList.remove('hidden');
    img.classList.add('image-loaded');
  };
}

/**
 * Contacts the Gemini Imagen model using a client-side fetch call
 */
async function fetchGeminiImage(mode: ModeType, key: string): Promise<string | null> {
  const prompts: Record<ModeType, string> = {
    alphanumeric: `Hyper-realistic minimalist product render. A single abstract geometric crystalline key form, razor-sharp facets, matte obsidian black surface with brushed champagne gold edge highlights, dramatically lit from above-left by a single warm golden spotlight against a pure deep charcoal #09090b background. Starkly lit. No reflections. No glow. No background elements. Studio photography aesthetic. Ultra-sharp 8K detail. Aspect ratio 16:9.`,
    passphrase: `Minimalist abstract typographic art. Floating fragments of clean monospaced glyphs and alphanumeric characters arranged in precise geometric grid columns, warm golden color #d4af37 on deep matte black background #09090b. Sharp, editorial. No gradients. No blurs. Technical precision. Ultra-high contrast. 8K. Aspect ratio 16:9.`,
    pin: `Abstract technical line-art illustration of a secure vault door mechanism. Precise engineering blueprint-style rendering. Warm champagne gold line strokes on pure obsidian black background. Ultra-thin geometric circles, rotating disc mechanisms, alignment markers, and numeric dial indicators rendered with surgical precision. No fills. No gradients. No textures. Pure line geometry. 8K. Aspect ratio 16:9.`
  };

  // Endpoint: Standard Gemini Imagen v1beta endpoint or Model configuration specified
  // We fall back to standard endpoint models that generate images client-side
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${key}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompts[mode],
      numberOfImages: 1,
      outputMimeType: "image/jpeg",
      aspectRatio: "16:9"
    })
  });

  if (!response.ok) {
    throw new Error(`API HTTP Error: ${response.status}`);
  }

  const data = await response.json();
  if (data?.generatedImages?.[0]?.image?.imageBytes) {
    const base64Bytes = data.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64Bytes}`;
  }

  return null;
}

/**
 * SILENT FALLBACKS: Custom-engineered inline SVGs conforming strictly to the prompt specifications
 */
function renderFallbackSVG(mode: ModeType): void {
  const container = document.getElementById(`fallback-${mode}`);
  const img = document.getElementById(`img-${mode}`) as HTMLImageElement;
  if (!container) return;

  setVisualLoadingState(mode, false);
  if (img) img.classList.add('hidden');
  container.classList.remove('hidden');

  let svgContent = "";

  if (mode === 'alphanumeric') {
    // Design: A single abstract geometric crystal key form with sharp facets and brushed gold edges on near-black charcoal background
    svgContent = `
      <svg class="image-fallback-svg" viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#09090b"/>
        <!-- Spotlight aura math -->
        <radialGradient id="spotlight-alpha" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#d4af37" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
        </radialGradient>
        <rect width="100%" height="100%" fill="url(#spotlight-alpha)"/>
        
        <!-- Crystalline Faceted Key Body -->
        <g stroke="#d4af37" stroke-width="0.5" fill="#121214" fill-opacity="0.9">
          <!-- Head/Handle Facets -->
          <polygon points="40,45 52,33 65,33 70,45 65,57 52,57" />
          <polygon points="40,45 50,45 52,33" />
          <polygon points="50,45 62,45 65,33" />
          <polygon points="62,45 70,45 65,57" />
          <polygon points="50,45 62,45 65,57" />
          <polygon points="40,45 50,45 52,57" />
          
          <!-- Key Shaft -->
          <polygon points="70,43 115,43 115,47 70,47" />
          
          <!-- Key Teeth (Faceted cutouts) -->
          <polygon points="100,47 105,55 108,47" />
          <polygon points="108,47 112,53 115,47" />
        </g>
        
        <!-- Luxury Highlights -->
        <circle cx="53" cy="45" r="4" fill="none" stroke="#d4af37" stroke-width="0.25" stroke-dasharray="1,1"/>
        <line x1="75" y1="43" x2="95" y2="43" stroke="#fafafa" stroke-width="0.5" opacity="0.6"/>
      </svg>
    `;
  } else if (mode === 'passphrase') {
    // Design: Monospaced glyphs and characters floating in precise columns outlined in gold
    svgContent = `
      <svg class="image-fallback-svg" viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#09090b"/>
        
        <!-- Symmetrical structural grid -->
        <g stroke="#27272a" stroke-width="0.2">
          <line x1="20" y1="0" x2="20" y2="90" />
          <line x1="40" y1="0" x2="40" y2="90" />
          <line x1="60" y1="0" x2="60" y2="90" />
          <line x1="80" y1="0" x2="80" y2="90" />
          <line x1="100" y1="0" x2="100" y2="90" />
          <line x1="120" y1="0" x2="120" y2="90" />
          <line x1="140" y1="0" x2="140" y2="90" />
          
          <line x1="0" y1="20" x2="160" y2="20" />
          <line x1="0" y1="45" x2="160" y2="45" />
          <line x1="0" y1="70" x2="160" y2="70" />
        </g>

        <!-- Curated Typography Monospace Elements -->
        <g fill="#d4af37" font-family="'DM Mono', monospace" font-size="6" font-weight="500" letter-spacing="0.05em">
          <text x="25" y="15">EN</text>
          <text x="85" y="15">TR</text>
          <text x="125" y="15">OP</text>
          <text x="145" y="15">Y</text>
          
          <text x="5" y="35" fill="#fafafa">C</text>
          <text x="25" y="35" fill="#52525b">R</text>
          <text x="45" y="35">Y</text>
          <text x="65" y="35" fill="#fafafa">P</text>
          <text x="85" y="35">T</text>
          <text x="105" y="35" fill="#52525b">O</text>
          
          <text x="25" y="60">K</text>
          <text x="45" y="60" fill="#fafafa">E</text>
          <text x="65" y="60" fill="#52525b">Y</text>
          <text x="105" y="60">2</text>
          <text x="125" y="60">B</text>
          <text x="145" y="60" fill="#fafafa">I</text>
          <text x="149" y="60">T</text>
          
          <text x="5" y="80">P</text>
          <text x="25" y="80">A</text>
          <text x="45" y="80" fill="#52525b">S</text>
          <text x="65" y="80">S</text>
          <text x="85" y="80" fill="#fafafa">W</text>
          <text x="105" y="80">D</text>
        </g>

        <!-- Precision Highlights -->
        <g stroke="#d4af37" stroke-width="0.3" fill="none">
          <rect x="23" y="10" width="10" height="7"/>
          <rect x="83" y="30" width="8" height="7"/>
          <rect x="43" y="55" width="8" height="7" stroke="#fafafa"/>
        </g>
      </svg>
    `;
  } else {
    // PIN Block: Blueprint of secure vault door, rotate dial indicators, precise geometry
    svgContent = `
      <svg class="image-fallback-svg" viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#09090b"/>
        
        <!-- Blueprint Outer Rings -->
        <g stroke="#d4af37" stroke-width="0.3" fill="none" opacity="0.8">
          <!-- Central Dial Core -->
          <circle cx="80" cy="45" r="35" />
          <circle cx="80" cy="45" r="30" />
          <circle cx="80" cy="45" r="20" stroke-dasharray="2,2" />
          <circle cx="80" cy="45" r="10" />
          <circle cx="80" cy="45" r="3" fill="#d4af37" />
          
          <!-- Outer circular alignment markers -->
          <circle cx="80" cy="45" r="38" stroke-dasharray="1,6" stroke-width="0.6" />
          
          <!-- Alignment Blueprint Lines -->
          <line x1="80" y1="5" x2="80" y2="85" stroke-dasharray="2,2"/>
          <line x1="40" y1="45" x2="120" y2="45" stroke-dasharray="2,2"/>
          
          <!-- Diagnostic angles -->
          <line x1="55" y1="20" x2="105" y2="70" opacity="0.3"/>
          <line x1="105" y1="20" x2="55" y2="70" opacity="0.3"/>
          
          <!-- Surgical dial tabs -->
          <path d="M 80,10 L 80,5" stroke-width="0.8" stroke="#fafafa" />
          <path d="M 80,80 L 80,85" />
          <path d="M 45,45 L 40,45" />
          <path d="M 115,45 L 120,45" />
        </g>
        
        <!-- Numeric degree readings -->
        <g fill="#fafafa" font-family="'DM Mono', monospace" font-size="3" font-weight="300" opacity="0.7">
          <text x="78" y="14">00</text>
          <text x="111" y="46">90</text>
          <text x="77" y="79">180</text>
          <text x="44" y="46">270</text>
        </g>
      </svg>
    `;
  }

  container.innerHTML = svgContent;
  // Apply luxury smooth scaling opacity animation
  const svgEl = container.querySelector('.image-fallback-svg');
  if (svgEl) {
    svgEl.classList.add('image-loaded');
  }
}
