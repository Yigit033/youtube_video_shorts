const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

class LUTColorGradingService {
  constructor() {
    this.lutsDir = path.join(__dirname, '..', 'luts');
    this.outputDir = path.join(__dirname, '..', 'temp', 'color_graded');
    this.ensureDirectories();
    this.initializeLUTs();
  }

  ensureDirectories() {
    [this.lutsDir, this.outputDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Initialize built-in LUTs
  initializeLUTs() {
    const builtInLUTs = {
      cinematic: this.createCinematicLUT(),
      vibrant: this.createVibrantLUT(),
      clean: this.createCleanLUT(),
      vintage: this.createVintageLUT(),
      neon: this.createNeonLUT(),
      monochrome: this.createMonochromeLUT(),
      warm: this.createWarmLUT(),
      cool: this.createCoolLUT()
    };

    // Save built-in LUTs
    Object.entries(builtInLUTs).forEach(([name, lut]) => {
      const lutPath = path.join(this.lutsDir, `${name}.cube`);
      if (!fs.existsSync(lutPath)) {
        fs.writeFileSync(lutPath, lut);
      }
    });
  }

  // Apply color grading with LUT
  async applyColorGrading(inputPath, style = 'cinematic', options = {}) {
    const {
      intensity = 1.0,
      preserveOriginal = false,
      customLUT = null
    } = options;

    const outputPath = path.join(this.outputDir, `graded_${style}_${Date.now()}.mp4`);
    
    let lutPath = customLUT;
    if (!lutPath && style && style !== 'balanced') {
      const candidate = path.join(this.lutsDir, `${style}.cube`);
      if (fs.existsSync(candidate)) {
        lutPath = candidate;
      } else {
        console.warn(`⚠️ LUT not found for style '${style}'. Will use EQ-only grading.`);
      }
    }

    return new Promise((resolve, reject) => {
      const colorAdjustments = this.getColorAdjustments(style);
      let cmd = ffmpeg(inputPath);

      if (lutPath) {
        // Use LUT + optional EQ via complex filter
        const filters = [];
        const lutPathEscaped = lutPath.replace(/\\/g, '/');
        const lutFilter = `lut3d=file='${lutPathEscaped}'`;

        if (intensity < 1.0) {
          filters.push(`[0:v]${lutFilter}[graded]`);
          filters.push(`[0:v][graded]blend=all_mode=normal:all_opacity=${intensity}[vf]`);
        } else {
          filters.push(`[0:v]${lutFilter}[vf]`);
        }
        if (colorAdjustments) filters.push(`[vf]${colorAdjustments}[vf]`);

        cmd = cmd.complexFilter(filters).outputOptions(['-map', '[vf]']);
      } else if (colorAdjustments) {
        // Only EQ filter
        cmd = cmd.videoFilters(colorAdjustments);
      }

      const runWithCurrentFilters = () => {
        cmd
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '18',
          '-pix_fmt', 'yuv420p'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Color grading applied: ${style || 'eq-only'}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.warn('⚠️ LUT/EQ processing failed, falling back to EQ-only if applicable. Error:', err.message);
          if (lutPath) {
            // Fallback: re-run with only EQ filter
            const eqCmd = ffmpeg(inputPath);
            if (colorAdjustments) {
              eqCmd.videoFilters(colorAdjustments);
            }
            eqCmd
              .outputOptions(['-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p'])
              .output(outputPath)
              .on('end', () => {
                console.log('✅ Fallback EQ-only grading applied');
                resolve(outputPath);
              })
              .on('error', (e2) => {
                console.error('❌ Color grading failed after fallback:', e2);
                reject(e2);
              })
              .run();
          } else {
            reject(err);
          }
        })
        .run();
      };

      runWithCurrentFilters();
    });
  }

  // Get additional color adjustments for style
  getColorAdjustments(style) {
    const adjustments = {
      cinematic: 'eq=contrast=1.2:brightness=0.05:saturation=1.1:gamma=1.1',
      vibrant: 'eq=contrast=1.3:brightness=0.1:saturation=1.4:gamma=1.2',
      clean: 'eq=contrast=1.1:brightness=0.02:saturation=1.0:gamma=1.0',
      vintage: 'eq=contrast=1.4:brightness=0.1:saturation=0.8:gamma=1.3',
      neon: 'eq=contrast=1.5:brightness=0.15:saturation=1.8:gamma=1.4',
      monochrome: 'hue=s=0',
      warm: 'eq=contrast=1.1:brightness=0.05:saturation=1.2:gamma=1.1',
      cool: 'eq=contrast=1.1:brightness=0.03:saturation=1.1:gamma=0.9'
    };
    return adjustments[style];
  }

  // Create Cinematic LUT
  createCinematicLUT() {
    return `TITLE "Cinematic LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Cinematic color grading - warm, contrasty, film-like
# This is a simplified LUT for demonstration
# In production, you'd use actual 3D LUT files

0.000000 0.000000 0.000000
0.031373 0.015686 0.000000
0.062745 0.031373 0.000000
0.094118 0.047059 0.000000
0.125490 0.062745 0.000000
0.156863 0.078431 0.000000
0.188235 0.094118 0.000000
0.219608 0.109804 0.000000
0.250980 0.125490 0.000000
0.282353 0.141176 0.000000
0.313725 0.156863 0.000000
0.345098 0.172549 0.000000
0.376471 0.188235 0.000000
0.407843 0.203922 0.000000
0.439216 0.219608 0.000000
0.470588 0.235294 0.000000
0.501961 0.250980 0.000000
0.533333 0.266667 0.000000
0.564706 0.282353 0.000000
0.596078 0.298039 0.000000
0.627451 0.313725 0.000000
0.658824 0.329412 0.000000
0.690196 0.345098 0.000000
0.721569 0.360784 0.000000
0.752941 0.376471 0.000000
0.784314 0.392157 0.000000
0.815686 0.407843 0.000000
0.847059 0.423529 0.000000
0.878431 0.439216 0.000000
0.909804 0.454902 0.000000
0.941176 0.470588 0.000000
0.972549 0.486275 0.000000
1.000000 0.501961 0.000000`;
  }

  // Create Vibrant LUT
  createVibrantLUT() {
    return `TITLE "Vibrant LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Vibrant color grading - saturated, bright, energetic
0.000000 0.000000 0.000000
0.031373 0.020000 0.000000
0.062745 0.040000 0.000000
0.094118 0.060000 0.000000
0.125490 0.080000 0.000000
0.156863 0.100000 0.000000
0.188235 0.120000 0.000000
0.219608 0.140000 0.000000
0.250980 0.160000 0.000000
0.282353 0.180000 0.000000
0.313725 0.200000 0.000000
0.345098 0.220000 0.000000
0.376471 0.240000 0.000000
0.407843 0.260000 0.000000
0.439216 0.280000 0.000000
0.470588 0.300000 0.000000
0.501961 0.320000 0.000000
0.533333 0.340000 0.000000
0.564706 0.360000 0.000000
0.596078 0.380000 0.000000
0.627451 0.400000 0.000000
0.658824 0.420000 0.000000
0.690196 0.440000 0.000000
0.721569 0.460000 0.000000
0.752941 0.480000 0.000000
0.784314 0.500000 0.000000
0.815686 0.520000 0.000000
0.847059 0.540000 0.000000
0.878431 0.560000 0.000000
0.909804 0.580000 0.000000
0.941176 0.600000 0.000000
0.972549 0.620000 0.000000
1.000000 0.640000 0.000000`;
  }

  // Create Clean LUT
  createCleanLUT() {
    return `TITLE "Clean LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Clean color grading - neutral, balanced, professional
0.000000 0.000000 0.000000
0.031373 0.015686 0.015686
0.062745 0.031373 0.031373
0.094118 0.047059 0.047059
0.125490 0.062745 0.062745
0.156863 0.078431 0.078431
0.188235 0.094118 0.094118
0.219608 0.109804 0.109804
0.250980 0.125490 0.125490
0.282353 0.141176 0.141176
0.313725 0.156863 0.156863
0.345098 0.172549 0.172549
0.376471 0.188235 0.188235
0.407843 0.203922 0.203922
0.439216 0.219608 0.219608
0.470588 0.235294 0.235294
0.501961 0.250980 0.250980
0.533333 0.266667 0.266667
0.564706 0.282353 0.282353
0.596078 0.298039 0.298039
0.627451 0.313725 0.313725
0.658824 0.329412 0.329412
0.690196 0.345098 0.345098
0.721569 0.360784 0.360784
0.752941 0.376471 0.376471
0.784314 0.392157 0.392157
0.815686 0.407843 0.407843
0.847059 0.423529 0.423529
0.878431 0.439216 0.439216
0.909804 0.454902 0.454902
0.941176 0.470588 0.470588
0.972549 0.486275 0.486275
1.000000 0.501961 0.501961`;
  }

  // Create Vintage LUT
  createVintageLUT() {
    return `TITLE "Vintage LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Vintage color grading - warm, sepia-like, nostalgic
0.000000 0.000000 0.000000
0.031373 0.025000 0.010000
0.062745 0.050000 0.020000
0.094118 0.075000 0.030000
0.125490 0.100000 0.040000
0.156863 0.125000 0.050000
0.188235 0.150000 0.060000
0.219608 0.175000 0.070000
0.250980 0.200000 0.080000
0.282353 0.225000 0.090000
0.313725 0.250000 0.100000
0.345098 0.275000 0.110000
0.376471 0.300000 0.120000
0.407843 0.325000 0.130000
0.439216 0.350000 0.140000
0.470588 0.375000 0.150000
0.501961 0.400000 0.160000
0.533333 0.425000 0.170000
0.564706 0.450000 0.180000
0.596078 0.475000 0.190000
0.627451 0.500000 0.200000
0.658824 0.525000 0.210000
0.690196 0.550000 0.220000
0.721569 0.575000 0.230000
0.752941 0.600000 0.240000
0.784314 0.625000 0.250000
0.815686 0.650000 0.260000
0.847059 0.675000 0.270000
0.878431 0.700000 0.280000
0.909804 0.725000 0.290000
0.941176 0.750000 0.300000
0.972549 0.775000 0.310000
1.000000 0.800000 0.320000`;
  }

  // Create Neon LUT
  createNeonLUT() {
    return `TITLE "Neon LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Neon color grading - high contrast, saturated, electric
0.000000 0.000000 0.000000
0.031373 0.040000 0.000000
0.062745 0.080000 0.000000
0.094118 0.120000 0.000000
0.125490 0.160000 0.000000
0.156863 0.200000 0.000000
0.188235 0.240000 0.000000
0.219608 0.280000 0.000000
0.250980 0.320000 0.000000
0.282353 0.360000 0.000000
0.313725 0.400000 0.000000
0.345098 0.440000 0.000000
0.376471 0.480000 0.000000
0.407843 0.520000 0.000000
0.439216 0.560000 0.000000
0.470588 0.600000 0.000000
0.501961 0.640000 0.000000
0.533333 0.680000 0.000000
0.564706 0.720000 0.000000
0.596078 0.760000 0.000000
0.627451 0.800000 0.000000
0.658824 0.840000 0.000000
0.690196 0.880000 0.000000
0.721569 0.920000 0.000000
0.752941 0.960000 0.000000
0.784314 1.000000 0.000000
0.815686 1.000000 0.040000
0.847059 1.000000 0.080000
0.878431 1.000000 0.120000
0.909804 1.000000 0.160000
0.941176 1.000000 0.200000
0.972549 1.000000 0.240000
1.000000 1.000000 0.280000`;
  }

  // Create Monochrome LUT
  createMonochromeLUT() {
    return `TITLE "Monochrome LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Monochrome LUT - grayscale conversion
0.000000 0.000000 0.000000
0.031373 0.031373 0.031373
0.062745 0.062745 0.062745
0.094118 0.094118 0.094118
0.125490 0.125490 0.125490
0.156863 0.156863 0.156863
0.188235 0.188235 0.188235
0.219608 0.219608 0.219608
0.250980 0.250980 0.250980
0.282353 0.282353 0.282353
0.313725 0.313725 0.313725
0.345098 0.345098 0.345098
0.376471 0.376471 0.376471
0.407843 0.407843 0.407843
0.439216 0.439216 0.439216
0.470588 0.470588 0.470588
0.501961 0.501961 0.501961
0.533333 0.533333 0.533333
0.564706 0.564706 0.564706
0.596078 0.596078 0.596078
0.627451 0.627451 0.627451
0.658824 0.658824 0.658824
0.690196 0.690196 0.690196
0.721569 0.721569 0.721569
0.752941 0.752941 0.752941
0.784314 0.784314 0.784314
0.815686 0.815686 0.815686
0.847059 0.847059 0.847059
0.878431 0.878431 0.878431
0.909804 0.909804 0.909804
0.941176 0.941176 0.941176
0.972549 0.972549 0.972549
1.000000 1.000000 1.000000`;
  }

  // Create Warm LUT
  createWarmLUT() {
    return `TITLE "Warm LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Warm color grading - orange/amber tones
0.000000 0.000000 0.000000
0.031373 0.020000 0.010000
0.062745 0.040000 0.020000
0.094118 0.060000 0.030000
0.125490 0.080000 0.040000
0.156863 0.100000 0.050000
0.188235 0.120000 0.060000
0.219608 0.140000 0.070000
0.250980 0.160000 0.080000
0.282353 0.180000 0.090000
0.313725 0.200000 0.100000
0.345098 0.220000 0.110000
0.376471 0.240000 0.120000
0.407843 0.260000 0.130000
0.439216 0.280000 0.140000
0.470588 0.300000 0.150000
0.501961 0.320000 0.160000
0.533333 0.340000 0.170000
0.564706 0.360000 0.180000
0.596078 0.380000 0.190000
0.627451 0.400000 0.200000
0.658824 0.420000 0.210000
0.690196 0.440000 0.220000
0.721569 0.460000 0.230000
0.752941 0.480000 0.240000
0.784314 0.500000 0.250000
0.815686 0.520000 0.260000
0.847059 0.540000 0.270000
0.878431 0.560000 0.280000
0.909804 0.580000 0.290000
0.941176 0.600000 0.300000
0.972549 0.620000 0.310000
1.000000 0.640000 0.320000`;
  }

  // Create Cool LUT
  createCoolLUT() {
    return `TITLE "Cool LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# Cool color grading - blue/cyan tones
0.000000 0.000000 0.000000
0.031373 0.010000 0.020000
0.062745 0.020000 0.040000
0.094118 0.030000 0.060000
0.125490 0.040000 0.080000
0.156863 0.050000 0.100000
0.188235 0.060000 0.120000
0.219608 0.070000 0.140000
0.250980 0.080000 0.160000
0.282353 0.090000 0.180000
0.313725 0.100000 0.200000
0.345098 0.110000 0.220000
0.376471 0.120000 0.240000
0.407843 0.130000 0.260000
0.439216 0.140000 0.280000
0.470588 0.150000 0.300000
0.501961 0.160000 0.320000
0.533333 0.170000 0.340000
0.564706 0.180000 0.360000
0.596078 0.190000 0.380000
0.627451 0.200000 0.400000
0.658824 0.210000 0.420000
0.690196 0.220000 0.440000
0.721569 0.230000 0.460000
0.752941 0.240000 0.480000
0.784314 0.250000 0.500000
0.815686 0.260000 0.520000
0.847059 0.270000 0.540000
0.878431 0.280000 0.560000
0.909804 0.290000 0.580000
0.941176 0.300000 0.600000
0.972549 0.310000 0.620000
1.000000 0.320000 0.640000`;
  }

  // Get available LUT styles
  getAvailableStyles() {
    return [
      { name: 'cinematic', description: 'Film-like, warm, contrasty' },
      { name: 'vibrant', description: 'Saturated, bright, energetic' },
      { name: 'clean', description: 'Neutral, balanced, professional' },
      { name: 'vintage', description: 'Warm, sepia-like, nostalgic' },
      { name: 'neon', description: 'High contrast, electric, saturated' },
      { name: 'monochrome', description: 'Black and white, classic' },
      { name: 'warm', description: 'Orange/amber tones, cozy' },
      { name: 'cool', description: 'Blue/cyan tones, fresh' }
    ];
  }

  // Upload custom LUT
  async uploadCustomLUT(lutFile, name) {
    const lutPath = path.join(this.lutsDir, `${name}.cube`);
    fs.writeFileSync(lutPath, lutFile);
    console.log(`✅ Custom LUT uploaded: ${name}`);
    return lutPath;
  }
}

module.exports = new LUTColorGradingService();
